import * as THREE from "three";
import { skinBinding, skinPoint } from "../physics/volume-body.js";

export function cubeSurface(divisions = 32) {
  const points = [],
    triangles = [],
    lookup = new Map();
  function vertex(q) {
    const key = q.map((v) => v.toFixed(5)).join(",");
    if (lookup.has(key)) return lookup.get(key);
    const id = points.length;
    lookup.set(key, id);
    points.push(q);
    return id;
  }
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1]) {
      const u = (axis + 1) % 3,
        v = (axis + 2) % 3,
        grid = [];
      for (let j = 0; j <= divisions; j++)
        for (let i = 0; i <= divisions; i++) {
          const q = [0, 0, 0];
          q[axis] = sign;
          q[u] = (2 * i) / divisions - 1;
          q[v] = (2 * j) / divisions - 1;
          grid.push(vertex(q));
        }
      for (let j = 0; j < divisions; j++)
        for (let i = 0; i < divisions; i++) {
          const a = grid[i + j * (divisions + 1)],
            b = grid[i + 1 + j * (divisions + 1)],
            c = grid[i + (j + 1) * (divisions + 1)],
            d = grid[i + 1 + (j + 1) * (divisions + 1)];
          triangles.push(
            ...(sign > 0 ? [a, b, d, a, d, c] : [a, d, b, a, c, d]),
          );
        }
    }
  return { points, triangles };
}

export class SmoothSkin {
  constructor(body, material) {
    this.body = body;
    const surface = cubeSurface(30);
    this.bindings = surface.points.map((q) => skinBinding(body, q));
    this.positions = new Float32Array(this.bindings.length * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setIndex(surface.triangles);
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.update();
  }
  update() {
    for (let i = 0; i < this.bindings.length; i++)
      skinPoint(this.body, this.bindings[i], this.positions, i * 3);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
  dispose() {
    this.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export function disposeTree(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
    else o.material?.dispose();
  });
  group.clear();
}
