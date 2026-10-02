import assert from "node:assert/strict";
import test from "node:test";
import { By, Key, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";

const WAIT_TIME = 10_000;

async function openApp(testContext) {
  const application = await launchSkeletonPlotter();
  testContext.after(() => application.close());

  const driver = application.driver;

  await driver.wait(until.elementLocated(By.css(".app-shell")), WAIT_TIME);
  // The grave dimensions modal opens over the viewport on launch, and the view
  // controls sit underneath it.
  await driver.findElement(By.id("confirm-grave-dimensions")).click();

  return driver;
}

function presetButton(driver, label) {
  return driver.wait(
    until.elementLocated(By.xpath(`//button[normalize-space(.)=${JSON.stringify(label)}]`)),
    WAIT_TIME,
  );
}

async function isPressed(driver, label) {
  return (await presetButton(driver, label)).getAttribute("aria-pressed");
}

/** Puts the caret somewhere harmless, so view shortcuts are not treated as typing. */
async function blurActiveElement(driver) {
  await driver.executeScript("document.activeElement?.blur()");
}

test("the preset view controls start on free orbit", async (t) => {
  const driver = await openApp(t);

  for (const label of ["Plan", "Left", "Right"]) {
    assert.equal(await isPressed(driver, label), "false", label);
  }

  assert.equal(await isPressed(driver, "Orbit"), "true");
});

test("choosing a preset marks it active and only that one", async (t) => {
  const driver = await openApp(t);

  await (await presetButton(driver, "Plan")).click();

  assert.equal(await isPressed(driver, "Plan"), "true");
  assert.equal(await isPressed(driver, "Left"), "false");
  assert.equal(await isPressed(driver, "Orbit"), "false");

  await (await presetButton(driver, "Left")).click();

  assert.equal(await isPressed(driver, "Plan"), "false");
  assert.equal(await isPressed(driver, "Left"), "true");
});

test("choosing the active preset again returns to free orbit", async (t) => {
  const driver = await openApp(t);

  await (await presetButton(driver, "Right")).click();
  assert.equal(await isPressed(driver, "Right"), "true");

  await (await presetButton(driver, "Right")).click();
  assert.equal(await isPressed(driver, "Right"), "false");
  assert.equal(await isPressed(driver, "Orbit"), "true");
});

test("number keys switch between the presets and back to orbit", async (t) => {
  const driver = await openApp(t);
  await blurActiveElement(driver);

  await driver.actions().sendKeys("1").perform();
  assert.equal(await isPressed(driver, "Plan"), "true");

  await driver.actions().sendKeys("2").perform();
  assert.equal(await isPressed(driver, "Left"), "true");
  assert.equal(await isPressed(driver, "Plan"), "false");

  await driver.actions().sendKeys("3").perform();
  assert.equal(await isPressed(driver, "Right"), "true");

  await driver.actions().sendKeys("4").perform();
  assert.equal(await isPressed(driver, "Orbit"), "true");
  assert.equal(await isPressed(driver, "Right"), "false");
});

// The view shortcuts are bare number keys, and so is every coordinate. Without
// the typing guard, entering 12.5 into a joint would switch to the plan view
// three times on the way.
test("typing coordinates does not change the view", async (t) => {
  const driver = await openApp(t);

  await (await presetButton(driver, "Plan")).click();
  assert.equal(await isPressed(driver, "Plan"), "true");

  const kneeX = await driver.findElement(By.css('[aria-label="left knee, X"]'));

  await kneeX.click();
  await kneeX.sendKeys("12.5");

  assert.equal(await kneeX.getAttribute("value"), "12.5");
  assert.equal(
    await isPressed(driver, "Plan"),
    "true",
    "typing a coordinate should not change the view",
  );
});

test("escape leaves the preset view", async (t) => {
  const driver = await openApp(t);

  await (await presetButton(driver, "Left")).click();
  assert.equal(await isPressed(driver, "Left"), "true");

  await driver.actions().sendKeys(Key.ESCAPE).perform();

  assert.equal(await isPressed(driver, "Left"), "false");
  assert.equal(await isPressed(driver, "Orbit"), "true");
});