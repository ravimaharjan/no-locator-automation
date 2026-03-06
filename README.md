# No-Locator Automation

A small **research-oriented** automation project to explore how far a UI automation can go with **UI element discovery** without requiring Testers to write or maintain HTML locators (CSS, XPath, or IDs). The goal is to see how feasible it is to execute UI automation using only a **sequence of steps** and **labels/names** that users see on the screen.

## Highlight: No Locators, Just Steps

In this project, **you never specify HTML locators**. You only describe:

- **What** to do: Browse, Click, Input, Select, Upload, Wait.
- **Which** control by its visible or accessible name: e.g. `"Add Test"`, `"Project Name"`, `"Test Case Name"`.

Example TestCase file (`tests/create_test2.txt`):

```text
Browse "http://localhost:3000/#/test3"
Wait 1 secs
Click "Add Test"
Input "Project Name"
Input "Test Case Name"
Select "Test Type"
Select "Priority"
Click "Submit Test"
```

No selectors, no XPath, no CSS—only the **sequence of actions and the label/name** of each control. That is the main idea of this project.

## How It Works: Runtime Discovery via Strategies

Elements are **discovered at runtime** by trying a fixed **sequence of locator strategies** until one strategy returns **exactly one** matching element. The engine does not store or require pre-defined locators; it resolves the right element on the fly using Playwright’s role- and label-based APIs.

- **Strategy module:** [`src/discovery-resolver.js`](src/discovery-resolver.js)  
  This file defines and runs the discovery logic:
  - **`getStrategiesForAction(name, actionHint)`** – Builds an ordered list of strategies (e.g. `getByLabel`, `getByRole('button')`, `getByRole('textbox')`, `getByPlaceholder`) depending on the **action hint** (button, input, option/select, checkbox, fileupload, etc.).
  - **`resolveByDiscovery(page, { name, actionHint })`** – Loops over those strategies, counts matches for each; the first strategy that returns **exactly one** element is used. If none do, it throws.

So: **locators are not written by the user; they are implied by the strategy order** in `src/discovery-resolver.js`. The same “label” (e.g. `"Test Type"`) can resolve to different underlying selectors depending on how the page is built (e.g. native `<select>`, or a custom combobox), and the resolver adapts by trying the next strategy when the current one gives 0 or more than 1 match.

## Project Setup

### Prerequisites

- **Node.js** (v18+ recommended)
- **npm** (or another Node package manager)

### Installation

1. Clone or copy the project and go to the project folder:
   ```bash
   cd no-locator-automation
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Install Playwright browsers (if not already installed):
   ```bash
   npx playwright install chromium
   ```

### Running a Test

Use the **run** command with a **testcase** and a **data** file (e.g. Excel for input values). The CLI will:

1. Generate a config from the testcase + data (written by default to `output.json` in the **parent** folder of the project).
2. Run the test using that config.

**Command:**

```bash
node src/cli.js run --testcase=<path-to-testcase.txt> --data=<path-to-excel-data>
```

**Examples:**

```bash
# From project root, using the sample test and a data file
node src/cli.js run --testcase=tests/create_test2.txt --data=tests/data.xlsx
```

## Flow File Format

- **Browse** `"<url>"` – open a URL.
- **Click** `"<label>"` – click the element discovered by `<label>` (e.g. button/link).
- **Input** `"<label>"` – type into the element (e.g. textbox); value can come from the data file.
- **Select** `"<label>"` – choose an option in a dropdown/combobox; value can come from the data file.
- **Upload** `"<label>"` – file upload; path can come from the data file.
- **Wait N secs** – pause for N seconds.

**Data file (Excel):** Use column headers that **match the label names** in the testcase file (e.g. a step `Input "Project Name"` gets its value from the Excel column named `Project Name`). The first row of data is used for binding.

Labels are the **visible or accessible names** (e.g. button text, input labels). The **discovery-resolver** (`src/discovery-resolver.js`) decides how to find the element at runtime using its strategy list.
