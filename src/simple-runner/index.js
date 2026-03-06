/**
 * Simple runner: loops through JSON steps and runs them with Playwright only.
 *
 * Usage: runSimple(page, testConfig)
 * testConfig: { Steps: { Step_1: { Type, ... }, Step_2: { ... }, ... } }
 */
import { executeStep } from './execute-step.js';

/**
 * Run all steps from testConfig by following the Next pointer from the first step.
 * @param {import('playwright').Page} page
 * @param {Object} testConfig - Must have testConfig.Steps (object keyed by step id)
 */
export async function run(page, testConfig) {
  if (!testConfig?.Steps || typeof testConfig.Steps !== 'object') {
    throw new Error('Config must contain Steps object.');
  }

  const steps = testConfig.Steps;
  const firstKey = Object.keys(steps)[0];
  if (!firstKey) {
    throw new Error('Steps object is empty.');
  }

  let currentStepId = firstKey;

  while (currentStepId) {
    const step = steps[currentStepId];
    if (!step) {
      throw new Error(`Step "${currentStepId}" is missing in the configuration.`);
    }

    const stepId = currentStepId;
    if (process.env.DEBUG === 'true') {
      console.log(`Executing Step: ${stepId}`);
    }

    const result = await executeStep(page, step);

    if (process.env.DEBUG === 'true') {
      console.log(`Completed Step: ${stepId}\n`);
    }
    await page.waitForTimeout(500);

    if (result === 'EXIT') {
      break;
    }

    // ConditionalCheck can return next step id from a condition
    if (typeof result === 'string' && steps[result]) {
      currentStepId = result;
    } else {
      currentStepId = step.Next || null;
    }
  }
}
