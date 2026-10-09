import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVerticalInput, DEFAULT_VERTICAL } from "../../src/sceneSpace.js";

test("height ignores whatever is in the floor RL box", () => {
  assert.deepEqual(parseVerticalInput("height", "12.5"), {
    ok: true,
    vertical: { ...DEFAULT_VERTICAL },
  });
});

test("rl reads the floor RL as a number", () => {
  assert.deepEqual(parseVerticalInput("rl", " 1.97 "), {
    ok: true,
    vertical: { convention: "rl", floorRL: 1.97 },
  });
});

test("rl accepts a floor RL of zero", () => {
  assert.equal(parseVerticalInput("rl", "0").vertical.floorRL, 0);
});

test("rl without a usable floor RL is refused", () => {
  for (const text of ["", "   ", "abc", undefined]) {
    const result = parseVerticalInput("rl", text);
    assert.equal(result.ok, false, `accepted ${JSON.stringify(text)}`);
    assert.match(result.error, /floor/);
  }
});
