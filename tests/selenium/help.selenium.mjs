import assert from "node:assert/strict";
import test from "node:test";
import { By, Key } from "selenium-webdriver";
import { WAIT, createBlankProject, openInspectedApp, waitForElementCount } from "./helpers.mjs";

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

async function checkCardAndHighlight(driver, targetSelector) {
  await driver.wait(async () => driver.executeScript(`
    const panel = document.querySelector('.help-tour-panel').getBoundingClientRect();
    const highlight = document.querySelector('.help-tour-highlight').getBoundingClientRect();
    const target = document.querySelector(arguments[0]).getBoundingClientRect();
    return panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth + 1 && panel.bottom <= innerHeight + 1
      && Math.abs(highlight.left - Math.max(0, target.left - 5)) < 2
      && Math.abs(highlight.top - Math.max(0, target.top - 5)) < 2;
  `, targetSelector), WAIT, "Guide card should fit and its highlight should track the target");
}

test("Help menu guide waits for project and settings, follows controls and leaves data untouched", async (t) => {
  const { driver, clickMenuItem, evaluate } = await openInspectedApp(t);
  const menu = await evaluate(`process.mainModule.require('electron').Menu.getApplicationMenu().items.map(item => ({ label: item.label, children: item.submenu?.items.map(child => child.label) }))`);
  assert.equal(menu.findIndex((item) => item.label === "Help"), menu.findIndex((item) => item.label === "Export") + 1);
  assert.deepEqual(menu.find((item) => item.label === "Help").children, ["Guide", "FAQ"]);

  await clickMenuItem("Guide");
  await waitForStep(driver, "Start with a project");
  assert.equal(await driver.findElement(By.css(".help-tour-progress")).getText(), "Step 1 of 13");
  assert.equal(await driver.findElement(By.css(".help-tour-footer .btn-primary")).isEnabled(), false);
  await createBlankProject(driver);
  await waitForStep(driver, "Add an individual");

  for (const title of ["Organise individuals into groups", "Label, colour and landmark count", "Enter surveyed coordinates", "Record separated bone ends", "How the skeleton rig works", "Show, hide and focus skeletons", "Open this individual’s settings"]) {
    await next(driver);
    await waitForStep(driver, title);
  }
  assert.equal(await driver.findElement(By.css(".help-tour-progress")).getText(), "Step 9 of 13");
  assert.equal(await driver.findElement(By.css(".help-tour-footer .btn-primary")).isEnabled(), false);
  await checkCardAndHighlight(driver, '[data-guide="settings"]');
  // Exercise real keyboard activation rather than bypassing the spotlight.
  const gear = await driver.findElement(By.css('[data-guide="settings"]'));
  await gear.sendKeys(Key.ENTER);
  await waitForStep(driver, "Offset all joints");
  await checkCardAndHighlight(driver, '[data-guide="offset"]');
  await next(driver);
  await waitForStep(driver, "Choose which torso parts to display");
  await checkCardAndHighlight(driver, '[data-guide="display"]');

  for (const theme of ["light", "dark"]) {
    await driver.executeScript("document.documentElement.dataset.bsTheme = arguments[0]", theme);
    let contrasts;
    // Bootstrap animates button colours; measure after the theme settles.
    await driver.wait(async () => {
      contrasts = await driver.executeScript(`
      const rgb = value => value.match(/[\\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 });
      const lum = value => { const c = rgb(value); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
      const panel = getComputedStyle(document.querySelector('.help-tour-panel'));
      const back = getComputedStyle(document.querySelector('.help-tour-footer .btn-outline-secondary'));
      const b = lum(panel.backgroundColor);
      return [panel.color, back.color].map(color => {
        const a = lum(color);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
      `);
      return contrasts.every((contrast) => contrast >= 4.5);
    }, WAIT, `${theme} guide and Back button should have accessible text contrast`);
    for (const contrast of contrasts) assert.ok(contrast >= 4.5, `${theme} guide text and Back button contrast: ${contrast}`);
  }
  await next(driver);
  await waitForStep(driver, "View the excavation context");
  await waitForElementCount(driver, ".individual-settings-popup", 0);
  await next(driver);
  await waitForStep(driver, "Undo edits, save and export");
  await next(driver);
  await waitForElementCount(driver, ".help-tour", 0);
  const values = await driver.findElements(By.css(".individual .coord-input"));
  for (const input of values) assert.equal(await input.getAttribute("value"), "");
  assert.equal(await driver.findElement(By.css(".individual-header small")).getText(), "0/25");
});

test("Guide reopens with a count, tracks resized targets and supports Back and Escape; FAQ opens on Home", async (t) => {
  const { driver, clickMenuItem, evaluate } = await openInspectedApp(t);
  await clickMenuItem("FAQ");
  await driver.wait(async () => (await driver.findElements(By.id("help-faq-title"))).length === 1, WAIT);
  assert.equal((await driver.findElements(By.css(".help-faq-item"))).length, 9);
  await driver.findElement(By.css(".help-faq-item summary")).click();
  assert.match(await driver.findElement(By.css(".help-faq-item p")).getText(), /floor RL/);
  await driver.switchTo().activeElement().sendKeys(Key.ESCAPE);
  await waitForElementCount(driver, ".help-faq-panel", 0);
  await createBlankProject(driver);
  await clickMenuItem("Guide");
  await waitForStep(driver, "Add an individual");
  assert.equal(await driver.findElement(By.css(".help-tour-progress")).getText(), "Step 1 of 12");
  await next(driver);
  await waitForStep(driver, "Organise individuals into groups");
  // Electron does not expose Chrome's Browser.getWindowForTarget command.
  await evaluate(`(() => {
    const window = process.mainModule.require('electron').BrowserWindow.getAllWindows().find(window => window.getTitle().endsWith('Skeleton Plotter'));
    window.unmaximize();
    window.setSize(900, 700);
  })()`);
  await checkCardAndHighlight(driver, '[data-guide="add-group"]');
  await driver.findElement(By.css(".help-tour-footer .btn-outline-secondary")).click();
  await waitForStep(driver, "Add an individual");
  await driver.switchTo().activeElement().sendKeys(Key.ESCAPE);
  await waitForElementCount(driver, ".help-tour", 0);
});
