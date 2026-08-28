import assert from "node:assert/strict";
import test from "node:test";
import { validateRigCommand } from "../../src/rig/commands/RigCommandValidator.js";

test("command validator accepts supported command shapes", () => {
  const commands = [
    { type: "rotate-joint", jointId: "knee_l", axis: "x", amount: 10 },
    { type: "reset-joint", jointId: "knee_l" },
    { type: "rotate-digit", jointId: "toes_r", digit: "2", axis: "z", amount: -5 },
    { type: "reset-digit", jointId: "toes_r", digit: "2" },
    { type: "set-segment-scale", segmentId: "thigh_l", factor: 0.75 },
    { type: "set-segment-group-scale", groupId: "legs", factor: "0.8" },
    { type: "reset-segment-scale", segmentId: "thigh_l" },
    { type: "reset-all-segment-scales" },
    { type: "set-body-dimension", dimensionId: "torso_length", factor: 0.8 },
    { type: "reset-body-dimension", dimensionId: "torso_length" },
    { type: "reset-all-body-dimensions" },
    { type: "set-skeleton-scale", factor: 0.7 },
    { type: "reset-all" },
  ];

  commands.forEach((command) => {
    assert.deepEqual(validateRigCommand(command), { ok: true, command });
  });
});

test("command validator rejects malformed commands before model lookup", () => {
  const invalidCommands = [
    null,
    [],
    { type: "reset-joint", jointId: "" },
    { type: "reset-digit", jointId: "toes_r", digit: 2 },
    { type: "rotate-joint", jointId: "knee_l", axis: "q", amount: 10 },
    { type: "rotate-joint", jointId: "knee_l", axis: "x", amount: true },
    { type: "rotate-joint", jointId: "knee_l", axis: "x", amount: "" },
    { type: "rotate-joint", jointId: "knee_l", axis: "x", amount: Number.NaN },
    { type: "rotate-digit", jointId: "toes_r", digit: "2", axis: "x", amount: "nope" },
    { type: "set-segment-scale", segmentId: "", factor: 0.8 },
    { type: "set-segment-scale", segmentId: "thigh_l", factor: 0 },
    { type: "set-segment-scale", segmentId: "thigh_l", factor: true },
    { type: "set-segment-group-scale", groupId: "legs", factor: "" },
    { type: "reset-segment-scale", segmentId: 2 },
    { type: "set-body-dimension", dimensionId: "", factor: 0.8 },
    { type: "set-body-dimension", dimensionId: "pelvis_width", factor: 0 },
    { type: "reset-body-dimension", dimensionId: null },
    { type: "set-skeleton-scale", factor: 0 },
    { type: "set-skeleton-scale", factor: false },
  ];

  invalidCommands.forEach((command) => {
    assert.equal(validateRigCommand(command).ok, false, JSON.stringify(command));
  });

  assert.deepEqual(
    validateRigCommand({ type: "rotate-joint", jointId: "knee_l", axis: "x", amount: "10" }),
    {
      ok: true,
      command: { type: "rotate-joint", jointId: "knee_l", axis: "x", amount: "10" },
    }
  );
  assert.deepEqual(validateRigCommand({ type: "unknown" }), {
    ok: false,
    error: "Unknown command type: unknown",
  });
});
