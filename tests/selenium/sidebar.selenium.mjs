import assert from "node:assert/strict";
import test from "node:test";
import { By, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";
import {
  WAIT,
  createBlankProject,
  hideViewportPanels,
  setInputValue,
  waitForElementCount,
} from "./helpers.mjs";

async function openSidebarApp(t) {
  const application = await launchSkeletonPlotter();
  t.after(() => application.close());
  const { driver } = application;
  await driver.wait(until.elementLocated(By.css(".app-shell")), WAIT);
  await createBlankProject(driver);
  await hideViewportPanels(driver);
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

async function openIndividualSettings(driver) {
  const button = await driver.wait(
    until.elementLocated(By.css(".individual-settings-btn")),
    WAIT,
  );
  await driver.executeScript("arguments[0].click()", button);
  await driver.wait(
    until.elementLocated(By.css('[aria-label="Individual settings"]')),
    WAIT,
  );
}

async function coord(driver, ariaLabel) {
  return driver.wait(
    until.elementLocated(By.css(`[aria-label="${ariaLabel}"]`)),
    WAIT,
  );
}

async function fillKnee(driver, { x, y, z }) {
  for (const [axis, value] of Object.entries({ x, y, z })) {
    const input = await coord(driver, `left knee, ${axis.toUpperCase()}`);
    await input.clear();
    await input.sendKeys(value);
  }
}

test("creates a group, renames it, and assigns an individual", async (t) => {
  const driver = await openSidebarApp(t);

  const labelInput = await driver.findElement(By.css(".individual .label-input"));
  await setInputValue(driver, labelInput, "Alpha");

  await (await buttonWithText(driver, "Add group")).click();
  await waitForElementCount(driver, ".sidebar-group", 2); // named + Ungrouped

  const groupName = await driver.wait(
    until.elementLocated(By.css('input[aria-label="Group name"]')),
    WAIT,
  );
  await setInputValue(driver, groupName, "Cluster A");
  await driver.wait(async () => {
    return (await groupName.getAttribute("value")) === "Cluster A";
  }, WAIT);

  const groupSelect = await driver.findElement(
    By.css('.individual select[aria-label="Group"]'),
  );
  await driver.executeScript(
    `
      const select = arguments[0];
      const option = [...select.options].find(
        (entry) => entry.textContent.trim() === "Cluster A",
      );
      if (!option) throw new Error("Cluster A option missing");
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    `,
    groupSelect,
  );

  // Assigning re-parents the individual under the group, so re-query the select.
  await driver.wait(async () => {
    const select = await driver.findElement(
      By.css('.individual select[aria-label="Group"]'),
    );
    return (await select.getAttribute("value")).startsWith("grp-");
  }, WAIT, "individual should be assigned to the new group");

  const namedGroup = await driver.findElement(By.css(".sidebar-group"));
  assert.equal(
    await namedGroup.findElement(By.css(".label-input")).getAttribute("value"),
    "Alpha",
  );
  assert.match(
    await driver.findElement(By.css(".sidebar-group-empty")).getText(),
    /No skeletons in this group/,
  );
});

test("splits a joint and records inferior coordinates", async (t) => {
  const driver = await openSidebarApp(t);

  await fillKnee(driver, { x: "1", y: "2", z: "3" });
  await driver.wait(async () => {
    const progress = await driver
      .findElement(By.css(".individual-header small"))
      .getText();
    return progress === "1/25";
  }, WAIT);

  await driver
    .findElement(By.css('[aria-label="Expand left knee details"]'))
    .click();
  await driver.wait(
    until.elementLocated(By.css('[aria-label="left knee details"]')),
    WAIT,
  );
  await waitForElementCount(driver, '[aria-label="left knee, X"]', 0);

  assert.equal(
    await (await coord(driver, "left knee, superior, X")).getAttribute("value"),
    "1",
  );
  assert.equal(
    await (await coord(driver, "left knee, superior, Y")).getAttribute("value"),
    "2",
  );
  assert.equal(
    await (await coord(driver, "left knee, superior, Z")).getAttribute("value"),
    "3",
  );

  for (const [axis, value] of Object.entries({ x: "4", y: "5", z: "6" })) {
    const input = await coord(driver, `left knee, inferior, ${axis.toUpperCase()}`);
    await input.clear();
    await input.sendKeys(value);
  }

  assert.equal(
    await (await coord(driver, "left knee, inferior, X")).getAttribute("value"),
    "4",
  );
  assert.equal(
    await (await coord(driver, "left knee, inferior, Y")).getAttribute("value"),
    "5",
  );
  assert.equal(
    await (await coord(driver, "left knee, inferior, Z")).getAttribute("value"),
    "6",
  );
  assert.equal(
    await driver.findElement(By.css(".individual-header small")).getText(),
    "1/25",
  );

  await driver
    .findElement(By.css('[aria-label="Collapse left knee details"]'))
    .click();
  await waitForElementCount(driver, '[aria-label="left knee details"]', 0);
  assert.equal(
    await (await coord(driver, "left knee, X")).getAttribute("value"),
    "1",
  );
});

test("applies a coordinate offset and undoes it", async (t) => {
  const driver = await openSidebarApp(t);

  await fillKnee(driver, { x: "10", y: "20", z: "30" });
  await openIndividualSettings(driver);

  const offsetX = await coord(driver, "Offset, X");
  await offsetX.clear();
  await offsetX.sendKeys("1");
  await driver
    .findElement(By.css('[aria-label="Apply coordinate offset to every joint"]'))
    .click();

  await waitForElementCount(driver, '[aria-label="Individual settings"]', 0);
  assert.equal(
    await (await coord(driver, "left knee, X")).getAttribute("value"),
    "11",
  );
  assert.equal(
    await (await coord(driver, "left knee, Y")).getAttribute("value"),
    "20",
  );
  assert.equal(
    await (await coord(driver, "left knee, Z")).getAttribute("value"),
    "30",
  );

  await driver.findElement(By.css('[aria-label="Undo"]')).click();
  await driver.wait(async () => {
    return (
      (await (await coord(driver, "left knee, X")).getAttribute("value")) ===
      "10"
    );
  }, WAIT, "undo should restore the pre-offset knee X");
});

test("toggles Hide pelvis in settings and undoes it", async (t) => {
  const driver = await openSidebarApp(t);
  await openIndividualSettings(driver);

  const pelvis = await driver.findElement(
    By.xpath(
      `//*[@aria-label="Individual settings"]//label[contains(., "Hide pelvis")]//input`,
    ),
  );
  assert.equal(await pelvis.getAttribute("checked"), null);
  await pelvis.click();
  await driver.wait(async () => pelvis.isSelected(), WAIT);

  await driver.findElement(By.css('[aria-label="Undo"]')).click();
  await openIndividualSettings(driver);
  const restored = await driver.findElement(
    By.xpath(
      `//*[@aria-label="Individual settings"]//label[contains(., "Hide pelvis")]//input`,
    ),
  );
  assert.equal(await restored.isSelected(), false);
});
