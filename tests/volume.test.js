import test from "node:test";
import assert from "node:assert/strict";
import {
  VolumeBody,
  skinBinding,
  skinPoint,
} from "../src/physics/volume-body.js";
import { catalog, materialProfile, textures } from "../src/catalog.js";
import { Collection } from "../src/collection.js";
import { Coating } from "../src/render/coating.js";
import { Vector3 } from "three";

function assertSolid(body, tolerance = 0.05) {
  const m = body.metrics();
  assert.ok(m.finite);
  assert.equal(m.inverted, 0);
  assert.ok(m.minTetRatio > 0.1);
  assert.ok(Math.abs(m.volumeRatio - 1) < tolerance, JSON.stringify(m));
  return m;
}
function settle(body, n = 90) {
  for (let i = 0; i < n; i++) body.step();
}
function edgeError(body) {
  let error = 0;
  for (let e = 0; e < body.lengths.length; e++) {
    const a = body.edges[e * 2] * 3,
      b = body.edges[e * 2 + 1] * 3;
    error += Math.abs(
      Math.hypot(
        ...[0, 1, 2].map((k) => body.position[a + k] - body.position[b + k]),
      ) /
        body.originalLengths[e] -
        1,
    );
  }
  return error / body.lengths.length;
}

test("all 49 concepts have valid positive tetrahedral volumes", () => {
  assert.equal(catalog.length, 49);
  assert.equal(new Set(catalog.map((i) => i.id)).size, 49);
  for (const shape of new Set(catalog.map((i) => i.shape))) {
    const b = new VolumeBody({}, shape);
    assert.equal(b.count, 216);
    assert.equal(b.tets.length / 4, 750);
    assert.ok(b.volumes.every((v) => v > 0));
    settle(b);
    assertSolid(b);
  }
});
test("broad grab preserves solid volume during pull and release for every material", () => {
  const results = [];
  for (const [texture, profile] of Object.entries(textures)) {
    const body = new VolumeBody(profile);
    settle(body);
    const n = body.grab(1, [0.55, 1.25, 0.85]);
    assert.ok(n > 20);
    for (let f = 0; f < 90; f++) {
      body.move(1, [0.55 + f / 70, 1.25 + f / 120, 0.85]);
      body.step();
      if (f % 10 === 0) assertSolid(body);
    }
    results.push({ texture, ...assertSolid(body) });
    body.release(1);
    settle(body, 150);
    assertSolid(body);
  }
  console.log(
    "Material stress maximum volume error:",
    Math.max(...results.map((m) => Math.abs(m.volumeRatio - 1))).toFixed(5),
  );
});
test("two opposite grabs, large input jumps and cancellation do not invert the solid", () => {
  for (const shape of [
    "round",
    "heart",
    "clover",
    "mouse",
    "cloud",
    "jellyfish",
    "gem",
  ]) {
    const b = new VolumeBody(textures.stretch, shape);
    settle(b);
    b.grab(1, [-0.8, 1.2, 0.55]);
    b.grab(2, [0.8, 1.2, 0.55]);
    for (let f = 0; f < 100; f++) {
      b.move(1, [-1000, 1 + Math.sin(f) * 3, 0.2]);
      b.move(2, [1000, 1 + Math.cos(f) * 3, 0.2]);
      b.step(f % 9 === 0 ? 1 / 15 : 1 / 60);
      if (f % 10 === 0) assertSolid(b, 0.08);
    }
    b.releaseAll();
    settle(b, 90);
    assert.equal(b.handles.size, 0);
    assertSolid(b);
  }
});
test("rubber recovers faster than squishy, and clay retains a deformation", () => {
  const result = {};
  for (const texture of ["rubber", "squishy", "clay"]) {
    const body = new VolumeBody(textures[texture]);
    settle(body);
    body.grab(1, [0.55, 1.25, 0.85]);
    body.move(1, [1.65, 1.65, 0.85]);
    settle(body, 120);
    body.release(1);
    settle(body, 18);
    result[texture] = { early: edgeError(body) };
    settle(body, 240);
    result[texture].late = edgeError(body);
  }
  console.log("Recovery strain:", result);
  assert.ok(result.rubber.early < result.squishy.early * 0.8);
  assert.ok(result.squishy.late < result.squishy.early * 0.6);
  assert.ok(result.clay.late > result.rubber.late * 2);
});
test("wax uses local removable surface faces and closed, thick chips with distinct hit counts", () => {
  for (const id of [34, 35]) {
    const item = catalog.find((i) => i.id === id),
      body = new VolumeBody(materialProfile(item));
    const coating = new Coating(body, item),
      point = new Vector3(0.4, 1.6, 0.95),
      before = coating.geometry.index.count;
    for (let n = 0; n < item.shellHits - 1; n++) {
      coating.hit(point);
      assert.equal(coating.removed.size, 0);
    }
    const result = coating.hit(point);
    assert.equal(result.broken, true);
    assert.equal(coating.removed.size, 1);
    assert.ok(coating.geometry.index.count < before);
    const edges = new Map(),
      positions = coating.debris[0].mesh.geometry.attributes.position.array;
    const key = (i) =>
      [0, 1, 2].map((k) => positions[i + k].toFixed(5)).join(",");
    for (let i = 0; i < positions.length; i += 9)
      for (const [a, b] of [
        [i, i + 3],
        [i + 3, i + 6],
        [i + 6, i],
      ]) {
        const k = [key(a), key(b)].sort().join("|");
        edges.set(k, (edges.get(k) || 0) + 1);
      }
    assert.ok(
      [...edges.values()].every((count) => count === 2),
      "Chip must have outer, inner and side walls without open edges",
    );
    assertSolid(body);
    coating.update(0.016);
    coating.dispose();
  }
});
test("smooth skin uses positive partition of unity and transports rigid translations exactly", () => {
  const body = new VolumeBody();
  for (const q of [
    [0, 1, 0],
    [1, 0.23, -0.57],
    [-1, -1, 1],
    [0.4, 0.6, 1],
  ]) {
    const binding = skinBinding(body, q);
    assert.ok(binding.weights.every((w) => w >= 0));
    assert.ok(Math.abs(binding.weights.reduce((a, b) => a + b, 0) - 1) < 1e-6);
    body.position.set(body.rest);
    for (let i = 0; i < body.count; i++) {
      body.position[i * 3] += 0.6;
      body.position[i * 3 + 1] += 0.4;
      body.position[i * 3 + 2] -= 0.3;
    }
    const p = new Float64Array(3);
    skinPoint(body, binding, p);
    [0.6, 0.4, -0.3].forEach((v, k) =>
      assert.ok(Math.abs(p[k] - binding.rest[k] - v) < 1e-6),
    );
  }
});
test("saved collection, duplicate levels, paid draws and custom material consumption", () => {
  const memory = new Map(),
    storage = {
      getItem: (k) => memory.get(k),
      setItem: (k, v) => memory.set(k, v),
    };
  const c = new Collection(storage);
  assert.equal(c.level(1), 2);
  const result = c.draw(() => 0);
  assert.equal(result.item.id, 1);
  assert.equal(c.state.coins, 140);
  assert.equal(c.state.owned[1], 3);
  const materialCount = c.state.materials.pearl;
  const crafted = c.craft(1, "My jelly", "#aabbcc", ["pearl", "pearl"]);
  assert.ok(crafted.item);
  assert.equal(c.state.materials.pearl, materialCount - 1);
  assert.equal(crafted.item.texture, "jelly");
  const loaded = new Collection(storage);
  assert.equal(loaded.state.selected, crafted.item.id);
  assert.equal(loaded.item(crafted.item.id).name, "My jelly");
  const coins = c.state.coins;
  assert.equal(c.buy("missing"), false);
  assert.equal(c.state.coins, coins);
  assert.equal(c.dismantle(1), false);
  c.state.coins = 0;
  assert.equal(c.draw(), null);
  assert.ok(c.craft(4, "Nope", "#000000", []).error);
});
