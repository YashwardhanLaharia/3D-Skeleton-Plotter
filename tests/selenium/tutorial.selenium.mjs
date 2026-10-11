import assert from "node:assert/strict";
import test from "node:test";
import { writeFile } from "node:fs/promises";
import { By, Key, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";

const WAIT = 10_000;
const STEPS = ["add-individual", "add-group", "individual", "coordinates", "split", "rig", "settings", "display", "offset", "camera", "view", "skeletons", "theme"];
const $ = (driver, selector) => driver.findElement(By.css(selector));

async function startTutorial(driver, startup = false) {
  await $(driver, startup ? '.startup-header button' : '.viewport-faq-toggle').click();
  await driver.wait(until.elementLocated(By.css('.help-center-header .btn-primary')), WAIT).click();
}

async function waitStep(driver, id) {
  await driver.wait(async () => {
    const panels = await driver.findElements(By.css(".help-tour-panel"));
    return panels.length && (await panels[0].getAttribute("data-step")) === id;
  }, WAIT, `Tutorial did not reach ${id}`);
  await driver.wait(async () => {
    const bounds = await $(driver, ".help-tour-spotlight").getRect();
    return bounds.width > 0 && !(await $(driver, ".help-tour-spotlight").getAttribute("class")).includes("spotlight-full");
  }, WAIT, `Missing highlight for ${id}`);
}

async function assertPanelVisible(driver) {
  const { panel, width, height } = await driver.executeScript(`
    const p = document.querySelector('.help-tour-panel').getBoundingClientRect();
    return { panel: { left: p.left, top: p.top, right: p.right, bottom: p.bottom }, width: innerWidth, height: innerHeight };
  `);
  assert.ok(panel.left >= 0 && panel.top >= 0 && panel.right <= width && panel.bottom <= height, "callout must stay inside window");
}

async function snapshot(driver, name) {
  if (process.env.SELENIUM_TOUR_SCREENSHOTS) {
    await writeFile(`${process.env.SELENIUM_TOUR_SCREENSHOTS}/${name}.png`, await driver.takeScreenshot(), "base64");
  }
}

async function projectData(driver) {
  return driver.executeScript(`return {
    values: Array.from(document.querySelectorAll('.sidebar input, .sidebar select')).map(e => [e.getAttribute('aria-label'), e.value, e.checked]),
    title: document.title, individuals: document.querySelectorAll('.individual').length
  };`);
}

test("guided tutorial highlights every step, accepts the settings click, and adapts to both themes", async (t) => {
  const app = await launchSkeletonPlotter();
  t.after(() => app.close());
  const driver = app.driver;
  await driver.wait(until.elementLocated(By.id("startup-create")), WAIT);
  await startTutorial(driver, true);
  await waitStep(driver, "home");
  await $(driver, ".help-tour-next").click();
  await driver.wait(until.elementLocated(By.id("startup-create")), WAIT).click();
  await driver.wait(until.elementLocated(By.id("confirm-grave-dimensions")), WAIT).click();
  await driver.wait(async () => (await driver.findElements(By.id("startup-screen"))).length === 0, WAIT);
  assert.equal((await driver.findElements(By.css('.viewport-tour-toggle'))).length, 0);

  for (const theme of ["light", "dark"]) {
    const actual = await driver.executeScript("return document.documentElement.dataset.bsTheme;");
    if (actual !== theme) await $(driver, ".viewport-theme-toggle").click();
    const before = await projectData(driver);
    await startTutorial(driver);
    for (let index = 0; index < STEPS.length; index += 1) {
      const id = STEPS[index];
      await waitStep(driver, id);
      await assertPanelVisible(driver);
      assert.equal(await $(driver, ".help-tour-label").getText(), `Guided tutorial · Step ${index + 1} of ${STEPS.length}`);
      if (id === "settings") {
        assert.equal(await $(driver, ".individual-settings-btn").getAttribute("aria-expanded"), "false");
        assert.equal(await $(driver, ".help-tour-next").getText(), "Skip this step");
        // Keyboard users can reach the highlighted gear from the tour navigation.
        await $(driver, ".help-tour-next").sendKeys(Key.TAB);
        assert.equal(await driver.executeScript("return document.activeElement.classList.contains('individual-settings-btn');"), true);
        await $(driver, ".individual-settings-btn").sendKeys(Key.ENTER);
        continue;
      }
      if (id === "display" || id === "offset") {
        assert.equal(await $(driver, ".individual-settings-btn").getAttribute("aria-expanded"), "true");
        await snapshot(driver, `${theme}-${id}`);
      }
      if (id === "theme") {
        assert.equal(await $(driver, ".help-tour-next").getText(), "Done");
        await $(driver, ".viewport-theme-toggle").click();
        assert.notEqual(await driver.executeScript("return document.documentElement.dataset.bsTheme;"), theme);
        await snapshot(driver, `${theme}-theme-switched`);
      }
      await $(driver, ".help-tour-next").click();
    }
    await driver.wait(async () => (await driver.findElements(By.css(".help-tour-panel"))).length === 0, WAIT);
    assert.deepEqual(await projectData(driver), before, "tour must not change recorded data or mark the project dirty");
  }

  // Back returns to a real settings action rather than automatically advancing.
  await startTutorial(driver);
  for (let i = 0; i < 6; i += 1) {
    await waitStep(driver, STEPS[i]);
    await $(driver, ".help-tour-next").click();
  }
  await waitStep(driver, "settings");
  await $(driver, ".individual-settings-btn").click();
  await waitStep(driver, "display");
  await $(driver, '.help-tour-footer .btn-outline-secondary').click();
  await waitStep(driver, "settings");
  assert.equal(await $(driver, ".individual-settings-btn").getAttribute("aria-expanded"), "false");
  await assertPanelVisible(driver);
  await snapshot(driver, "settings-after-back");
  await $(driver, ".help-tour-next").sendKeys(Key.ESCAPE);
  await driver.wait(async () => (await driver.findElements(By.css(".help-tour-panel"))).length === 0, WAIT);
  assert.equal(await driver.executeScript("return document.activeElement.classList.contains('viewport-faq-toggle');"), true);

  // A previously collapsed group must reveal its individual before targeting fields.
  await $(driver, '[data-tour="add-group"]').click();
  const group = await $(driver, '.individual-group-select');
  await group.findElement(By.css('option[value="grp-1"]')).click();
  await $(driver, '.sidebar-group-header .layers-collapse').sendKeys(Key.ENTER);
  await $(driver, '.sidebar-edge-toggle').click();
  await startTutorial(driver);
  await waitStep(driver, "add-individual");
  await $(driver, '.help-tour-next').click();
  await waitStep(driver, "add-group");
  await $(driver, '.help-tour-next').click();
  await waitStep(driver, "individual");
  await $(driver, '.help-tour-next').click();
  await waitStep(driver, "coordinates");
  await assertPanelVisible(driver);
  await $(driver, '.help-tour-close').click();
});
