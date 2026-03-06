

import fs from 'fs';
import path from 'path';
import { readExcelData } from './excel.js';

function findRowValue(row, label) {
    if (row[label] !== undefined && row[label] !== '') return row[label];
    const lower = label.toLowerCase();
    const key = Object.keys(row).find((h) => h.toLowerCase() === lower);
    return key != null ? row[key] : '';
}

function bindExcelToSteps(Steps, data) {
    const row = data && data[0] ? data[0] : {};
    for (const step of Object.values(Steps)) {
        if (step.Type !== 'Event' || !step.Locator) continue;
        const loc = step.Locator;
        const label = loc.locatorValue;
        if (loc.value !== undefined) loc.value = String(findRowValue(row, label) ?? '');
        if (loc.file !== undefined) loc.file = String(findRowValue(row, label) ?? '');
    }
    return Steps;
}

/**
 * Read Test Case file and return JSON config.
 * @param {string} testcasePath - Path to Test Case file (.txt)
 * @returns {object} JSON config with FlowName, Data, StartAt, Steps
 */
function readDiscoveryFlow(testcasePath) {
    const content = fs.readFileSync(testcasePath, 'utf8');
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

    let flowName = 'discovery-flow';
    let dataRef = null;
    const steps = [];
    let stepIndex = 0;

    const actionToControlType = {
        browse: null, // special
        input: 'input',
        select: 'option',
        click: 'button',
        upload: 'fileupload',
    };

    for (const line of lines) {

        const browseMatch = line.match(/^(?:i\s+)?(browse)\s+"([^"]+)"\s*$/i);
        if (browseMatch) {
            stepIndex++;
            const stepName = `Step_${stepIndex}`;
            steps.push({
                stepName,
                Type: 'Browse',
                Url: browseMatch[2].trim(),
                Next: null,
            });
            continue;
        }

        const eventMatch = line.match(/^(?:i\s+)?(click|input|select|upload)\s+"([^"]+)"\s*$/i);
        if (eventMatch) {
            const action = eventMatch[1].toLowerCase();
            const label = eventMatch[2].trim();
            const controlType = actionToControlType[action];
            stepIndex++;
            const stepName = `Step_${stepIndex}`;

            const locator = {
                type: 'discovery',
                locatorValue: label,
                actionHint: controlType,
            };
            if (action === 'input' || action === 'select') locator.value = ''; // can be bound later
            if (action === 'upload') locator.file = '';

            steps.push({
                stepName,
                Type: 'Event',
                ControlType: controlType,
                Locator: locator,
                Next: null,
            });
            continue;
        }

        const waitMatch = line.match(/^wait\s+(\d+)\s+secs\s*$/i);
        if (waitMatch) {
            stepIndex++;
            steps.push({
                stepName: `Step_${stepIndex}`,
                Type: 'WaitTime',
                WaitTime: parseInt(waitMatch[1], 10) * 1000,
                Next: null,
            });
            continue;
        }
    }

    // Chain Next; add Exit step so last step has valid Next
    const exitStepName = 'Step_Exit';
    for (let i = 0; i < steps.length; i++) {
        steps[i].Next = i < steps.length - 1 ? steps[i + 1].stepName : exitStepName;
    }

    const Steps = {};
    for (const s of steps) {
        const { stepName, ...step } = s;
        Steps[stepName] = step;
    }
    Steps[exitStepName] = { Type: 'Exit' };

    const firstStepName = steps[0]?.stepName || 'Step_1';
    return {
        FlowName: flowName,
        Data: dataRef,
        StartAt: firstStepName,
        Steps,
    };
}

/**
 * Resolve data file path from variables (like testcase [Variables] + Data: [key]).
 * @param {string} dataKey - Key from Test Case: [dataKey]
 * @param {{ variables?: Object.<string,string>, dataBasePath?: string }} options
 * @returns {string|null} Resolved path or null
 */
function resolveDataFileFromVariables(dataKey, options) {
    if (!dataKey || !options.variables || typeof options.variables[dataKey] !== 'string')
        return null;
    let dataFile = options.variables[dataKey];
    if (options.dataBasePath && !path.isAbsolute(dataFile))
        dataFile = path.join(options.dataBasePath, dataFile);
    return dataFile;
}

/**
 * Read discovery flow and return JSON config. Optionally bind values from Excel.
 * @param {string} testcasePath - Path to Test Case file (.txt)
 * @param {string} [outputPath] - If set, write config JSON here
 * @param {{ dataFile?: string, variables?: Object.<string,string>, dataBasePath?: string }} [options]
 *   - dataFile: path to Excel (overrides variables)
 *   - variables: map like testcase [Variables] so Data: [key] resolves to variables[key]
 *   - dataBasePath: base path for relative paths in variables
 * @returns {Promise<object>} Config with StartAt, Steps (discovery locators, values filled if data bound)
 */
export async function parseDiscoveryFlow(testcasePath, outputPath, options = {}) {
    const config = readDiscoveryFlow(testcasePath);
    let dataFile = options.dataFile;
    if (!dataFile && config.Data)
        dataFile = resolveDataFileFromVariables(config.Data, options);
    if (dataFile) {
        const data = await readExcelData(dataFile);
        bindExcelToSteps(config.Steps, data);
    }
    if (outputPath) {
        const dir = path.dirname(outputPath);
        if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf8');
    }
    return config;
}

