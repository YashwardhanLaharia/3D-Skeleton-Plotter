import { test } from "node:test";
import assert from "node:assert/strict";
import {
  relativeLuminance,
  outlineColours,
} from "../../src/outlineColour.js";

test("luminance runs from black to white", () => {
  assert.equal(relativeLuminance("#000000"), 0);
  assert.equal(relativeLuminance("#ffffff"), 1);
});

test("light skeletons get a black outline", () => {
  assert.equal(outlineColours("#ffffff").visible, "#000000");
  assert.equal(outlineColours("#F0E442").visible, "#000000");
  assert.equal(outlineColours("#E69F00").visible, "#000000");
});

test("dark skeletons get a white outline", () => {
  assert.equal(outlineColours("#000000").visible, "#ffffff");
  assert.equal(outlineColours("#1b1f24").visible, "#ffffff");
});

test("hidden edges use the opposite colour", () => {
  assert.deepEqual(outlineColours("#ffffff"), {
    visible: "#000000",
    hidden: "#ffffff",
  });
  assert.deepEqual(outlineColours("#000000"), {
    visible: "#ffffff",
    hidden: "#000000",
  });
});

