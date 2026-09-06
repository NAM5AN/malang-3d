import * as THREE from 'three';

// The original outline springs drive a closed volume. Each latitude adds depth;
// surface dents use independent damped springs and plastic rest positions.
export class SoftBody {
  constructor(state) {
    this.segments = 112;
    this.rings = 40;
    this.spec = state.spec;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.userData = { segments: this.segments, rings: this.rings };
    const count = (this.rings + 1) * this.segments;
    this.position = new Float32Array(count * 3);
    this.dents = new Float32Array(count);
    this.velocity = new Float32Array(count);
    this.rest = new Float32Array(count);
    this.base = new Float32Array(count * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.position, 3).setUsage(THREE.DynamicDrawUsage));
    const indices = [];
    for (let row = 0; row < this.rings; row++) {
      for (let i = 0; i < this.segments; i++) {
        const a = row * this.segments + i;
        const b = row * this.segments + (i + 1) % this.segments;
        indices.push(a, b, a + this.segments, b, b + this.segments, a + this.segments);
      }
    }
    this.geometry.setIndex(indices);
    this.update(state, [], 1 / 60);
  }

  update(state, touches, dt) {
    const { nodes, core, radius, spec } = state;
    const points = nodes.map(n => new THREE.Vector3((n.x - core.x) / radius, -(n.y - core.y) / radius, 0));
    // A closed Catmull-Rom curve follows every custom outline, including concavities.
    const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    const outline = curve.getPoints(this.segments).slice(0, -1);
    let area = 0;
    outline.forEach((p, i) => { const q = outline[(i + 1) % outline.length]; area += p.x * q.y - q.x * p.y; });
    const winding = Math.sign(area) || -1;
    const thickness = spec.shapePts || spec.fineGoo ? 0.38 : spec.jelly ? 0.65 : 0.91;
    const edge = (spec.strokeF ?? 0.8) * 0.5;
    const step = Math.min(dt, 1 / 30) * 60;
    const spring = state.waxIntact ? 0.3 : Math.max(0.015, spec.k);
    for (let row = 0; row <= this.rings; row++) {
      const latitude = (row / this.rings - 0.5) * Math.PI;
      const span = Math.cos(latitude);
      const z = Math.sin(latitude) * thickness;
      for (let i = 0; i < this.segments; i++) {
        const n = row * this.segments + i;
        const p = outline[i], prev = outline[(i + this.segments - 1) % this.segments], next = outline[(i + 1) % this.segments];
        const dx = next.x - prev.x, dy = next.y - prev.y, len = Math.hypot(dx, dy) || 1;
        const radial = Math.hypot(p.x, p.y) || 1;
        const precise = spec.shapePts || spec.fineGoo;
        let x = (p.x + (precise ? winding * dy / len : p.x / radial) * edge) * span;
        let y = (p.y + (precise ? -winding * dx / len : p.y / radial) * edge) * span;
        let zz = z / Math.sqrt(1 + Math.max(0, state.stretchSmooth) * 0.7);
        if (!spec.shapePts && !spec.jelly && !spec.bouncy && !spec.type.includes('wax')) {
          // A soft mound with a broad contact patch, rather than a rigid sphere.
          y *= 0.83;
          if (y < -0.48) y = -0.48 + (y + 0.48) * 0.58;
          const ripple = Math.sin(i / this.segments * Math.PI * 6 + latitude * 2) * 0.018 * span;
          x *= 1 + ripple; zz *= 1 + ripple;
        }
        if (spec.type === 'cotton') {
          const texture = Math.sin(i * 2.1) * Math.sin(row * 1.8) * 0.017;
          x *= 1 + texture; y *= 1 + texture; zz *= 1 + texture;
        }
        this.base.set([x, y, zz], n * 3);
        let target = this.rest[n];
        for (const touch of touches) {
          if (touch.orbit) continue;
          const d2 = (x - touch.local.x) ** 2 + (y - touch.local.y) ** 2 + (zz - touch.local.z) ** 2;
          const pressure = state.waxIntact ? 0.018 : 0.24 + (0.08 / Math.max(0.02, spec.k)) * 0.02;
          target += pressure * Math.exp(-d2 / 0.16);
        }
        target = Math.min(0.46, target);
        this.velocity[n] = (this.velocity[n] + (target - this.dents[n]) * spring * step) * Math.pow(spec.damping, step);
        this.dents[n] = THREE.MathUtils.clamp(this.dents[n] + this.velocity[n] * step, -0.1, 0.48);
        if (spec.plastic && touches.length && !state.waxIntact) this.rest[n] += (this.dents[n] - this.rest[n]) * spec.plastic * step;
        const norm = Math.hypot(x, y, zz) || 1;
        const amount = this.dents[n];
        this.position[n * 3] = x - x / norm * amount;
        this.position[n * 3 + 1] = y - y / norm * amount;
        this.position[n * 3 + 2] = zz - zz / norm * amount;
      }
    }
    // Outline winding can differ between the catalog shapes. Explicitly orient outward.
    if (this.winding !== winding) {
      const index = this.geometry.index.array;
      if ((this.winding === undefined && winding < 0) || (this.winding !== undefined && winding !== this.winding)) {
        for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
        this.geometry.index.needsUpdate = true;
      }
      this.winding = winding;
      this.geometry.userData.winding = winding;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
  dispose() { this.geometry.dispose(); }
}
