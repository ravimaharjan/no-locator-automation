/**
 * Runtime UI discovery: resolves an element by trying multiple Playwright strategies
 * in sequence (getByLabel, getByRole with name, etc.) until exactly one match is found.
 * Used when Locator.type === 'discovery' (no static model / no stored locator).
 *
 * actionHint drives which role-based strategies are tried (e.g. 'option' → combobox, listbox, select).
 */


const DEFAULT_STRATEGY_TIMEOUT_MS = 2000;

/**
 * Builds an ordered list of "try this locator" strategies for a given (name, actionHint).
 * Each strategy is a function (page) => Locator.
 *
 * @param {string} name - Accessible name / label text (e.g. 'Award Type')
 * @param {string} [actionHint] - Control type hint: 'option' | 'input' | 'textarea' | 'button' | 'radiobutton' | 'checkbox' | 'fileupload' | undefined (generic)
 * @returns {Array<(page: import('playwright').Page) => import('playwright').Locator>}
 */
function getStrategiesForAction(name, actionHint) {
    const byLabel = (page) => page.getByLabel(name);
    const byRole = (page, role, options = {}) => page.getByRole(role, { name, ...options });

    const generic = [
        (page) => byLabel(page),
        (page) => byRole(page, 'button'),
        (page) => byRole(page, 'textbox'),
        (page) => byRole(page, 'combobox'),
        (page) => byRole(page, 'listbox'),
        (page) => byRole(page, 'menuitem'),
        (page) => byRole(page, 'link'),
        (page) => byRole(page, 'checkbox'),
        (page) => byRole(page, 'radio'),
    ];

    switch (actionHint) {
        case 'option':
        case 'select':
            return [
                // 1. Combobox with explicit accessible name (e.g. aria-label)
                (page) => page.getByRole('combobox', { name }),
                // 2. Combobox in same container as label – works when label is sibling (e.g. react-select without aria-label)
                (page) =>
                    page
                        .getByText(name, { exact: true })
                        .locator('xpath=..')
                        .getByRole('combobox'),
                (page) => byRole(page, 'combobox'),
                byLabel,
                (page) => byRole(page, 'listbox'),
                (page) => page.locator(`select[name="${name}"], select[id="${name}"]`).first(),
                (page) => byRole(page, 'button'), // custom dropdowns sometimes use button
            ];

        case 'input':
        case 'textarea':
            return [
                byLabel,
                (page) => byRole(page, 'textbox'),
                (page) => page.getByPlaceholder(name),
            ];
        case 'button':
            return [
                byLabel,
                (page) => byRole(page, 'button'),
                (page) => byRole(page, 'link'),
            ];
        case 'radiobutton':
            return [
                byLabel,
                (page) => byRole(page, 'radio'),
            ];
        case 'checkbox':
            return [
                byLabel,
                (page) => byRole(page, 'checkbox'),
            ];
        case 'fileupload':
            return [
                byLabel,
                (page) => page.getByLabel(name),
                (page) => page.locator(`input[type="file"]`).filter({ has: page.getByText(name) }).first(),
            ];
        default:
            return generic;
    }
}

/**
 * Tries each strategy in order; returns the first locator that resolves to exactly one element.
 * If a strategy matches 0 elements, the next strategy is tried. If it matches more than one, the next is tried (ambiguous).
 *
 * @param {import('playwright').Page} page - Playwright page
 * @param {object} opts - Options
 * @param {string} opts.name - Accessible name / label (e.g. 'Award Type')
 * @param {string} [opts.actionHint] - Control hint: 'option', 'input', 'button', etc.
 * @param {number} [opts.timeoutMs] - Timeout per strategy for counting (default 2000)
 * @returns {Promise<import('playwright').Locator>} Resolved Playwright locator (exactly one match)
 * @throws {Error} If no strategy yields exactly one match
 */
export async function resolveByDiscovery(page, { name, actionHint }, { timeoutMs = DEFAULT_STRATEGY_TIMEOUT_MS } = {}) {
    if (!name || typeof name !== 'string') {
        throw new Error('Discovery resolution requires a non-empty name (label/accessible name).');
    }

    const strategies = getStrategiesForAction(name.trim(), actionHint);
    const tried = [];

    for (let i = 0; i < strategies.length; i++) {
        const getLocator = strategies[i];
        const locator = getLocator(page);
        try {
            const count = await locator.count();
            if (count === 1) {
                console.log(`Discovery resolved "${name}" with strategy index ${i} (actionHint: ${actionHint || 'generic'}).`);
                return locator.first();
            }
            if (count > 1) {
                tried.push(`strategy[${i}] (${count} matches, ambiguous)`);
            }
        } catch (e) {
            tried.push(`strategy[${i}] (${e.message || e})`);
        }
    }

    throw new Error(
        `Discovery could not resolve a unique element for name="${name}" (actionHint=${actionHint || 'generic'}). Tried ${strategies.length} strategies.`
    );
}
