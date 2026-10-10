import assert from "node:assert/strict";
import test from "node:test";
import { positionTourPanel } from "../src/helpTour.js";

test("tour callouts fit beside sidebar controls and to the left of right-hand panels", () => {
  const viewport = { width: 1280, height: 800 };
  const panel = { width: 368, height: 330 };
  const sidebar = { left: 10, right: 375, top: 80, bottom: 120 };
  const rightPanel = { left: 1000, right: 1264, top: 16, bottom: 320 };
  const left = positionTourPanel(sidebar, panel, viewport);
  const right = positionTourPanel(rightPanel, panel, viewport);
  assert.equal(left.side, "right");
  assert.ok(left.left > sidebar.right);
  assert.equal(right.side, "left");
  assert.ok(right.left + panel.width < rightPanel.left);
});

test("narrow windows place the settings callout below the clickable gear without covering it", () => {
  const gear = { left: 345, right: 375, top: 65, bottom: 95 };
  const position = positionTourPanel(gear, { width: 368, height: 330 }, { width: 680, height: 600 });
  assert.equal(position.side, "bottom");
  assert.ok(position.top > gear.bottom);
  assert.ok(position.left + 368 <= 680 - 16);
});

test("large viewport highlights and unavailable targets keep the callout within window bounds", () => {
  const viewport = { width: 800, height: 600 };
  const panel = { width: 368, height: 450 };
  for (const rect of [null, { left: 380, right: 800, top: 0, bottom: 600 }]) {
    const position = positionTourPanel(rect, panel, viewport, !!rect);
    assert.ok(position.left >= 16);
    assert.ok(position.top >= 16);
    assert.ok(position.left + panel.width <= viewport.width - 16);
    assert.ok(position.top + panel.height <= viewport.height - 16);
  }
});
