import assert from "node:assert/strict";
import test from "node:test";
import { By, Key, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";
import {
  WAIT,
  createBlankProject,
  setInputValue,
  waitForElementCount,
} from "./helpers.mjs";

async function openLayersApp(t) {
  const application = await launchSkeletonPlotter();
  t.after(() => application.close());
  const { driver } = application;
  await driver.wait(until.elementLocated(By.css(".app-shell")), WAIT);
  await createBlankProject(driver);
  return driver;
}

async function buttonWithText(driver, text) {
  return driver.wait(
    until.elementLocated(
      By.xpath(`//button[normalize-space(.)=${JSON.stringify(text)}]`),
    ),
    WAIT,
  );
}

async function prepareTwoIndividuals(driver) {
  await (await buttonWithText(driver, "Add individual")).click();
  await waitForElementCount(driver, ".individual", 2);

  const labels = await driver.findElements(By.css(".individual .label-input"));
  await setInputValue(driver, labels[0], "Alpha");
  await setInputValue(driver, labels[1], "Beta");
}

async function expandLayersPanel(driver) {
  const toggle = await driver.wait(
    until.elementLocated(
      By.css('.layers-panel .layers-collapse[aria-controls="layers-list"]'),
    ),
    WAIT,
  );
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await driver.wait(until.elementLocated(By.css("#layers-list")), WAIT);
}

async function layerRow(driver, name, visibility) {
  return driver.wait(
    until.elementLocated(
      By.css(
        `button.layer-row[aria-label="${name}, ${visibility}"]`,
      ),
    ),
    WAIT,
  );
}

async function clickFocus(driver, name) {
  const button = await driver.wait(
    until.elementLocated(By.css(`[aria-label="Focus ${name}"]`)),
    WAIT,
  );
  // The focus control is opacity:0 until hover; script-click still works.
  await driver.executeScript("arguments[0].click()", button);
}

test("layers panel lists individuals; hide and Show all restore visibility", async (t) => {
  const driver = await openLayersApp(t);
  await prepareTwoIndividuals(driver);
  await expandLayersPanel(driver);

  await layerRow(driver, "Alpha", "visible");
  await layerRow(driver, "Beta", "visible");
  assert.match(
    await driver.findElement(By.css(".layers-panel .layers-count")).getText(),
    /\(2\/2\)/,
  );

  // Layer rows debounce single-clicks (~250ms) so a double-click can focus alone.
  await (await layerRow(driver, "Alpha", "visible")).click();
  await layerRow(driver, "Alpha", "hidden");
  assert.match(
    await driver.findElement(By.css(".layers-panel .layers-count")).getText(),
    /\(1\/2\)/,
  );

  const showAll = await driver.wait(
    until.elementLocated(By.css(".layers-show-all")),
    WAIT,
  );
  assert.match(await showAll.getText(), /Show all \(1\)/);
  await showAll.click();

  await layerRow(driver, "Alpha", "visible");
  await layerRow(driver, "Beta", "visible");
  await waitForElementCount(driver, ".layers-show-all", 0);
  assert.match(
    await driver.findElement(By.css(".layers-panel .layers-count")).getText(),
    /\(2\/2\)/,
  );
});

test("focus shows the focus bar and inspection panel; Exit restores the overview", async (t) => {
  const driver = await openLayersApp(t);
  await prepareTwoIndividuals(driver);
  await expandLayersPanel(driver);

  await clickFocus(driver, "Alpha");

  const focusBar = await driver.wait(
    until.elementLocated(By.css(".focus-bar")),
    WAIT,
  );
  assert.match(await focusBar.getText(), /Focused:\s*Alpha/);

  const inspection = await driver.wait(
    until.elementLocated(By.css(".inspection-panel")),
    WAIT,
  );
  assert.match(await inspection.getText(), /Measurements/);
  assert.match(await inspection.getText(), /points recorded/);

  await driver.wait(
    until.elementLocated(By.css('[aria-label="Exit focus on Alpha"]')),
    WAIT,
  );

  await driver.findElement(By.css(".focus-bar-exit")).click();

  await waitForElementCount(driver, ".focus-bar", 0);
  await waitForElementCount(driver, ".inspection-panel", 0);
  await expandLayersPanel(driver);
  await layerRow(driver, "Alpha", "visible");
  await layerRow(driver, "Beta", "visible");
});

test("Escape exits focus mode", async (t) => {
  const driver = await openLayersApp(t);
  await prepareTwoIndividuals(driver);
  await expandLayersPanel(driver);

  await clickFocus(driver, "Beta");
  await driver.wait(until.elementLocated(By.css(".focus-bar")), WAIT);
  assert.match(
    await driver.findElement(By.css(".focus-bar-label")).getText(),
    /Focused:\s*Beta/,
  );

  await driver.actions().sendKeys(Key.ESCAPE).perform();

  await waitForElementCount(driver, ".focus-bar", 0);
  await waitForElementCount(driver, ".inspection-panel", 0);
});
