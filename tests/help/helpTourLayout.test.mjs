import assert from "node:assert/strict";
import test from "node:test";
import { highlightRect, tourLayout } from "../../src/helpTourLayout.js";

test("clips a highlight at the viewport edge and avoids invalid geometry offscreen", () => {
  const viewport = { width: 800, height: 600 };
  assert.deepEqual(highlightRect({ left: 10, top: -10, right: 300, bottom: 20, width: 290, height: 30 }, viewport), { left: 5, top: 0, right: 305, bottom: 25 });
  assert.equal(highlightRect({ left: 10, top: -50, right: 300, bottom: -20, width: 290, height: 30 }, viewport), null);
  assert.equal(highlightRect(null, viewport), null);
});

test("places sidebar explanations alongside the target", () => {
  assert.deepEqual(tourLayout({ left: 10, right: 360, top: 80, bottom: 110 }, { width: 360, height: 320 }, { width: 1200, height: 800 }), { left: 376, top: 80 });
});

test("places right-hand panel explanations to the left without covering it", () => {
  const target = { left: 850, right: 1188, top: 30, bottom: 160 };
  const result = tourLayout(target, { width: 360, height: 340 }, { width: 1200, height: 800 });
  assert.ok(result.left + 360 < target.left);
});

test("keeps cards within small or resized viewports", () => {
  for (const viewport of [{ width: 600, height: 500 }, { width: 320, height: 400 }]) {
    const result = tourLayout({ left: 10, right: 310, top: 40, bottom: 80 }, { width: 360, height: 450 }, viewport);
    assert.ok(result.left >= 12);
    assert.ok(result.top >= 12);
    assert.ok(result.left + Math.min(360, viewport.width - 24) <= viewport.width - 12);
    assert.ok(result.top + Math.min(450, viewport.height - 24) <= viewport.height - 12);
  }
});
