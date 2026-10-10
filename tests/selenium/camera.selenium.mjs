import assert from "node:assert/strict";
import test from "node:test";
import { By, Key, Origin, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";
import { WAIT, createBlankProject } from "./helpers.mjs";

async function openCameraApp(t) {
  const application = await launchSkeletonPlotter();
  t.after(() => application.close());

  const { driver } = application;
  await driver.wait(until.elementLocated(By.css(".app-shell")), WAIT);
  await createBlankProject(driver);
  await driver.wait(
    until.elementLocated(By.css('[data-testid="camera-dock"]')),
    WAIT,
  );

  return driver;
}

async function badgeText(driver) {
  return driver
    .wait(
      until.elementLocated(By.css('[data-testid="dock-view-label"]')),
      WAIT,
    )
    .getText();
}

async function waitForBadge(driver, expected) {
  await driver.wait(async () => {
    try {
      return (await badgeText(driver)) === expected;
    } catch {
      return false;
    }
  }, WAIT, `Expected the view badge to read ${expected}`);
}

/** Puts the caret somewhere harmless, so view shortcuts are not typing. */
async function blurActiveElement(driver) {
  await driver.executeScript("document.activeElement?.blur()");
}

test("the dock starts on free orbit with its controls present", async (t) => {
  const driver = await openCameraApp(t);

  assert.equal(await badgeText(driver), "Orbit");

  for (const testid of [
    "dock-orbit-gizmo",
    "dock-zoom-in",
    "dock-zoom-out",
    "dock-zoom-slider",
    "dock-pan",
    "dock-reset",
  ]) {
    assert.ok(
      await driver
        .findElement(By.css(`[data-testid="${testid}"]`))
        .isDisplayed(),
      testid,
    );
  }
});

test("number keys switch between the presets and back to orbit", async (t) => {
  const driver = await openCameraApp(t);
  await blurActiveElement(driver);

  await driver.actions().sendKeys("1").perform();
  await waitForBadge(driver, "Plan");

  await driver.actions().sendKeys("2").perform();
  await waitForBadge(driver, "Front");

  await driver.actions().sendKeys("3").perform();
  await waitForBadge(driver, "Side");

  await driver.actions().sendKeys("4").perform();
  await waitForBadge(driver, "Orbit");
});

// The view shortcuts are bare number keys, and so is every coordinate.
// Without the typing guard, entering 12.5 into a joint would switch to the
// plan view three times on the way.
test("typing coordinates does not change the view", async (t) => {
  const driver = await openCameraApp(t);
  await blurActiveElement(driver);

  await driver.actions().sendKeys("1").perform();
  await waitForBadge(driver, "Plan");

  const xInput = await driver.findElement(By.css(".coord-input"));

  await xInput.click();
  await xInput.sendKeys("12.5");

  assert.equal(await xInput.getAttribute("value"), "12.5");
  assert.equal(
    await badgeText(driver),
    "Plan",
    "typing a coordinate should not change the view",
  );
});

test("escape leaves the preset view", async (t) => {
  const driver = await openCameraApp(t);
  await blurActiveElement(driver);

  await driver.actions().sendKeys("2").perform();
  await waitForBadge(driver, "Front");

  await driver.actions().sendKeys(Key.ESCAPE).perform();
  await waitForBadge(driver, "Orbit");
});

test("zoom buttons move the slider in the right direction", async (t) => {
  const driver = await openCameraApp(t);
  const slider = () =>
    driver.findElement(By.css('[data-testid="dock-zoom-slider"]'));
  const sliderValue = async () =>
    Number(await (await slider()).getAttribute("value"));

  // Let any opening flight settle so the zoom reports have landed.
  await driver.sleep(1000);
  const before = await sliderValue();

  await (
    await driver.findElement(By.css('[data-testid="dock-zoom-in"]'))
  ).click();
  await driver.wait(async () => {
    try {
      return (await sliderValue()) > before;
    } catch {
      return false;
    }
  }, WAIT, "Zooming in should raise the slider");

  const zoomed = await sliderValue();

  await (
    await driver.findElement(By.css('[data-testid="dock-zoom-out"]'))
  ).click();
  await driver.wait(async () => {
    try {
      return (await sliderValue()) < zoomed;
    } catch {
      return false;
    }
  }, WAIT, "Zooming out should lower the slider");
});

test("orbiting on the gizmo leaves the preset", async (t) => {
  const driver = await openCameraApp(t);
  await blurActiveElement(driver);

  await driver.actions().sendKeys("1").perform();
  await waitForBadge(driver, "Plan");

  const gizmo = await driver.findElement(
    By.css('[data-testid="dock-orbit-gizmo"]'),
  );

  // A horizontal drag orbits far enough that the viewing direction must
  // change, which drops the preset back to free orbit.
  await driver
    .actions()
    .move({ origin: gizmo })
    .press()
    .move({ origin: Origin.POINTER, x: 60, y: 0 })
    .release()
    .perform();

  await waitForBadge(driver, "Orbit");
});

test("panning keeps the preset", async (t) => {
  const driver = await openCameraApp(t);
  await blurActiveElement(driver);

  await driver.actions().sendKeys("1").perform();
  await waitForBadge(driver, "Plan");

  // Arrow keys nudge the focused joystick without any pointer travel.
  const pan = await driver.findElement(By.css('[data-testid="dock-pan"]'));
  await pan.click();
  await pan.sendKeys(Key.ARROW_UP, Key.ARROW_RIGHT);
  await driver.sleep(500);

  assert.equal(
    await badgeText(driver),
    "Plan",
    "panning within a plan is still measuring that plan",
  );
});

test("reset returns the badge to orbit", async (t) => {
  const driver = await openCameraApp(t);
  await blurActiveElement(driver);

  await driver.actions().sendKeys("3").perform();
  await waitForBadge(driver, "Side");

  await (
    await driver.findElement(By.css('[data-testid="dock-reset"]'))
  ).click();
  await waitForBadge(driver, "Orbit");
});
