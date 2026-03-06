#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import process from 'process';
import { program } from 'commander';
import { chromium } from 'playwright';
import { run } from './simple-runner/index.js';
import { parseDiscoveryFlow } from './discovery-flow-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.dirname(__dirname);
/** Default config output: parent folder of no-locator-automation */
const DEFAULT_OUTPUT_PATH = path.join(path.dirname(PROJECT_ROOT), 'output.json');

let runConfigDefaults = { headless: false, viewPortWidth: 1280, viewPortHeight: 900, browserChannel: null };
try {
    const config = (await import('./config.js')).default;
    if (config) runConfigDefaults = { ...runConfigDefaults, ...config };
} catch {
    // no config.js – use defaults
}

program
    .name('jerry')
    .description('Jerry - No-code UI Automation Framework CLI Tool')
    .version('1.0.0');

async function readJSONFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
}

function getRunConfig(options = {}) {
    return {
        headless: options.headless ?? runConfigDefaults.headless,
        viewPortWidth: options.viewPortWidth ?? runConfigDefaults.viewPortWidth,
        viewPortHeight: options.viewPortHeight ?? runConfigDefaults.viewPortHeight,
        browserChannel: options.browserChannel ?? runConfigDefaults.browserChannel,
    };
}

// Run command: generate config (if --testcase + --data) then run config from output.json or --config
async function runConfigAction(options = {}) {
    let configPath = options.config;
    const testcasePath = options.testcase;
    const dataPath = options.data;

    if (testcasePath && dataPath) {
        // Generate config from discovery flow and data, write to default output.json (parent of project)
        const absoluteTestcase = path.isAbsolute(testcasePath)
            ? testcasePath
            : path.resolve(process.cwd(), testcasePath);
        const absoluteData = path.isAbsolute(dataPath)
            ? dataPath
            : path.resolve(process.cwd(), dataPath);
        try {
            await parseDiscoveryFlow(absoluteTestcase, DEFAULT_OUTPUT_PATH, {
                dataFile: absoluteData,
            });
        } catch (err) {
            console.error('Error generating config from discovery Test Case file:', err);
            process.exit(1);
        }
        configPath = DEFAULT_OUTPUT_PATH;
        console.log(`Generated config: ${configPath}`);
    }

    if (!configPath) {
        console.error('Error: use either --testcase and --data (generate and run) or --config <path> (run existing).');
        process.exit(1);
    }

    const absoluteConfigPath = path.isAbsolute(configPath)
        ? configPath
        : path.resolve(process.cwd(), configPath);

    let testConfig;
    try {
        testConfig = await readJSONFromFile(absoluteConfigPath);
    } catch (err) {
        console.error('Error loading config file:', err.message);
        process.exit(1);
    }
    if (!testConfig.Steps || typeof testConfig.Steps !== 'object') {
        console.error('Error: config file must contain Steps object.');
        process.exit(1);
    }
    if (options.debug !== undefined) process.env.DEBUG = options.debug ? 'true' : '';

    const runConfig = getRunConfig(options);
    const browser = await chromium.launch({
        headless: runConfig.headless,
        ...(runConfig.browserChannel && { channel: runConfig.browserChannel }),
    });
    const context = await browser.newContext({
        viewport:
            runConfig.viewPortWidth && runConfig.viewPortHeight
                ? { width: runConfig.viewPortWidth, height: runConfig.viewPortHeight }
                : { width: 1280, height: 900 },
        ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    console.log(`Running config: ${absoluteConfigPath}`);

    await run(page, testConfig);

    console.log('Run complete.');

    await browser.close();
}

program
    .command('run')
    .description('Generate config from Test Case file + data and run.')
    .option('--testcase <path>', 'Path to Test Case file (.txt)')
    .option('--data <path>', 'Path to data file (e.g. Excel) for binding')
    .option('--debug [value]', 'Enable debug mode', (value) => {
        if (value === undefined || value === '' || value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return true;
    })
    .action(async (options) => {
        try {
            await runConfigAction(options);
        } catch (err) {
            console.error(err || err);
            process.exit(1);
        }
    });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    program.outputHelp();
}
