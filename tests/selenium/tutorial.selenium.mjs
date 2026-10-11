import assert from "node:assert/strict";
import test from "node:test";
import { By, Key } from "selenium-webdriver";
import {
  WAIT,
  createBlankProject,
  hideViewportPanels,
  openInspectedApp,
  waitForElementCount,
} from "./helpers.mjs";

const PROJECT_STEPS = [
  "Start with a project",
  "Add an individual",
  "Organise individuals into groups",
  "Label, colour and landmark count",
  "Enter surveyed coordinates",
  "Record separated bone ends",
  "How the skeleton rig works",
  "Show, hide and focus skeletons",
  "Open this individual’s settings",
  "Offset all joints",
  "Choose which torso parts to display",
  "View the excavation context",
  "Undo edits, save and export",
];

const WORKSPACE_STEPS = PROJECT_STEPS.slice(1);

async function waitForStep(driver, title) {
  await driver.wait(async () => {
    const elements = await driver.findElements(By.id("help-tour-title"));
    return elements.length && (await elements[0].getText()) === title;
  }, WAIT, `Expected guide step: ${title}`);
  await driver.wait(async () => (await driver.findElements(By.css(".help-tour-highlight"))).length === 1, WAIT);
}

async function next(driver) {
  await driver.findElement(By.css(".help-tour-footer .btn-primary")).click();
}

async function assertPanelVisible(driver) {
  const { panel, width, height } = await driver.executeScript(`
    const p = document.querySelector('.help-tour-panel').getBoundingClientRect();
    return { panel: { left: p.left, top: p.top, right: p.right, bottom: p.bottom }, width: innerWidth, height: innerHeight };
  `);
  assert.ok(panel.left >= 0 && panel.top >= 0 && panel.right <= width + 1 && panel.bottom <= height + 1, "callout must stay inside window");
}

async function projectData(driver) {
  return driver.executeScript(`return {
    values: Array.from(document.querySelectorAll('.sidebar input, .sidebar select')).map(e => [e.getAttribute('aria-label'), e.value, e.checked]),
    title: document.title, individuals: document.querySelectorAll('.individual').length
  };`);
}

test("guided tutorial highlights every step, accepts the settings click, and adapts to both themes", async (t) => {
  const { driver, clickMenuItem } = await openInspectedApp(t);

  await clickMenuItem("Guide");
  await waitForStep(driver, "Start with a project");
  assert.equal(await driver.findElement(By.css(".help-tour-progress")).getText(), `Step 1 of ${PROJECT_STEPS.length}`);
  assert.equal(await driver.findElement(By.css(".help-tour-footer .btn-primary")).isEnabled(), false);
  await createBlankProject(driver);
  await waitForStep(driver, "Add an individual");
  assert.equal(await driver.findElement(By.css(".help-tour-progress")).getText(), `Step 2 of ${PROJECT_STEPS.length}`);
  await driver.switchTo().activeElement().sendKeys(Key.ESCAPE);
  await waitForElementCount(driver, ".help-tour", 0);

  for (const theme of ["light", "dark"]) {
    await driver.executeScript("document.documentElement.dataset.bsTheme = arguments[0]", theme);
    await clickMenuItem("Guide");
    await waitForStep(driver, "Add an individual");
    const before = await projectData(driver);

    for (let index = 0; index < WORKSPACE_STEPS.length; index += 1) {
      const title = WORKSPACE_STEPS[index];
      await waitForStep(driver, title);
      await assertPanelVisible(driver);
      assert.equal(await driver.findElement(By.css(".help-tour-progress")).getText(), `Step ${index + 1} of ${WORKSPACE_STEPS.length}`);
      assert.equal(await driver.findElement(By.css(".help-tour-label")).getText(), "Skeleton Plotter guide");

      if (title === "Open this individual’s settings") {
        assert.equal(await driver.findElement(By.css(".help-tour-footer .btn-primary")).isEnabled(), false);
        const gear = await driver.findElement(By.css('[data-guide="settings"]'));
        await gear.sendKeys(Key.ENTER);
        continue;
      }

      if (title === "Offset all joints" || title === "Choose which torso parts to display") {
        assert.equal(await driver.findElement(By.css('[data-guide="settings"]')).getAttribute("aria-expanded"), "true");
      }

      if (title === "Undo edits, save and export") {
        await driver.findElement(By.css(".help-tour-footer .btn-primary")).click();
        break;
      }
      await next(driver);
    }

    await waitForElementCount(driver, ".help-tour", 0);
    assert.deepEqual(await projectData(driver), before, "tour must not change recorded data or mark the project dirty");
  }

  // Back returns to a real settings action rather than automatically advancing.
  await clickMenuItem("Guide");
  for (const title of WORKSPACE_STEPS.slice(0, 7)) {
    await waitForStep(driver, title);
    await next(driver);
  }
  await waitForStep(driver, "Open this individual’s settings");
  await driver.findElement(By.css('[data-guide="settings"]')).sendKeys(Key.ENTER);
  await waitForStep(driver, "Offset all joints");
  await driver.findElement(By.css(".help-tour-footer .btn-outline-secondary")).click();
  await waitForStep(driver, "Open this individual’s settings");
  assert.equal(await driver.findElement(By.css('[data-guide="settings"]')).getAttribute("aria-expanded"), "false");
  await assertPanelVisible(driver);
  await driver.switchTo().activeElement().sendKeys(Key.ESCAPE);
  await waitForElementCount(driver, ".help-tour", 0);

  // A previously collapsed group must reveal its individual before targeting fields.
  await hideViewportPanels(driver);
  await driver.findElement(By.css('[data-guide="add-group"]')).click();
  const group = await driver.findElement(By.css('.individual select[aria-label="Group"]'));
  await driver.executeScript(
    "arguments[0].value = 'grp-1'; arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
    group,
  );
  await driver.findElement(By.css(".sidebar-group-header .layers-collapse")).sendKeys(Key.ENTER);
  await driver.findElement(By.css(".sidebar-edge-toggle")).click();
  await clickMenuItem("Guide");
  await waitForStep(driver, "Add an individual");
  await next(driver);
  await waitForStep(driver, "Organise individuals into groups");
  await next(driver);
  await waitForStep(driver, "Label, colour and landmark count");
  await next(driver);
  await waitForStep(driver, "Enter surveyed coordinates");
  await assertPanelVisible(driver);
  await driver.findElement(By.css(".help-close")).click();
  await waitForElementCount(driver, ".help-tour", 0);
});
