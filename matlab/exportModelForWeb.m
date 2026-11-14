function outFile = exportModelForWeb(trainedModel, studentId, outFile)
%EXPORTMODELFORWEB  Export a Regression Learner model for the POWE445 web challenge.
%
%   exportModelForWeb(trainedModel, '20XXXXXXX')
%   exportModelForWeb(trainedModel, '20XXXXXXX', 'myfile.json')
%
%   trainedModel : struct exported from Regression Learner (Export -> Export Model)
%                  trained on POWE445_dataset_<ID>.csv with predictors
%                  V_cmd, omega_m, V_bat and response duty.
%   studentId    : your 9-digit university ID (char or string).
%
%   The function evaluates trainedModel.predictFcn on a fixed grid of the three
%   predictors and saves the grid as JSON (format POWE445-ML-GRID-v1). The web
%   page interpolates this grid, so ANY model type (linear, tree, SVM, GPR,
%   ensemble, neural network, kernel) works in the simulator.
%
%   POWE445 - Control Systems II, Beirut Arab University.  v1.0 - Y. Ajra

    studentId = char(string(studentId));
    if isempty(regexp(studentId, '^20\d{7}$', 'once'))
        error('POWE445:id', 'studentId must be 9 digits starting with 20, e.g. ''202312345''.');
    end
    if nargin < 3 || isempty(outFile)
        outFile = sprintf('POWE445_model_%s.json', studentId);
    end
    if ~isstruct(trainedModel) || ~isfield(trainedModel, 'predictFcn')
        error('POWE445:model', ['trainedModel must be the struct exported from Regression Learner ' ...
              '(Export -> Export Model). It needs a predictFcn field.']);
    end
    names = {'V_cmd', 'omega_m', 'V_bat'};
    if isfield(trainedModel, 'RequiredVariables')
        req = cellstr(trainedModel.RequiredVariables);
        missing = setdiff(req, names);
        if ~isempty(missing)
            error('POWE445:vars', ['The model expects variables {%s}. Import the CSV with readtable so the ' ...
                  'predictors are named V_cmd, omega_m, V_bat.'], strjoin(req, ', '));
        end
    end

    % ---- export grid (must match the web page: 41 x 41 x 5 points)
    vAx = linspace(-10, 10, 41);      % V_cmd   [V]
    wAx = linspace(-25, 25, 41);      % omega_m [rad/s]
    bAx = linspace(10.0, 12.6, 5);    % V_bat   [V]
    [Vg, Wg, Bg] = ndgrid(vAx, wAx, bAx);          % V_cmd varies fastest
    T = table(Vg(:), Wg(:), Bg(:), 'VariableNames', names);

    fprintf('Evaluating the model on %d grid points ...\n', height(T));
    y = trainedModel.predictFcn(T);
    y = double(y(:));
    if any(~isfinite(y))
        error('POWE445:nan', 'The model returned NaN/Inf on the export grid.');
    end
    y = round(y * 1e6) / 1e6;

    % ---- describe the model
    mtype = 'Regression Learner model';
    f = setdiff(fieldnames(trainedModel), {'predictFcn', 'RequiredVariables', 'About', 'HowToPredict'});
    k0 = find(cellfun(@(n) isobject(trainedModel.(n)), f), 1);
    if ~isempty(k0)
        obj = trainedModel.(f{k0});
        cls = class(obj);
        map = {'GP', 'Gaussian process regression'; 'SVM', 'Support vector machine'; ...
               'Ensemble', 'Ensemble of trees'; 'Tree', 'Regression tree'; ...
               'NeuralNetwork', 'Neural network'; 'Kernel', 'Kernel approximation'; ...
               'LinearModel', 'Linear regression'; 'RegressionLinear', 'Efficient linear'};
        for k = 1:size(map, 1)
            if contains(cls, map{k, 1}), mtype = map{k, 2}; break; end
        end
        try
            if contains(cls, 'GP'), mtype = sprintf('%s (%s kernel)', mtype, char(obj.KernelFunction)); end
            if contains(cls, 'SVM'), mtype = sprintf('%s (%s kernel)', mtype, char(obj.KernelParameters.Function)); end
            if contains(cls, 'Ensemble'), mtype = sprintf('%s (%s, %d learners)', mtype, char(obj.Method), obj.NumTrained); end
            if contains(cls, 'NeuralNetwork'), mtype = sprintf('%s (layers %s)', mtype, mat2str(obj.LayerSizes)); end
        catch
        end
    end

    S = struct('format', 'POWE445-ML-GRID-v1', 'studentId', studentId, 'modelType', mtype, ...
               'predictors', {names}, 'response', 'duty', ...
               'axes', struct('V_cmd', vAx, 'omega_m', wAx, 'V_bat', bAx), ...
               'values', y', 'created', char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm:ss')), ...
               'matlab', version);
    fid = fopen(outFile, 'w');
    if fid < 0, error('POWE445:file', 'Cannot write %s', outFile); end
    fprintf(fid, '%s', jsonencode(S));
    fclose(fid);
    fprintf('Saved %s  (%s, %d values, duty range [%.3f, %.3f])\n', outFile, mtype, numel(y), min(y), max(y));
    fprintf('Upload this file in stage 4 of the web challenge.\n');
end
