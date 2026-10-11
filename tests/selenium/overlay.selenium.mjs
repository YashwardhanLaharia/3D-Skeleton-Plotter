import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { By, until } from "selenium-webdriver";
import {
  WAIT,
  createBlankProject,
  openInspectedApp,
  waitForNotice,
} from "./helpers.mjs";

const EXAMPLE_PNG = path.join(
  fileURLToPath(new URL("./file-imports/", import.meta.url)),
  "example.png",
);

async function expandViewPanel(driver) {
  const toggle = await driver.wait(
    until.elementLocated(By.css('button[aria-controls="graves-list"]')),
    WAIT,
  );
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await driver.wait(
    until.elementLocated(By.css('section[aria-label="Grave contours"]')),
    WAIT,
  );
}

async function openOverlayApp(t) {
  const app = await openInspectedApp(t);
  await createBlankProject(app.driver);

  async function loadPhotograph(filePath) {
    await expandViewPanel(app.driver);
    await app.mockOpenDialog({ filePaths: [filePath] });
    await app.driver
      .findElement(By.css('section[aria-label="Site photograph"] .graves-import'))
      .click();
    await waitForNotice(app.driver, "Photograph loaded. Enter its grid alignment.");
  }

  return { ...app, loadPhotograph };
}

async function openSettings(driver) {
  await expandViewPanel(driver);
  const button = await driver.wait(
    until.elementLocated(By.css('[aria-label="Photograph settings"]')),
    WAIT,
  );
  await driver.executeScript("arguments[0].click()", button);
  await driver.wait(until.elementLocated(By.id("overlay-settings-title")), WAIT);
}

async function closeSettings(driver) {
  const close = await driver.findElement(By.css(".modal-open button.btn-close"));
  await driver.executeScript("arguments[0].click()", close);
  await driver.wait(async () => {
    const titles = await driver.findElements(By.id("overlay-settings-title"));
    return titles.length === 0;
  }, WAIT, "Settings modal did not close");
}

async function opacityLabel(driver) {
  const label = await driver.findElement(
    By.xpath(
      `//*[@id="overlay-settings-title"]/ancestor::div[contains(@class,"modal-content")]//label[contains(., "Opacity:")]`,
    ),
  );
  return label.getText();
}

async function setOpacityRange(driver, value) {
  const range = await driver.findElement(
    By.css('.modal-open input.form-range[type="range"]'),
  );
  await driver.executeScript(
    `
      const element = arguments[0];
      const next = arguments[1];
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      valueSetter.call(element, next);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    `,
    range,
    String(value),
  );
}

async function heightInput(driver) {
  return driver.findElement(
    By.xpath(
      `//label[contains(., "Height above grave floor")]//input`,
    ),
  );
}

test("photograph settings can change opacity and it persists after reopen", async (t) => {
  const { driver, loadPhotograph } = await openOverlayApp(t);
  await loadPhotograph(EXAMPLE_PNG);

  assert.match(
    await driver
      .findElement(By.css('section[aria-label="Site photograph"] .graves-photo-body'))
      .getText(),
    /example\.png/,
  );

  await openSettings(driver);
  assert.match(await opacityLabel(driver), /Opacity:\s*70%/);

  await setOpacityRange(driver, 0.35);
  await driver.wait(async () => {
    return /Opacity:\s*35%/.test(await opacityLabel(driver));
  }, WAIT, "Opacity label should update immediately");

  await closeSettings(driver);
  await openSettings(driver);
  assert.match(await opacityLabel(driver), /Opacity:\s*35%/);
  await closeSettings(driver);
});

test("alignment Apply updates height above the grave floor", async (t) => {
  const { driver, loadPhotograph } = await openOverlayApp(t);
  await loadPhotograph(EXAMPLE_PNG);
  await openSettings(driver);

  const height = await heightInput(driver);
  const before = await height.getAttribute("value");
  assert.ok(before !== undefined);

  await driver.executeScript(
    `
      const element = arguments[0];
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      valueSetter.call(element, "0.25");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    `,
    height,
  );
  await driver
    .findElement(By.xpath(`//button[normalize-space(.)="Apply alignment"]`))
    .click();

  await closeSettings(driver);
  await openSettings(driver);
  assert.equal(await (await heightInput(driver)).getAttribute("value"), "0.25");
  await closeSettings(driver);
});

test("hiding then showing the photograph again updates the View panel", async (t) => {
  const { driver, loadPhotograph } = await openOverlayApp(t);
  await loadPhotograph(EXAMPLE_PNG);

  await openSettings(driver);
  const showToggle = await driver.findElement(
    By.xpath(
      `//*[@id="overlay-settings-title"]/ancestor::div[contains(@class,"modal-content")]//label[contains(., "Show photograph")]//input`,
    ),
  );
  assert.equal(await showToggle.isSelected(), true);
  await driver.executeScript("arguments[0].click()", showToggle);
  await driver.wait(async () => !(await showToggle.isSelected()), WAIT);
  await closeSettings(driver);

  const photoBody = await driver.findElement(
    By.css('section[aria-label="Site photograph"] .graves-photo-body p'),
  );
  assert.match(await photoBody.getAttribute("class"), /line-through/);

  await openSettings(driver);
  const showAgain = await driver.findElement(
    By.xpath(
      `//*[@id="overlay-settings-title"]/ancestor::div[contains(@class,"modal-content")]//label[contains(., "Show photograph")]//input`,
    ),
  );
  await driver.executeScript("arguments[0].click()", showAgain);
  await driver.wait(async () => showAgain.isSelected(), WAIT);
  await closeSettings(driver);

  assert.equal(
    /line-through/.test(await photoBody.getAttribute("class")),
    false,
  );
});
