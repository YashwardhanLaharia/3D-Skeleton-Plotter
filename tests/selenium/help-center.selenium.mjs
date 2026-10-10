import assert from "node:assert/strict";
import test from "node:test";
import { writeFile } from "node:fs/promises";
import { By, Key, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";

const WAIT = 10_000;
const $ = (driver, selector) => driver.findElement(By.css(selector));
const count = async (driver, selector, number) => driver.wait(async () =>
  (await driver.findElements(By.css(selector))).length === number, WAIT);
const topic = (driver, label) => driver.findElement(By.xpath(`//nav[@aria-label='Help topics']/button[normalize-space(.)='${label}']`));

async function capture(driver, name) {
  if (process.env.SELENIUM_HELP_SCREENSHOTS) {
    await writeFile(`${process.env.SELENIUM_HELP_SCREENSHOTS}/${name}.png`, await driver.takeScreenshot(), "base64");
  }
}

async function projectData(driver) {
  return driver.executeScript(`return {
    title: document.title,
    fields: Array.from(document.querySelectorAll('.sidebar input, .sidebar select')).map(e => [e.value, e.checked]),
    individuals: document.querySelectorAll('.individual').length
  };`);
}

function luminance(rgb) {
  const values = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

test("FAQ works on Home and in both themes, supports search and shortcuts, and preserves project data", async (t) => {
  const app = await launchSkeletonPlotter();
  t.after(() => app.close());
  const { driver } = app;
  await driver.wait(until.elementLocated(By.id("startup-create")), WAIT);
  await driver.findElement(By.xpath("//header[contains(@class,'startup-header')]//button[normalize-space(.)='Help & FAQ']")).click();
  await driver.wait(until.elementLocated(By.css('.help-center')), WAIT);
  await count(driver, '.help-faq', 20);
  assert.equal(await driver.executeScript("return document.activeElement.id;"), 'help-search');
  assert.equal(await driver.executeScript("return document.querySelector('#startup-screen').inert;"), true);
  await $(driver, '#help-search').sendKeys('0.10');
  await count(driver, '.help-faq', 1);
  const offset = await $(driver, '[data-faq="offset-joints"]');
  assert.equal(await offset.getAttribute('open'), 'true');
  assert.match(await offset.getText(), /blank joint value counts as zero/);
  await $(driver, '#help-search').sendKeys(Key.ESCAPE);
  await count(driver, '.help-center', 0);
  assert.equal(await driver.executeScript("return document.querySelector('#startup-screen').inert;"), false);
  assert.equal(await driver.executeScript("return document.activeElement.textContent.trim();"), 'Help & FAQ');

  await $(driver, '#startup-create').click();
  await driver.wait(until.elementLocated(By.id('confirm-grave-dimensions')), WAIT).click();
  await count(driver, '#startup-screen', 0);
  const before = await projectData(driver);

  for (const theme of ['light', 'dark']) {
    const current = await driver.executeScript('return document.documentElement.dataset.bsTheme;');
    if (current !== theme) await $(driver, '.viewport-theme-toggle').click();
    await $(driver, '.viewport-faq-toggle').click();
    await count(driver, '.help-faq', 20);
    await topic(driver, 'Coordinates & rigs').click();
    await count(driver, '.help-faq', 9);
    await $(driver, '#help-search').sendKeys('0.10');
    await count(driver, '.help-faq', 1);
    await capture(driver, `${theme}-offset-faq`);

    // Text must meet WCAG's normal-text contrast threshold in either theme.
    const colors = await driver.executeScript(`return {
      text: getComputedStyle(document.querySelector('.help-faq-answer')).color,
      background: getComputedStyle(document.querySelector('.help-center')).backgroundColor
    };`);
    const levels = [luminance(colors.text), luminance(colors.background)].sort((a, b) => b - a);
    assert.ok((levels[0] + 0.05) / (levels[1] + 0.05) >= 4.5, 'FAQ body text needs readable contrast');

    await $(driver, '.help-center-tools .btn-outline-secondary').click();
    await topic(driver, 'Keyboard shortcuts').click();
    await count(driver, '.help-faq', 0);
    await count(driver, '.help-shortcuts tbody tr', 12);
    await $(driver, '#help-search').sendKeys('save');
    await count(driver, '.help-shortcuts tbody tr', 2);
    assert.match(await $(driver, '.help-shortcuts').getText(), /Save project as/);
    await capture(driver, `${theme}-shortcuts`);

    await topic(driver, 'All topics').click();
    await $(driver, '.help-center-tools .btn-outline-secondary').click();
    await $(driver, '#help-search').sendKeys('zzznomatch');
    await count(driver, '.help-center-empty', 1);
    await $(driver, '.help-center-empty button').click();
    await count(driver, '.help-faq', 20);
    await $(driver, '.help-center .help-tour-close').click();
    await count(driver, '.help-center', 0);
    assert.equal(await driver.executeScript("return document.activeElement.classList.contains('viewport-faq-toggle');"), true);
    assert.deepEqual(await projectData(driver), before);
  }

  await $(driver, '.viewport-faq-toggle').click();
  await $(driver, '.help-center-header .btn-primary').click();
  await count(driver, '.help-center', 0);
  await count(driver, '.help-tour-panel', 1);
  assert.equal(await $(driver, '.help-tour-panel').getAttribute('data-step'), 'add-individual');
  assert.equal(await driver.executeScript("return document.querySelector('.app-workspace').inert;"), false);
  await $(driver, '.help-tour-next').sendKeys(Key.ESCAPE);
  await count(driver, '.help-tour-panel', 0);
  assert.deepEqual(await projectData(driver), before);
});
