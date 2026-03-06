/**
 * Resolve a step Locator to a Playwright locator.
 * Uses discovery-resolver: iterates over strategies until exactly one match.
 * @returns {Promise<import('playwright').Locator>}
 */
import { resolveByDiscovery } from '../discovery-resolver.js';

export async function getLocator(page, locator) {
  if (!locator || !locator.type) throw new Error('Locator must have type and locatorValue');
  const { type, locatorValue, actionHint } = locator;
  const name = locatorValue?.trim();
  if (!name && type !== 'css' && type !== 'xpath') throw new Error('locatorValue is required');

  return resolveByDiscovery(page, { name: locatorValue, actionHint });
}
