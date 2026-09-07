import test from "node:test";
import assert from "node:assert/strict";
import {
  VolumeBody,
  skinBinding,
  skinPoint,
} from "../src/physics/volume-body.js";
import { textures } from "../src/catalog.js";

const shapes = [
  "round",
  "heart",
  "clover",
  "mouse",
  "cloud",
  "jellyfish",
  "gem",
];
const interaction = { stretch: true };

function advance(body, frames) {
  for (let frame = 0; frame < frames; frame++) body.step();
}

function makeBody(texture = "jelly", shape = "round") {
  const body = new VolumeBody(textures[texture], shape);
  advance(body, 90);
  return body;
}

function contact(body, q) {
  const point = [];
  skinPoint(body, skinBinding(body, q), point);
  return point;
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
    const center = [0, 1, 2].map(
      (axis) =>
        points.reduce((sum, point) => sum + point[axis], 0) / points.length,
    );
    // Measure the visible span after removing translation. A whole ball sliding
    // across the table must not count as successful stretching.
    const low = [0, 1, 2].map((axis) =>
      Math.min(...points.map((point) => point[axis] - center[axis])),
    );
    const high = [0, 1, 2].map((axis) =>
      Math.max(...points.map((point) => point[axis] - center[axis])),
    );
    return {
      span: high.map((value, axis) => value - low[axis]),
      bottom: low[1] + center[1],
      top: high[1] + center[1],
      center,
    };
  };
}

function healthy(body, label, tolerance = 0.04) {
  const metrics = body.metrics();
  assert.ok(metrics.finite, `${label}: positions must stay finite`);
  assert.equal(metrics.inverted, 0, `${label}: no inverted tetrahedra`);
  assert.ok(
    Math.abs(metrics.volumeRatio - 1) < tolerance,
    `${label}: filling must retain its volume (${metrics.volumeRatio})`,
  );
  return metrics;
}

function ordinaryPull(body, { two = false, sample = surface(body) } = {}) {
  const initial = sample();
  const right = contact(body, [0.65, 0.3, 1]);
  const left = contact(body, [-0.65, 0.3, 1]);
  body.grab("right", right, [0, 0, 1], 0.75, interaction);
  if (two) body.grab("left", left, [0, 0, 1], 0.75, interaction);
  const startRecoveries = body.metrics().safetyRecoveries;
  for (let frame = 0; frame < 90; frame++) {
    const progress = Math.min(1, (frame + 1) / 60);
    body.move("right", [
      right[0] + (two ? 2 : 2.5) * progress,
      right[1] + 0.2 * progress,
      right[2],
    ]);
    if (two)
      body.move("left", [
        left[0] - 2 * progress,
        left[1] + 0.2 * progress,
        left[2],
      ]);
    body.step();
    if (frame % 10 === 0) healthy(body, body.shape);
  }
  const held = sample();
  body.releaseAll();
  advance(body, 90);
  const metrics = healthy(body, body.shape);
  return {
    lengthRatio: held.span[0] / initial.span[0],
    widthRatio: held.span[2] / initial.span[2],
    centerTravel: held.center[0] - initial.center[0],
    releasedRatio: sample().span[0] / initial.span[0],
    recoveries: metrics.safetyRecoveries - startRecoveries,
  };
}

test("the same one- and two-finger gestures visibly lengthen jelly instead of only moving it", () => {
  const results = {};
  const failures = [];
  for (const texture of Object.keys(textures)) {
    results[texture] = {};
    for (const two of [false, true]) {
      const result = ordinaryPull(makeBody(texture), { two });
      results[texture][two ? "two" : "one"] = result;
      if (result.recoveries > 6)
        failures.push(
          `${texture}/${two ? "two" : "one"}: ${result.recoveries} freezes`,
        );
    }
  }
  console.log(
    "Visible stretch ratios:",
    Object.fromEntries(
      Object.entries(results).map(([texture, value]) => [
        texture,
        {
          one: +value.one.lengthRatio.toFixed(3),
          two: +value.two.lengthRatio.toFixed(3),
        },
      ]),
    ),
  );
  assert.ok(
    results.jelly.one.lengthRatio > 1.6,
    "A normal one-finger drag must add substantial length",
  );
  assert.ok(
    results.jelly.two.lengthRatio > 2,
    "Two fingers must stretch the jelly beyond twice its width",
  );
  assert.ok(
    results.stretch.one.lengthRatio > 1.65,
    "Stretch slime must clearly elongate with one finger",
  );
  assert.ok(
    results.stretch.two.lengthRatio > 2.1,
    "Stretch slime must clearly elongate with two fingers",
  );
  assert.ok(
    results.stretch.two.lengthRatio > results.rubber.two.lengthRatio * 1.1,
    "The stretch material must elongate more than rubber under the same gesture",
  );
  assert.ok(
    results.jelly.one.releasedRatio < 1.2,
    "Letting go must release the stretched shape",
  );
  assert.equal(failures.length, 0, failures.join("; "));
});

test("all seven character shapes respond to an ordinary interactive drag without freezing", () => {
  const failures = [],
    results = [];
  for (const shape of shapes) {
    const result = ordinaryPull(makeBody("jelly", shape));
    results.push({
      shape,
      length: +result.lengthRatio.toFixed(3),
      recoveries: result.recoveries,
    });
    if (result.lengthRatio < 1.45)
      failures.push(`${shape}: only ${result.lengthRatio.toFixed(3)}x length`);
    if (result.recoveries > 6)
      failures.push(`${shape}: ${result.recoveries} freezes`);
  }
  console.log("Character stretch:", results);
  assert.equal(failures.length, 0, failures.join("; "));
});

test("extreme two-finger input stays solid and cancellation resumes free simulation", () => {
  const failures = [],
    results = [];
  for (const shape of shapes) {
    const body = makeBody("jelly", shape);
    const right = contact(body, [0.65, 0.3, 1]),
      left = contact(body, [-0.65, 0.3, 1]);
    body.grab("right", right, [0, 0, 1], 0.75, interaction);
    body.grab("left", left, [0, 0, 1], 0.75, interaction);
    for (let frame = 0; frame < 90; frame++) {
      body.move("right", [
        right[0] + 1000,
        right[1] + 0.4 * Math.sin(frame / 12),
        right[2],
      ]);
      body.move("left", [
        left[0] - 1000,
        left[1] + 0.3 * Math.cos(frame / 13),
        left[2],
      ]);
      body.step(frame % 15 === 0 ? 1 / 30 : 1 / 60);
      if (frame % 10 === 0) healthy(body, `${shape}/extreme`, 0.08);
    }
    const beforeCancel = healthy(body, `${shape}/held`, 0.08);
    body.releaseAll();
    advance(body, 120);
    const released = healthy(body, `${shape}/released`);
    const recoveryAfterCancel =
      released.safetyRecoveries - beforeCancel.safetyRecoveries;
    assert.equal(body.handles.size, 0);
    if (recoveryAfterCancel > 12)
      failures.push(
        `${shape}: still frozen after cancellation (${recoveryAfterCancel} retries)`,
      );
    if (released.minTetRatio < 0.2)
      failures.push(`${shape}: remains trapped in a collapsed shape`);
    results.push({
      shape,
      recoveryAfterCancel,
      volume: +released.volumeRatio.toFixed(5),
    });
  }
  console.log("Extreme gesture cancellation:", results);
  assert.equal(failures.length, 0, failures.join("; "));
});

test("adding and removing real fingers replaces temporary support and release leaves no hidden grip", () => {
  const body = makeBody(),
    point = contact(body, [0.65, 0.3, 1]);
  body.grab("first", point, [0, 0, 1], 0.75, interaction);
  assert.ok(
    !body.handles.get("first").support,
    "Touching alone must not pin a second patch",
  );
  body.move("first", [point[0] + 0.8, point[1] + 0.1, point[2]]);
  advance(body, 18);
  const oldSupport = body.handles.get("first").support;
  assert.ok(oldSupport, "A one-finger pull receives temporary support");
  const left = contact(body, [-0.65, 0.3, 1]);
  body.grab("second", left, [0, 0, 1], 0.75, interaction);
  assert.ok(
    [...body.handles.values()].every((handle) => !handle.support),
    "Real fingers must replace the temporary supporting palm immediately",
  );
  body.move("second", [left[0] - 0.2, left[1], left[2]]);
  advance(body, 12);
  body.release("second");
  body.move("first", [point[0] + 1.1, point[1] + 0.1, point[2]]);
  advance(body, 12);
  assert.equal(body.handles.size, 1);
  assert.ok(body.handles.get("first").support);
  assert.notEqual(
    body.handles.get("first").support,
    oldSupport,
    "Returning to one finger must use the current shape, not a stale anchor",
  );
  body.release("first");
  advance(body, 1);
  assert.equal(body.handles.size, 0);
  assert.equal(
    body.grips.length,
    0,
    "No support may survive the last pointer release",
  );
  healthy(body, "finger lifecycle");
  body.grab("magnet", contact(body, [0, 0.3, 1]), [0, 0, 0]);
  body.move("magnet", [0.8, 1.2, 1]);
  advance(body, 1);
  assert.ok(
    !body.handles.get("magnet").support,
    "Non-pointer interactions must not silently create a supporting palm",
  );
  body.reset();
  advance(body, 1);
  assert.equal(body.handles.size, 0);
  assert.equal(body.grips.length, 0);
});

test("interactive palm presses still squash and lifting never fixes the underside to the table", () => {
  const pressedBody = makeBody(),
    pressedSurface = surface(pressedBody);
  const resting = pressedSurface(),
    top = contact(pressedBody, [0, 1, 0]);
  pressedBody.grab("palm", top, [0, 1, 0], 0.85, interaction);
  for (let frame = 0; frame < 90; frame++) {
    pressedBody.move("palm", [
      top[0],
      top[1] - 0.35 * Math.min(1, (frame + 1) / 45),
      top[2],
    ]);
    pressedBody.step();
  }
  const pressed = pressedSurface();
  assert.ok(
    !pressedBody.handles.get("palm").support,
    "An inward press must not trigger a pull",
  );
  assert.ok(pressed.span[1] < resting.span[1] * 0.85);
  assert.ok(
    pressed.span[0] * pressed.span[2] >
      resting.span[0] * resting.span[2] * 1.12,
  );
  healthy(pressedBody, "interactive palm press");

  const liftedBody = makeBody(),
    liftedSurface = surface(liftedBody);
  const beforeLift = liftedSurface(),
    liftPoint = contact(liftedBody, [0, 1, 0]);
  liftedBody.grab("lift", liftPoint, [0, 1, 0], 0.85, interaction);
  for (let frame = 0; frame < 90; frame++) {
    liftedBody.move("lift", [
      liftPoint[0],
      liftPoint[1] + 1.8 * Math.min(1, (frame + 1) / 45),
      liftPoint[2],
    ]);
    liftedBody.step();
  }
  const lifted = liftedSurface(),
    undersideTravel = lifted.bottom - beforeLift.bottom;
  assert.ok(
    undersideTravel > beforeLift.span[1] * 0.1,
    `The underside must lift along with the hand (${undersideTravel})`,
  );
  assert.ok(lifted.top - beforeLift.top > 1);
  healthy(liftedBody, "interactive lift");
  console.log("Interactive press and lift:", {
    pressedHeight: +(pressed.span[1] / resting.span[1]).toFixed(3),
    undersideTravel: +undersideTravel.toFixed(3),
  });
});
