import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { SoftBody } from '../src/soft-body.js';
import { WaxShell } from '../src/wax-shell.js';
import { materialProfile } from '../src/materials.js';

const dataPath = new URL('../public/legacy/data.js', import.meta.url);
const catalog = vm.runInNewContext(fs.readFileSync(dataPath, 'utf8') + '\nslimeDB');
function stateFor(spec) {
  const radius = 100, core = { x: 400, y: 400 };
  const nodes = Array.from({ length: spec.shapePts?.length || spec.nodeCount || 16 }, (_, i) => {
    const angle = i / (spec.shapePts?.length || spec.nodeCount || 16) * Math.PI * 2;
    const p = spec.shapePts?.[i] || [Math.cos(angle) * 0.7, Math.sin(angle) * 0.7];
    return { x: core.x + p[0] * radius, y: core.y + p[1] * radius };
  });
  return { spec, nodes, core, radius, waxIntact: spec.type.includes('wax'), stretchSmooth: 0 };
}

test('all 49 original slime and material definitions are preserved byte for byte', () => {
  assert.equal(catalog.length, 49);
  // Git checks out CRLF on Windows; normalize only line endings for comparison.
  const hash = b => createHash('sha256').update(b.toString().replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(hash(fs.readFileSync(dataPath)), 'df2629dcc2db26a76808605413771822c65676a7733e7bae52da7fc80bd51fc5');
});

test('every catalog shape yields finite 3D geometry and outward volume', () => {
  for (const spec of catalog) {
    const s = stateFor(spec), soft = new SoftBody(s), p = soft.geometry.attributes.position;
    assert.ok([...p.array].every(Number.isFinite), spec.name);
    soft.geometry.computeBoundingBox();
    assert.ok(soft.geometry.boundingBox.max.z - soft.geometry.boundingBox.min.z > 0.5, spec.name);
    let volume = 0;
    const idx = soft.geometry.index.array, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < idx.length; i += 3) {
      a.fromBufferAttribute(p, idx[i]); b.fromBufferAttribute(p, idx[i + 1]); c.fromBufferAttribute(p, idx[i + 2]);
      volume += a.dot(b.cross(c)) / 6;
    }
    assert.ok(volume > 0, spec.name + ' has inward faces');
    soft.dispose();
  }
});

test('elastic dents recover; plastic material retains a pressed shape', () => {
  function run(spec) {
    const s = stateFor(spec), soft = new SoftBody(s);
    const touches = [{ local: new THREE.Vector3(0, 0, 0.91) }];
    for (let i = 0; i < 100; i++) soft.update(s, touches, 1 / 60);
    const pressed = Math.max(...soft.dents);
    for (let i = 0; i < 200; i++) soft.update(s, [], 1 / 60);
    const released = Math.max(...soft.dents); soft.dispose(); return { pressed, released };
  }
  const jelly = run(catalog[0]), clay = run(catalog.find(s => s.id === 32));
  assert.ok(jelly.pressed > 0.15);
  assert.ok(jelly.released < 0.01);
  assert.ok(clay.released > 0.1);
});

test('glass transmits more light when stretched while cotton and metal stay opaque', () => {
  const glass = catalog.find(s => s.id === 14), cotton = catalog.find(s => s.id === 17), metal = catalog.find(s => s.id === 33);
  assert.ok(materialProfile(glass, glass.stretchAlpha).transmission > materialProfile(glass).transmission);
  assert.equal(materialProfile(cotton).transmission, 0);
  assert.equal(materialProfile(metal).transmission, 0);
});

test('wax respects hit counts, ignores the same gesture, removes actual faces, resets without debris', () => {
  const spec = catalog.find(s => s.id === 35), s = stateFor(spec), soft = new SoftBody(s), group = new THREE.Group();
  const wax = new WaxShell(soft.geometry, spec, group, () => {}, () => {});
  const point = new THREE.Vector3(0.1, 0.1, 0.96);
  assert.ok(wax.press(point, 1, 1000));
  const full = wax.mesh.geometry.attributes.position.count;
  assert.equal(wax.fragments.length, 0);
  wax.press(point, 1, 1400); assert.equal(wax.patches[0].hits, 1);
  wax.press(point, 2, 1400); assert.equal(wax.patches[0].hits, 2); assert.equal(wax.fragments.length, 0);
  wax.press(point, 3, 1800);
  assert.ok(wax.fragments.length > 0);
  assert.ok(wax.mesh.geometry.attributes.position.count < full);
  assert.ok(wax.rim.geometry.attributes.position.count > 0);
  assert.ok(wax.fragments.every(f => f.mesh.geometry.attributes.position.count > 6));
  wax.breakAll(); assert.equal(wax.mesh.visible, false);
  for (let i = 0; i < 400; i++) wax.update(1 / 60, -1.1);
  assert.equal(wax.fragments.length, 0);
  wax.dispose(); soft.dispose(); assert.equal(group.children.length, 0);
});

test('front and back wax surfaces are damaged independently', () => {
  const spec = catalog.find(s => s.id === 35), soft = new SoftBody(stateFor(spec));
  const wax = new WaxShell(soft.geometry, spec, new THREE.Group(), () => {}, () => {});
  wax.press(new THREE.Vector3(0, 0, 0.96), 1, 1000);
  wax.press(new THREE.Vector3(0, 0, -0.96), 2, 1500);
  assert.equal(wax.patches.length, 2);
  assert.equal(wax.patches[0].hits, 1);
  wax.dispose(); soft.dispose();
});
