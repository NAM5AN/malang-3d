import test from "node:test";
import assert from "node:assert/strict";
import {
  VolumeBody,
  skinBinding,
  skinPoint,
} from "../src/physics/volume-body.js";
import { textures } from "../src/catalog.js";

function advance(body, frames) {
  for (let frame = 0; frame < frames; frame++) body.step();
}

function surface(body) {
  const bindings = [];
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1])
      for (let u = -1; u <= 1; u += 0.25)
        for (let v = -1; v <= 1; v += 0.25) {
          const q = [0, 0, 0];
          q[axis] = sign;
          q[(axis + 1) % 3] = u;
          q[(axis + 2) % 3] = v;
          bindings.push(skinBinding(body, q));
        }
  return () => {
    const points = bindings.map((binding) => {
      const point = [];
      skinPoint(body, binding, point);
      return point;
    });
    const low = [0, 1, 2].map((axis) =>
      Math.min(...points.map((point) => point[axis])),
    );
    const high = [0, 1, 2].map((axis) =>
      Math.max(...points.map((point) => point[axis])),
    );
    return {
      points,
      low,
      high,
      size: high.map((value, axis) => value - low[axis]),
    };
  };
}

function contact(body, q) {
  const point = [];
  skinPoint(body, skinBinding(body, q), point);
  return point;
}

function assertHealthy(body) {
  const metrics = body.metrics();
  assert.ok(metrics.finite, "All simulated positions must remain finite");
  assert.equal(metrics.inverted, 0, "The jelly must not fold inside out");
  assert.ok(
    Math.abs(metrics.volumeRatio - 1) < 0.04,
    `The jelly must retain its filling: ${JSON.stringify(metrics)}`,
  );
  return metrics;
}

// Subtract the centers before comparing: sliding a rigid ball is not wobbling.
function shapeMotion(before, after) {
  const center = (points) =>
    [0, 1, 2].map(
      (axis) =>
        points.reduce((sum, point) => sum + point[axis], 0) / points.length,
    );
  const first = center(before.points),
    last = center(after.points);
  let squared = 0;
  for (let i = 0; i < before.points.length; i++)
    for (let axis = 0; axis < 3; axis++)
      squared +=
        (after.points[i][axis] -
          last[axis] -
          before.points[i][axis] +
          first[axis]) **
        2;
  return Math.sqrt(squared / before.points.length);
}

test("a palm press makes the resting jelly shorter and visibly wider", () => {
  const body = new VolumeBody(textures.jelly),
    sample = surface(body);
  advance(body, 90);
  const resting = sample(),
    top = contact(body, [0, 1, 0]);
  assert.ok(
    resting.low[1] < resting.size[1] * 0.08,
    "The jelly rests on the table",
  );
  body.grab("palm", top, [0, 1, 0], 0.85);
  body.move("palm", [top[0], top[1] - 0.35, top[2]]);
  advance(body, 45);
  const pressed = sample();
  const heightRatio = pressed.size[1] / resting.size[1];
  const footprintRatio =
    (pressed.size[0] * pressed.size[2]) / (resting.size[0] * resting.size[2]);
  assert.ok(
    heightRatio < 0.85,
    `A press must visibly flatten the jelly: ${heightRatio}`,
  );
  assert.ok(
    footprintRatio > 1.12,
    `Filling must spread sideways: ${footprintRatio}`,
  );
  assertHealthy(body);
  console.log("Jelly press:", {
    heightRatio: +heightRatio.toFixed(3),
    footprintRatio: +footprintRatio.toFixed(3),
  });
});

test("lifting one broad patch also lifts the underside off the table", () => {
  const body = new VolumeBody(textures.jelly),
    sample = surface(body);
  advance(body, 90);
  const resting = sample(),
    top = contact(body, [0, 1, 0]);
  body.grab("lift", top, [0, 0, 0], 0.85);
  for (let frame = 0; frame < 90; frame++) {
    body.move("lift", [
      top[0],
      top[1] + 1.8 * Math.min(1, (frame + 1) / 45),
      top[2],
    ]);
    body.step();
  }
  const lifted = sample(),
    undersideTravel = lifted.low[1] - resting.low[1];
  assert.ok(
    undersideTravel > resting.size[1] * 0.1,
    `The underside must follow the hand instead of staying pinned: ${undersideTravel}`,
  );
  assert.ok(
    lifted.high[1] - resting.high[1] > 1,
    "The surface must follow the lifting hand",
  );
  assertHealthy(body);
  console.log("Jelly underside lift:", +undersideTravel.toFixed(3));
});

test("released jelly keeps changing shape after the hand lets go", () => {
  const body = new VolumeBody(textures.jelly),
    sample = surface(body);
  advance(body, 90);
  const point = contact(body, [0.6, 0.4, 1]);
  body.grab("wave", point, [0, 0, 1]);
  for (let frame = 0; frame < 20; frame++) {
    body.move("wave", [
      point[0] + (frame / 20) * 0.95,
      point[1] + 0.3,
      point[2],
    ]);
    body.step();
  }
  body.releaseAll();
  const released = sample();
  advance(body, 12);
  const middle = sample();
  advance(body, 6);
  const later = sample();
  const totalMotion = shapeMotion(released, later),
    continuedMotion = shapeMotion(middle, later);
  assert.ok(
    totalMotion > released.size[0] * 0.025,
    `Release must produce a visible wobble: ${totalMotion}`,
  );
  assert.ok(
    continuedMotion > released.size[0] * 0.004,
    `The wobble must continue beyond the first frames: ${continuedMotion}`,
  );
  assert.equal(body.handles.size, 0);
  assertHealthy(body);
  console.log("Jelly release shape motion:", {
    firstThreeTenths: +totalMotion.toFixed(3),
    lastTenth: +continuedMotion.toFixed(3),
  });
});

test("ordinary pulls keep responding without repeated safety freezes", () => {
  const results = [];
  for (const shape of [
    "round",
    "heart",
    "clover",
    "mouse",
    "cloud",
    "jellyfish",
    "gem",
  ]) {
    const body = new VolumeBody(textures.jelly, shape);
    advance(body, 90);
    assertHealthy(body);
    const binding = skinBinding(body, [0.4, 0.35, 1]),
      point = [];
    skinPoint(body, binding, point);
    const beforeRecoveries = body.metrics().safetyRecoveries;
    body.grab("pull", point, [0, 0, 1]);
    for (let frame = 0; frame < 90; frame++) {
      const progress = Math.min(1, (frame + 1) / 60);
      body.move("pull", [
        point[0] + 1.3 * progress,
        point[1] + 0.7 * progress,
        point[2],
      ]);
      body.step();
      if (frame % 10 === 0) assertHealthy(body);
    }
    const heldPoint = [];
    skinPoint(body, binding, heldPoint);
    assert.ok(
      heldPoint[0] - point[0] > 0.75,
      `${shape}: the held surface must follow the hand`,
    );
    body.releaseAll();
    advance(body, 90);
    const metrics = assertHealthy(body),
      recoveries = metrics.safetyRecoveries - beforeRecoveries;
    assert.ok(
      recoveries <= 6,
      `${shape}: ordinary play must not freeze repeatedly (${recoveries} recoveries)`,
    );
    results.push({
      shape,
      recoveries,
      surfaceTravel: +(heldPoint[0] - point[0]).toFixed(3),
    });
  }
  console.log("Ordinary jelly pulls:", results);
});
