import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// An isotropic shell avoids long needle-shaped fracture faces at sphere poles.
// Sample the original deforming volume so custom outlines can also wear wax.
function shellTopology(body) {
  const ico = new THREE.IcosahedronGeometry(1, 12);
  ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const geo = mergeVertices(ico); ico.dispose();
  const pos = geo.attributes.position, source = body.attributes.position;
  const { segments, rings, winding } = body.userData;
  for (let i = 0; i < pos.count; i++) {
    const d = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    const row = (Math.asin(THREE.MathUtils.clamp(d.z, -1, 1)) / Math.PI + 0.5) * rings;
    const col = ((Math.atan2(-d.y, d.x) / (Math.PI * 2) + 1) % 1) * segments;
    const r0 = Math.floor(row), r1 = Math.min(rings, r0 + 1), c0 = Math.floor(col) % segments, c1 = (c0 + 1) % segments;
    const a = new THREE.Vector3().fromBufferAttribute(source, r0 * segments + c0).lerp(new THREE.Vector3().fromBufferAttribute(source, r0 * segments + c1), col % 1);
    const b = new THREE.Vector3().fromBufferAttribute(source, r1 * segments + c0).lerp(new THREE.Vector3().fromBufferAttribute(source, r1 * segments + c1), col % 1);
    a.lerp(b, row % 1); pos.setXYZ(i, a.x, a.y, a.z);
  }
  if (winding > 0) {
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Reference study: seongwoochikin-dev/wakppuball, fractureAt / rebuildRim /
 * buildChunkObject (d1fcf298). Local surface patch -> Voronoi face groups ->
 * thickness-bearing fragments. Independently implemented; no source/assets copied.
 * See docs/WAX_REFERENCES.md for exact sources and adaptation decisions.
 */
export class WaxShell {
  constructor(bodyGeometry, spec, parent, onBreak, onCrack) {
    this.parent = parent;
    this.spec = spec;
    this.onBreak = onBreak;
    this.onCrack = onCrack;
    this.thickness = 0.025 + (spec.waxHits || 2) * 0.012;
    this.vertices = [];
    const topology = shellTopology(bodyGeometry);
    const positions = topology.attributes.position;
    const normals = topology.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      this.vertices.push(new THREE.Vector3().fromBufferAttribute(positions, i)
        .addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, i), this.thickness));
    }
    this.faces = [];
    const indices = topology.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      const ids = Array.from(indices.slice(i, i + 3));
      const center = new THREE.Vector3();
      ids.forEach(id => center.add(this.vertices[id])); center.divideScalar(3);
      this.faces.push({ ids, center, active: true, patch: null });
    }
    topology.dispose();
    this.patches = [];
    this.fragments = [];
    this.material = new THREE.MeshPhysicalMaterial({ color: spec.waxColor,
      roughness: 0.43, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.25 });
    this.innerMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.waxColor).lerp(new THREE.Color('white'), 0.4), roughness: 0.8,
      side: THREE.DoubleSide,
    });
    this.lineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(spec.waxColor).multiplyScalar(0.5) });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.castShadow = true;
    this.rim = new THREE.Mesh(new THREE.BufferGeometry(), this.innerMaterial);
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), this.lineMaterial);
    parent.add(this.mesh, this.rim, this.lines);
    this.rebuild();
  }

  // Seeded nearest-centroid partitioning preserves the actual curved outer faces.
  partition(faceIds, count) {
    const seeds = [this.faces[faceIds[0]].center];
    while (seeds.length < Math.min(count, faceIds.length)) {
      let best = faceIds[0], score = -1;
      for (const id of faceIds) {
        const nearest = Math.min(...seeds.map(s => s.distanceToSquared(this.faces[id].center)));
        if (nearest > score) { best = id; score = nearest; }
      }
      seeds.push(this.faces[best].center);
    }
    const result = seeds.map(() => []);
    faceIds.forEach(id => {
      const d = seeds.map(s => s.distanceToSquared(this.faces[id].center));
      result[d.indexOf(Math.min(...d))].push(id);
    });
    return result.filter(g => g.length);
  }

  press(point, gesture, now = performance.now()) {
    if (this.broken || this.spec.type === 'wax') return false;
    let closest = null, distance = Infinity;
    for (const face of this.faces) {
      if (!face.active) continue;
      const d = face.center.distanceToSquared(point);
      if (d < distance) { distance = d; closest = face; }
    }
    if (!closest || distance > 0.12) return false;
    let patch = closest.patch;
    if (patch) {
      if (patch.gesture === gesture || now - patch.time < 120) return false;
      patch.hits++; patch.gesture = gesture; patch.time = now;
    } else {
      const reach = (0.26 + Math.random() * 0.11) * (this.spec.chipScale || 1);
      const selected = [];
      this.faces.forEach((f, id) => {
        const irregularity = 1 + 0.055 * Math.sin(f.center.x * 17 + f.center.y * 11 + f.center.z * 13);
        if (f.active && !f.patch && f.center.distanceTo(point) < reach * irregularity) selected.push(id);
      });
      if (!selected.length) return false;
      patch = { hits: 1, gesture, time: now, removed: false,
        groups: this.partition(selected, 3 + Math.floor(Math.random() * 2)), center: point.clone() };
      this.patches.push(patch);
      selected.forEach(id => { this.faces[id].patch = patch; });
    }
    if (patch.hits >= (this.spec.waxHits || 2)) {
      patch.removed = true;
      patch.groups.forEach(ids => this.detach(ids));
    }
    this.onCrack(false);
    this.rebuild();
    const score = this.patches.reduce((s, p) => s + (p.removed ? 1 : 0.5), 0);
    if (score >= (this.spec.breakScore || 4)) this.onBreak();
    return true;
  }

  edgeKey(a, b) {
    // Weld coincident pole vertices and the longitude seam for closed chip sides.
    const key = id => this.vertices[id].toArray().map(v => v.toFixed(5)).join(',');
    const aa = key(a), bb = key(b);
    return aa < bb ? aa + '/' + bb : bb + '/' + aa;
  }

  boundaries(ids) {
    const edges = new Map();
    for (const id of ids) {
      const face = this.faces[id];
      face.ids.forEach((a, i) => {
        const b = face.ids[(i + 1) % 3], key = this.edgeKey(a, b);
        if (edges.has(key)) edges.delete(key); else edges.set(key, [a, b]);
      });
    }
    return [...edges.values()];
  }

  inner(id) {
    const v = this.vertices[id];
    return v.clone().addScaledVector(v.clone().normalize(), -this.thickness);
  }

  thickGeometry(ids) {
    const data = [], push = v => data.push(v.x, v.y, v.z);
    ids.forEach(id => {
      const f = this.faces[id];
      f.ids.forEach(v => push(this.vertices[v]));
      [...f.ids].reverse().forEach(v => push(this.inner(v)));
    });
    this.boundaries(ids).forEach(([a, b]) => {
      const aa = this.vertices[a], bb = this.vertices[b], ai = this.inner(a), bi = this.inner(b);
      [aa, ai, bi, aa, bi, bb].forEach(push);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
    geo.computeVertexNormals();
    return geo;
  }

  detach(ids) {
    const active = ids.filter(id => this.faces[id].active);
    if (!active.length) return;
    const geo = this.thickGeometry(active);
    geo.computeBoundingBox();
    const center = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-center.x, -center.y, -center.z);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.position.copy(center); mesh.castShadow = true;
    this.parent.add(mesh);
    this.fragments.push({ mesh, age: 0, radius: geo.boundingBox.getSize(new THREE.Vector3()).length() * 0.15,
      velocity: center.clone().normalize().multiplyScalar(0.45 + Math.random() * 0.4).add(new THREE.Vector3(0, 0.25, 0)),
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(5) });
    active.forEach(id => { this.faces[id].active = false; });
  }

  breakAll() {
    if (this.broken) return;
    this.broken = true;
    const remaining = this.faces.map((_, i) => i).filter(id => this.faces[id].active);
    if (remaining.length) this.partition(remaining, 22).forEach(ids => this.detach(ids));
    this.rebuild();
  }

  rebuild() {
    const active = [], positions = [], normals = [], rim = [], lines = [];
    const push = (target, v) => target.push(v.x, v.y, v.z);
    this.faces.forEach((f, id) => {
      if (!f.active) return;
      active.push(id);
      f.ids.forEach(v => { push(positions, this.vertices[v]); push(normals, this.vertices[v].clone().normalize()); });
    });
    this.boundaries(active).forEach(([a, b]) => {
      [this.vertices[a], this.inner(a), this.inner(b), this.vertices[a], this.inner(b), this.vertices[b]].forEach(v => push(rim, v));
    });
    this.patches.filter(p => !p.removed).forEach(p => p.groups.forEach(group => {
      this.boundaries(group).forEach(([a, b]) => {
        [a, b].forEach(id => push(lines, this.vertices[id].clone().multiplyScalar(1.002)));
      });
    }));
    for (const [mesh, data] of [[this.mesh, positions], [this.rim, rim], [this.lines, lines]]) {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BufferGeometry();
      mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
      if (mesh === this.mesh) mesh.geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      else if (mesh !== this.lines && data.length) mesh.geometry.computeVertexNormals();
      mesh.visible = data.length > 0;
      if (data.length) mesh.geometry.computeBoundingSphere();
    }
  }

  update(dt, floorY) {
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const f = this.fragments[i]; f.age += dt;
      f.velocity.y -= 5.8 * dt;
      f.mesh.position.addScaledVector(f.velocity, dt);
      f.mesh.rotation.x += f.spin.x * dt; f.mesh.rotation.y += f.spin.y * dt; f.mesh.rotation.z += f.spin.z * dt;
      if (f.mesh.position.y < floorY + f.radius) {
        f.mesh.position.y = floorY + f.radius;
        f.velocity.y = Math.abs(f.velocity.y) * 0.18;
        f.velocity.x *= 0.85; f.velocity.z *= 0.85; f.spin.multiplyScalar(0.8);
      }
      if (f.age > 4) f.mesh.scale.setScalar(Math.max(0, 5 - f.age));
      if (f.age > 5) { this.parent.remove(f.mesh); f.mesh.geometry.dispose(); this.fragments.splice(i, 1); }
    }
  }
  dispose() {
    [this.mesh, this.rim, this.lines, ...this.fragments.map(f => f.mesh)].forEach(m => { this.parent.remove(m); m.geometry.dispose(); });
    this.material.dispose(); this.innerMaterial.dispose(); this.lineMaterial.dispose();
  }
}
