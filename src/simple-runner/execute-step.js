/**
 * Execute a single step from the JSON config. Uses Playwright only; no libcore.
 */
import { getLocator } from './locator.js';

const DEFAULT_WAIT_MS = 2000;

export async function executeStep(page, step) {
  const type = step?.Type;
  if (!type) throw new Error('Step must have Type');

  switch (type) {
    case 'Browse':
      await page.goto(step.Url, { waitUntil: 'load' });
      return undefined;

    case 'WaitTime': {
      const ms = step.WaitTime ?? 1000;
      await page.waitForTimeout(ms);
      return undefined;
    }

    case 'Message':
      if (step.Message) console.log(step.Message);
      return undefined;

    case 'Exit':
      return 'EXIT';

    case 'Event': {
      const loc = await getLocator(page, step.Locator);
      const controlType = (step.ControlType || '').toLowerCase();
      const value = step.Locator?.value ?? step.Locator?.file ?? '';

      if (controlType === 'button') {
        await loc.click();
      } else if (controlType === 'input' || controlType === 'textarea' || controlType === 'textbox') {
        await loc.fill(value);
      } else if (controlType === 'option' || controlType === 'select') {
        const isSelect = await loc.evaluate((el) => el.tagName === 'SELECT').catch(() => false);
        if (isSelect) {
          await loc.selectOption(value);
        } else {
          await loc.click();
          await page.getByRole('option', { name: value }).waitFor({ state: 'visible' });
          await page.getByRole('option', { name: value }).click();
        }
      } else if (controlType === 'checkbox' || controlType === 'radiobutton') {
        await loc.check();
      } else if (controlType === 'fileupload') {
        await loc.setInputFiles(value || step.Locator?.file || '');
      } else {
        await loc.click();
      }
      return undefined;
    }

    default:
      console.warn(`Unknown step type: ${type}`);
      return undefined;
  }
}

