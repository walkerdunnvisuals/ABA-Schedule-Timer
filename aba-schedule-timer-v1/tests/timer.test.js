"use strict";

const assert = require("node:assert/strict");
const {
  arithmeticMean,
  formatCountdown,
  formatDuration,
  generateFleshlerHoffman,
  shuffle,
  toMilliseconds,
} = require("../app.js");

function almostEqual(actual, expected, tolerance = 1e-7) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function run() {
  const fiveMinuteSchedule = generateFleshlerHoffman(300_000, 12);

  assert.equal(fiveMinuteSchedule.length, 12);
  assert.ok(fiveMinuteSchedule.every((value) => value > 0));
  assert.ok(
    fiveMinuteSchedule.every((value, index) => index === 0 || value > fiveMinuteSchedule[index - 1]),
  );
  almostEqual(arithmeticMean(fiveMinuteSchedule), 300_000, 1e-6);
  almostEqual(fiveMinuteSchedule[0], 12_862.456, 0.001);
  almostEqual(fiveMinuteSchedule[11], 1_045_471.995, 0.001);

  const normalizedTenStep = generateFleshlerHoffman(1, 10);
  const expectedRounded = [0.052, 0.163, 0.288, 0.432, 0.599, 0.801, 1.053, 1.393, 1.916, 3.303];
  assert.deepEqual(
    normalizedTenStep.map((value) => Number(value.toFixed(3))),
    expectedRounded,
  );

  const deterministic = [0.8, 0.2, 0.6];
  let randomIndex = 0;
  const shuffled = shuffle([1, 2, 3, 4], () => deterministic[randomIndex++]);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.notDeepEqual(shuffled, [1, 2, 3, 4]);

  assert.equal(toMilliseconds(5, "minutes"), 300_000);
  assert.equal(toMilliseconds(1.5, "hours"), 5_400_000);
  assert.equal(formatCountdown(300_000), "05:00");
  assert.equal(formatCountdown(3_661_000), "01:01:01");
  assert.equal(formatDuration(70_000), "1m 10s");

  assert.throws(() => generateFleshlerHoffman(0), RangeError);
  assert.throws(() => generateFleshlerHoffman(1000, 1), RangeError);
  assert.throws(() => toMilliseconds(5, "days"), RangeError);

  console.log("All ABA timer logic tests passed.");
}

run();
