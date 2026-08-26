import assert from "node:assert/strict";
import test from "node:test";
import { By, Key, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";

const WAIT_TIME = 10_000; 

function isClosedSessionError(error) {
  return (
    error?.name === "NoSuchSessionError" ||
    error?.name === "NoSuchWindowError" ||
    /invalid session|no such window|target window already closed/i.test(error?.message ?? "")
  );
}

async function openApp(testContext) {
  const application = await launchSkeletonPlotter();
  testContext.after(() => application.close());

  await application.driver.wait(
    until.elementLocated(By.css(".app-shell")),
    WAIT_TIME,
  );

  return application.driver;
}

async function waitForElementCount(driver, selector, expectedCount) {
  await driver.wait(async () => {
    const elements = await driver.findElements(By.css(selector));
    return elements.length === expectedCount;
  }, WAIT_TIME, `Expected ${expectedCount} elements matching ${selector}`);
}

async function buttonWithText(driver, text) {
  return driver.wait(
    until.elementLocated(By.xpath(`//button[normalize-space(.)=${JSON.stringify(text)}]`)),
    WAIT_TIME,
  );
}

async function waitForApplicationToClose(driver) {
  await driver.wait(async () => {
    try {
      return (await driver.getAllWindowHandles()).length === 0;
    } catch (error) {
      if (isClosedSessionError(error)) return true;
      throw error;
    }
  }, WAIT_TIME, "The unchanged application did not close");
}

test("launches the application with one blank individual and a 3D canvas", async (t) => {
  const driver = await openApp(t);

  assert.equal(await driver.getTitle(), "Untitled — Skeleton Plotter");
  await waitForElementCount(driver, ".individual", 1);
  await waitForElementCount(driver, ".coord-input", 75);

  const canvas = await driver.wait(until.elementLocated(By.css("canvas")), WAIT_TIME);
  const size = await canvas.getRect();
  assert.ok(size.width > 0, "the 3D canvas should have a positive width");
  assert.ok(size.height > 0, "the 3D canvas should have a positive height");
});

test("closes an unchanged application without showing the unsaved popup", async (t) => {
  const driver = await openApp(t);
  assert.equal(await driver.getTitle(), "Untitled — Skeleton Plotter");

  try {
    await driver.executeScript("window.close()");
  } catch (error) {
    if (!isClosedSessionError(error)) throw error;
  }

  await waitForApplicationToClose(driver);
});

test("accepts decimal coordinates, rejects letters, and updates progress", async (t) => {
  const driver = await openApp(t);
  const xInput = await driver.findElement(By.css('[aria-label="left knee, X"]'));
  const yInput = await driver.findElement(By.css('[aria-label="left knee, Y"]'));
  const zInput = await driver.findElement(By.css('[aria-label="left knee, Z"]'));

  await xInput.sendKeys("12.5");
  await yInput.sendKeys("4");
  await zInput.sendKeys("8.25");

  await driver.wait(async () => {
    const progress = await driver.findElement(By.css(".individual-header small")).getText();
    return progress === "1/25";
  }, WAIT_TIME);

  const selectAllKey = process.platform === "darwin" ? Key.COMMAND : Key.CONTROL;
  await xInput.sendKeys(Key.chord(selectAllKey, "a"), "letters");
  assert.equal(await xInput.getAttribute("value"), "12.5");
  assert.ok((await driver.getTitle()).startsWith("• "), "editing should mark the project dirty");
});

test("adds independent individuals with different default colours", async (t) => {
  const driver = await openApp(t);

  await (await buttonWithText(driver, "Add individual")).click();
  await waitForElementCount(driver, ".individual", 2);

  const individuals = await driver.findElements(By.css(".individual"));
  const firstLabel = await individuals[0].findElement(By.css('.label-input'));
  const secondLabel = await individuals[1].findElement(By.css('.label-input'));
  await firstLabel.sendKeys("Alice");
  await secondLabel.sendKeys("Bob");

  assert.equal(await firstLabel.getAttribute("value"), "Alice");
  assert.equal(await secondLabel.getAttribute("value"), "Bob");

  const firstColour = await individuals[0]
    .findElement(By.css('input[type="color"]'))
    .getAttribute("value");
  const secondColour = await individuals[1]
    .findElement(By.css('input[type="color"]'))
    .getAttribute("value");
  assert.notEqual(firstColour, secondColour);
});

test("deletes an additional individual while keeping the original", async (t) => {
  const driver = await openApp(t);

  await (await buttonWithText(driver, "Add individual")).click();
  await waitForElementCount(driver, ".individual", 2);

  const individuals = await driver.findElements(By.css(".individual"));
  await individuals[1].findElement(By.css(".label-input")).sendKeys("Second burial");
  await driver.findElement(By.css('[aria-label="Remove Second burial"]')).click();
  await waitForElementCount(driver, ".individual", 1);
  assert.equal(
    await driver.findElement(By.css(".individual .label-input")).getAttribute("value"),
    "",
  );
});

test("toggles the sidebar and collapses and expands an individual", async (t) => {
  const driver = await openApp(t);

  await driver.findElement(By.css('[aria-label="Hide sidebar"]')).click();
  const showSidebar = await driver.wait(
    until.elementLocated(By.css('[aria-label="Show sidebar"]')),
    WAIT_TIME,
  );
  assert.equal(
    await driver.findElement(By.id("individuals-sidebar")).getAttribute("aria-hidden"),
    "true",
  );

  await showSidebar.click();
  await waitForElementCount(driver, ".coord-input", 75);

  const individualHeader = await driver.findElement(By.css(".individual-header"));
  await driver.executeScript("arguments[0].click()", individualHeader);
  await waitForElementCount(driver, ".coord-input", 0);
  assert.equal(await individualHeader.getAttribute("aria-expanded"), "false");

  await driver.executeScript("arguments[0].click()", individualHeader);
  await waitForElementCount(driver, ".coord-input", 75);
  assert.equal(await individualHeader.getAttribute("aria-expanded"), "true");
});
