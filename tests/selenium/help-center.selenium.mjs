import assert from "node:assert/strict";
import test from "node:test";
import { By, Key } from "selenium-webdriver";
import {
  WAIT,
  createBlankProject,
  openInspectedApp,
  waitForElementCount,
} from "./helpers.mjs";

async function projectData(driver) {
  return driver.executeScript(`return {
    title: document.title,
    fields: Array.from(document.querySelectorAll('.sidebar input, .sidebar select')).map(e => [e.value, e.checked]),
    individuals: document.querySelectorAll('.individual').length
  };`);
}

function luminance(rgb) {
  const values = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

test("FAQ works on Home and in both themes, and preserves project data", async (t) => {
  const { driver, clickMenuItem } = await openInspectedApp(t);

  await clickMenuItem("FAQ");
  await driver.wait(async () => (await driver.findElements(By.id("help-faq-title"))).length === 1, WAIT);
  assert.equal((await driver.findElements(By.css(".help-faq-item"))).length, 9);

  await driver.findElement(By.css(".help-faq-item summary")).click();
  assert.match(await driver.findElement(By.css(".help-faq-item p")).getText(), /floor RL|metres/);
  await driver.switchTo().activeElement().sendKeys(Key.ESCAPE);
  await waitForElementCount(driver, ".help-faq-panel", 0);

  await createBlankProject(driver);
  const before = await projectData(driver);

  for (const theme of ["light", "dark"]) {
    await driver.executeScript("document.documentElement.dataset.bsTheme = arguments[0]", theme);
    await clickMenuItem("FAQ");
    await waitForElementCount(driver, ".help-faq-item", 9);
    await driver.findElement(By.css(".help-faq-item summary")).click();

    const colors = await driver.executeScript(`return {
      text: getComputedStyle(document.querySelector('.help-faq-item p')).color,
      background: getComputedStyle(document.querySelector('.help-faq-panel')).backgroundColor
    };`);
    const levels = [luminance(colors.text), luminance(colors.background)].sort((a, b) => b - a);
    assert.ok((levels[0] + 0.05) / (levels[1] + 0.05) >= 4.5, "FAQ body text needs readable contrast");

    await driver.findElement(By.css(".help-faq-footer .btn-primary")).click();
    await waitForElementCount(driver, ".help-faq-panel", 0);
    assert.deepEqual(await projectData(driver), before);
  }

  await clickMenuItem("FAQ");
  await waitForElementCount(driver, ".help-faq-panel", 1);
  await driver.findElement(By.css(".help-close")).click();
  await waitForElementCount(driver, ".help-faq-panel", 0);
  assert.deepEqual(await projectData(driver), before);
});
