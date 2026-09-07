import * as THREE from "three";
import { cubeSurface, disposeTree } from "./skin.js";
import { skinBinding, skinPoint } from "../physics/volume-body.js";

// New implementation inspired by the fracture workflow in seongwoochikin-dev/
// wakppuball: remove a local region, construct a thick chip and expose the filling.
// No source or assets from that unlicensed repository are included.
export class Coating {
  constructor(body, item) {
    this.body = body;
    this.item = item;
    this.group = new THREE.Group();
    this.debris = [];
    this.removed = new Set();
    this.damage = new Map();
    this.thickness = item.shellThickness || 0.06;
    const surface = cubeSurface(11);
    this.bindings = surface.points.map((q) => skinBinding(body, q));
    this.positions = new Float32Array(this.bindings.length * 3);
    this.normals = Float32Array.from(
      this.bindings.flatMap((b) =>
        new THREE.Vector3(b.rest[0], b.rest[1] - 1.2, b.rest[2])
          .normalize()
          .toArray(),
      ),
    );
    this.triangles = surface.triangles;
    this.regions = [];
    this.faceRegion = [];
    const count = Math.round(58 / (item.chipSize || 1));
    const seeds = Array.from({ length: count }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / count,
        theta = i * 2.39996323;
      return new THREE.Vector3(
        Math.sqrt(1 - y * y) * Math.cos(theta),
        y,
        Math.sqrt(1 - y * y) * Math.sin(theta),
      );
    });
    for (let f = 0; f < this.triangles.length / 3; f++) {
      const center = new THREE.Vector3();
      for (let j = 0; j < 3; j++) {
        const r = this.bindings[this.triangles[f * 3 + j]].rest;
        center.add(new THREE.Vector3(r[0], r[1] - 1.2, r[2]));
      }
      center.normalize();
      let region = 0,
        score = -Infinity;
      seeds.forEach((seed, i) => {
        const value = center.dot(seed) + 0.011 * Math.sin(f * 12.8 + i * 7.3);
        if (value > score) {
          score = value;
          region = i;
        }
      });
      this.faceRegion[f] = region;
      (this.regions[region] ||= []).push(f);
    }
    this.material = new THREE.MeshPhysicalMaterial({
      color: item.shell,
      roughness: 0.35,
      clearcoat: 0.45,
      clearcoatRoughness: 0.22,
      metalness: item.mystery ? 0.42 : 0,
      side: THREE.DoubleSide,
    });
    this.rimMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(item.shell).lerp(new THREE.Color("white"), 0.5),
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
    this.rims = new THREE.Mesh(new THREE.BufferGeometry(), this.rimMaterial);
    this.group.add(this.rims);
    this.updateSurface();
    this.rebuild();
  }
  updateSurface() {
    for (let i = 0; i < this.bindings.length; i++) {
      skinPoint(this.body, this.bindings[i], this.positions, i * 3);
      for (let k = 0; k < 3; k++)
        this.positions[i * 3 + k] += this.normals[i * 3 + k] * this.thickness;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    for (const line of this.group.children)
      if (line.userData.edges) {
        const a = line.geometry.attributes.position;
        let offset = 0;
        for (const edge of line.userData.edges)
          for (const id of edge)
            for (let k = 0; k < 3; k++)
              a.array[offset++] = this.positions[id * 3 + k];
        a.needsUpdate = true;
      }
  }
  boundary(faces) {
    const edges = new Map();
    for (const f of faces)
      for (let k = 0; k < 3; k++) {
        const a = this.triangles[f * 3 + k],
          b = this.triangles[f * 3 + ((k + 1) % 3)],
          key = Math.min(a, b) + ":" + Math.max(a, b);
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [a, b]);
      }
    return [...edges.values()];
  }
  inner(id) {
    const p = new Float32Array(3);
    skinPoint(this.body, this.bindings[id], p);
    return Array.from(p);
  }
  outer(id) {
    return Array.from(this.positions.slice(id * 3, id * 3 + 3));
  }
  rebuild() {
    const faces = [];
    for (let f = 0; f < this.faceRegion.length; f++)
      if (!this.removed.has(this.faceRegion[f])) faces.push(f);
    this.geometry.setIndex(
      faces.flatMap((f) => this.triangles.slice(f * 3, f * 3 + 3)),
    );
    this.rimEdges = this.boundary(faces);
    this.rims.geometry.dispose();
    this.rims.geometry = new THREE.BufferGeometry();
    this.rims.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(this.rimEdges.length * 18),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    this.updateRims();
  }
  updateRims() {
    const attribute = this.rims.geometry.attributes.position;
    if (!attribute) return;
    let index = 0;
    for (const [a, b] of this.rimEdges || []) {
      const ao = this.outer(a),
        bo = this.outer(b),
        ai = this.inner(a),
        bi = this.inner(b);
      for (const v of [...ao, ...bo, ...ai, ...bo, ...bi, ...ai])
        attribute.array[index++] = v;
    }
    attribute.needsUpdate = true;
    this.rims.geometry.computeVertexNormals();
    this.rims.geometry.computeBoundingSphere();
  }
  hit(point) {
    let nearest = -1,
      distance = Infinity;
    for (let f = 0; f < this.faceRegion.length; f++) {
      const region = this.faceRegion[f];
      if (this.removed.has(region)) continue;
      const center = new THREE.Vector3(),
        ids = this.triangles.slice(f * 3, f * 3 + 3);
      ids.forEach((id) =>
        center.add(new THREE.Vector3().fromArray(this.positions, id * 3)),
      );
      center.multiplyScalar(1 / 3);
      const d = center.distanceToSquared(point);
      if (d < distance) {
        distance = d;
        nearest = region;
      }
    }
    if (nearest < 0 || distance > 1) return { broken: false };
    const damage = (this.damage.get(nearest) || 0) + 1;
    this.damage.set(nearest, damage);
    if (damage < (this.item.shellHits || 2)) {
      this.addCrack(nearest);
      return { broken: false, damage };
    }
    this.breakRegion(nearest);
    return {
      broken: true,
      remaining: 1 - this.removed.size / this.regions.length,
    };
  }
  addCrack(region) {
    if (this.group.children.some((c) => c.userData.region === region)) return;
    const edges = this.boundary(this.regions[region]),
      points = [];
    for (const [a, b] of edges) points.push(...this.outer(a), ...this.outer(b));
    const line = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points, 3),
      ),
      new THREE.LineBasicMaterial({
        color: "#fff2e8",
        transparent: true,
        opacity: 0.9,
      }),
    );
    line.userData.region = region;
    line.userData.edges = edges;
    this.group.add(line);
  }
  breakRegion(region) {
    const faces = this.regions[region],
      points = [];
    for (const f of faces) {
      const [a, b, c] = this.triangles.slice(f * 3, f * 3 + 3);
      points.push(
        ...this.outer(a),
        ...this.outer(b),
        ...this.outer(c),
        ...this.inner(c),
        ...this.inner(b),
        ...this.inner(a),
      );
    }
    for (const [a, b] of this.boundary(faces)) {
      const ao = this.outer(a),
        bo = this.outer(b),
        ai = this.inner(a),
        bi = this.inner(b);
      points.push(...ao, ...ai, ...bo, ...bo, ...ai, ...bi);
    }
    const center = new THREE.Vector3();
    for (let i = 0; i < points.length; i += 3)
      center.add(new THREE.Vector3().fromArray(points, i));
    center.multiplyScalar(3 / points.length);
    for (let i = 0; i < points.length; i += 3) {
      points[i] -= center.x;
      points[i + 1] -= center.y;
      points[i + 2] -= center.z;
    }
    const geometry = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, this.material.clone());
    mesh.position.copy(center);
    mesh.castShadow = true;
    this.group.add(mesh);
    this.debris.push({
      mesh,
      velocity: new THREE.Vector3(center.x * 0.8, 1.2, center.z * 0.8),
      spin: new THREE.Vector3(0.6, 1, 0.7),
      age: 0,
    });
    this.removed.add(region);
    for (const child of [...this.group.children])
      if (child.userData.region === region) {
        this.group.remove(child);
        child.geometry.dispose();
        child.material.dispose();
      }
    this.rebuild();
  }
  update(dt) {
    this.updateSurface();
    if (this.removed.size) this.updateRims();
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.age += dt;
      d.velocity.y -= 4 * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      if (d.mesh.position.y < 0.1) {
        d.mesh.position.y = 0.1;
        d.velocity.y = Math.abs(d.velocity.y) * 0.2;
        d.velocity.x *= 0.95;
        d.velocity.z *= 0.95;
        d.spin.multiplyScalar(0.9);
      }
      if (d.age > 7) {
        d.mesh.scale.multiplyScalar(Math.exp(-dt * 2));
        if (d.age > 9) {
          this.group.remove(d.mesh);
          d.mesh.geometry.dispose();
          d.mesh.material.dispose();
          this.debris.splice(i, 1);
        }
      }
    }
  }
  dispose() {
    disposeTree(this.group);
  }
}
