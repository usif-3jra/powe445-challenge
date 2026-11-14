# POWE445 — Self-Balancing Robot Control Challenge (v1.0)

Web-based technical assessment for **POWE445 – Control Systems II**, Beirut Arab University.
Created by **Youssef Ajra**.

Students sign in, wait for admission, then work through six sheets:

| # | Sheet | Graded item (default marks) |
|---|-------|-----------------------------|
| 1 | System model + block diagram (s-domain) | Closed-loop G(s) = θ(s)/θref(s) — 20 |
| 2 | State space | CCF matrices A, B, C, D — 15 · input/output signals — 5 |
| 3 | Analysis (ranks of 𝒞, 𝒪, eigenvalues) | Controllable? 5 · Observable? 5 · Stable? 5 |
| 4 | ML block (dataset → MATLAB Regression Learner → export) | Hidden-test R² ≥ 0.995 — 20 |
| 5 | Challenge run (slope and/or pushes, A → B → A) | Pass with ML in the loop — 25 |
| 6 | Marks + certificate (print / save as PDF) | — |

All weights, attempts, tolerance, dataset size, disturbance and pass thresholds are editable live in the Control Room.

---

## Files

```
index.html                 student app
admin.html                 instructor Control Room
css/style.css              white blueprint theme
js/core.js                 maths: parameters, G(s), CCF, ranks, eigenvalues, motor model, dataset, simulator
js/ui.js                   block diagram, robot drawing, plots, certificate
js/app.js                  student logic          js/admin.js   Control Room logic
js/backend.js              Firebase or local-demo storage
js/config.js               ← paste your Firebase config here
matlab/exportModelForWeb.m students run this after Regression Learner
data/POWE445_dataset_SAMPLE_202312345.csv   sample dataset (ID 202312345) for trying the MATLAB flow
database.rules.json        Firebase Realtime Database security rules
assets/bau-logo.png        optional local copy of the logo; if missing, the hosted logo_ECE.png is used
```

## 1 · Try it locally (no setup)

With `apiKey` still `PASTE_...` in `js/config.js` the site runs in **local demo mode** (data stays in one browser).

```
cd <this folder>
python -m http.server 8000
```
Open `http://localhost:8000` (student) and `http://localhost:8000/admin.html` in another tab (passcode `powe445-admin`, set in `js/config.js`). A second student = another tab. Opening `index.html` by double-click will not work (ES modules need http).

## 2 · Firebase (live class, free Spark plan, ~10 min)

1. <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started** → enable **Anonymous** and **Email/Password**. In *Users* add your instructor e-mail + password.
3. **Build → Realtime Database → Create database** (locked mode). In the **Rules** tab paste `database.rules.json` → **Publish**.
4. **Project settings → Your apps → Web (`</>`)** → register → copy the `firebaseConfig` object into `js/config.js` (it must include `databaseURL`).
5. Open `admin.html`, sign in. The first time it says the account is not an admin and shows your **UID**. In Realtime Database → **Data**, add a child `admins` → `<your UID>` = `true`. Sign in again.
6. **Authentication → Settings → Authorized domains** → add `<your-github-user>.github.io`.

## 3 · Host on GitHub Pages

1. New repository (e.g. `powe445-challenge`), upload everything in this folder keeping the folder structure.
2. **Settings → Pages → Deploy from a branch → main / root**.
3. Students: `https://<user>.github.io/powe445-challenge/` · Instructor: `.../admin.html`.

## 4 · Running a session

1. Control Room → session **OPEN** (top-right card). Students sign in with a three-word name and a 9-digit ID starting with 20.
2. **Waiting room** → Accept / Reject (duplicate IDs are flagged in red). Students enter automatically once accepted.
3. **Students & marks** → live progress, online dot, marks per question. Type in a cell to override that student's mark; clear it to return to the automatic mark. **Key** shows that student's full answer key.
4. **Settings & marks** → weights, attempts, tolerance, dataset N (3000–5000), disturbance (*slope*, *push*, or *both*), pass thresholds. “Check the current test” runs PI-only vs. reference for any ID so you can tune the difficulty.
5. **Leaderboard** → most balanced robot (best passing Balance Index). **Export results CSV** for the grade book.
6. Close the session to stop new sign-ins.

## 5 · The engineering behind it

**Each student gets a unique robot.** Mass, COM height, inertia, wheel radius, motor constants, controller gains and the real-motor imperfections are generated deterministically from the student ID (copying answers does not work; the Answer-key tab reproduces them).

**Block diagram (s-domain).**
`C(s) = Kp + Ki/s` → two identical motors in parallel `Km/(τm s+1)` each → robot body `K_B/(s² − ωp²)` (linearised wheeled inverted pendulum; `K_B = (1 + m l/(r M_a))/J_e`, `ωp² = m g l/J_e`).
Feedback: tilt estimator `Hθ = 1` to the PI summing junction and gyroscope `Hg(s) = s` through `Kd` to the inner junction.

> **Why the gyroscope rate loop is there:** a PI controller alone cannot stabilise an inverted pendulum. Even ignoring the motor lag, `1 + C(s)·2Km·G_B(s) = 0` gives `s³ + 0·s² + (K Kp − ωp²) s + K Ki = 0` (K = 2 Km K_B): the s² coefficient is zero, so Routh's necessary condition fails for every Kp, Ki; with the motor lag it becomes negative (−τm ωp²). The rate feedback supplies the missing damping, which is how real balancing robots use the MPU-6050 gyro.

**Closed loop:** `G(s) = 2 Km K_B (Kp s + Ki) / [ s(τm s+1)(s² − ωp²) + 2 Km K_B (Kd s² + Kp s + Ki) ]` — 1st-order numerator, 4th-order denominator. Gains are placed by pole placement and rounded to 3 s.f.; every generated robot is verified: all poles have Re < −1, the PI zero −Ki/Kp never cancels a pole, so the CCF is **controllable (rank 4), observable (rank 4) and stable**. Checked on 500 random IDs, both CCF conventions.

**ML block = learned inverse actuator.** G(s) assumes torque = Km·V. The simulator's real motors have an H-bridge dead-zone (0.25–0.5 V), back-EMF (Ke = 0.20–0.35 V·s/rad) and a battery at 11.1 V instead of 12 V. The dataset (`V_cmd, omega_m, V_bat → duty`) comes from that real motor; the model the students train turns the controller's ideal voltage into the PWM duty that makes the real motor behave like the block in the diagram. Results on the default test (6° slope + 4 N pushes, 200 IDs): PI-only falls in 200/200; the reference model passes in 200/200 (Balance Index ≥ 85). In tests with scikit-learn equivalents, GPR, SVM and ensembles reach R² ≈ 0.996–0.9998 and pass; linear and quadratic regression get R² ≈ 0.985–0.994 and miss the ML mark.

**Model export.** `exportModelForWeb(trainedModel, 'ID')` evaluates `trainedModel.predictFcn` on a 41×41×5 grid and writes JSON; the page interpolates it, so any Regression Learner model type works. The file must carry the student's own ID.

**Balance Index** = 100 × cost(reference run) / cost(student run), cost = RMS tilt/1° + max tilt/5° + RMS tracking error/0.1 m + final error/0.1 m (0 if the robot falls).

## 6 · Limitations to know

- Grading runs in the browser. A student who edits the page's JavaScript could fake a result; per-student parameters, the answer key, and per-question overrides let you catch and correct it.
- A student's identity is tied to their browser (anonymous sign-in). Switching device creates a new request — you will see a duplicate-ID flag.
- The uploaded model is kept in that browser's local storage (only its R² and results go to the database).
- Use a recent Chrome/Edge/Firefox. Certificate: “Print / Save as PDF”, A4 landscape, margins none.
