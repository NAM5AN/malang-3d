// Independently implemented volumetric XPBD. See docs/SOFT_BODY.md for equations
// and references. Simulation vertices fill the interior; they are not a 2D outline.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function roundedCube(x, y, z, shape = "round") {
  const sx =
    x *
    Math.sqrt(Math.max(0, 1 - (y * y) / 2 - (z * z) / 2 + (y * y * z * z) / 3));
  const sy =
    y *
    Math.sqrt(Math.max(0, 1 - (z * z) / 2 - (x * x) / 2 + (z * z * x * x) / 3));
  const sz =
    z *
    Math.sqrt(Math.max(0, 1 - (x * x) / 2 - (y * y) / 2 + (x * x * y * y) / 3));
  let a = sx * 1.22,
    b = sy * 0.98,
    c = sz * 1.13;
  if (shape === "heart") {
    a *= 0.88 + 0.2 * sy;
    b += 0.23 * Math.abs(sx) - 0.22 * Math.exp(-sx * sx * 18) * Math.max(0, sy);
    c *= 0.78;
  } else if (shape === "clover") {
    const r = 1 + 0.17 * Math.cos(4 * Math.atan2(sy, sx)) * Math.hypot(sx, sy);
    a *= r;
    b *= r;
    c *= 0.68;
  } else if (shape === "mouse") {
    const ear = Math.exp(-((Math.abs(sx) - 0.62) ** 2 + (sy - 0.64) ** 2) * 16);
    a *= 1 + 0.25 * ear;
    b += 0.32 * ear;
    c *= 0.8;
  } else if (shape === "cloud") {
    const r =
      1 + 0.055 * Math.sin(sx * 8) * Math.cos(sy * 7) * Math.cos(sz * 6);
    a *= r;
    b *= r;
    c *= r;
  } else if (shape === "jellyfish") {
    b *= 0.78;
    a *= 1 + 0.12 * sy;
    c *= 1 + 0.12 * sy;
  } else if (shape === "gem") {
    const r = 1 + 0.055 * Math.cos(Math.atan2(sz, sx) * 7);
    a *= r;
    c *= r;
  }
  return [a, b + 1.2, c];
}

export function signedVolume(p, a, b, c, d) {
  a *= 3;
  b *= 3;
  c *= 3;
  d *= 3;
  const ux = p[b] - p[a],
    uy = p[b + 1] - p[a + 1],
    uz = p[b + 2] - p[a + 2];
  const vx = p[c] - p[a],
    vy = p[c + 1] - p[a + 1],
    vz = p[c + 2] - p[a + 2];
  const wx = p[d] - p[a],
    wy = p[d + 1] - p[a + 1],
    wz = p[d + 2] - p[a + 2];
  return (
    (ux * (vy * wz - vz * wy) +
      uy * (vz * wx - vx * wz) +
      uz * (vx * wy - vy * wx)) /
    6
  );
}

export class VolumeBody {
  constructor(profile = {}, shape = "round", divisions = 5) {
    this.profile = {
      compliance: 0.003,
      volumeCompliance: 1e-7,
      grabCompliance: 0.000008,
      drag: 1.4,
      friction: 3,
      reach: 2.5,
      pressDepth: 0.38,
      plastic: 0,
      stretch: 1.85,
      bounce: 0.04,
      ...profile,
    };
    this.divisions = divisions;
    this.shape = shape;
    const n = divisions + 1,
      positions = [],
      tet = [],
      edgeMap = new Map();
    this.index = (x, y, z) => x + n * (y + n * z);
    for (let z = 0; z < n; z++)
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++)
          positions.push(
            ...roundedCube(
              (x / divisions) * 2 - 1,
              (y / divisions) * 2 - 1,
              (z / divisions) * 2 - 1,
              shape,
            ),
          );
    this.rest = new Float64Array(positions);
    this.position = new Float64Array(positions);
    this.previous = new Float64Array(positions);
    this.velocity = new Float64Array(positions.length);
    this.safe = new Float64Array(positions);
    this.count = positions.length / 3;
    for (let z = 0; z < divisions; z++)
      for (let y = 0; y < divisions; y++)
        for (let x = 0; x < divisions; x++) {
          const v = Array.from({ length: 8 }, (_, i) =>
            this.index(x + (i & 1), y + ((i >> 1) & 1), z + ((i >> 2) & 1)),
          );
          for (const pattern of [
            [0, 1, 3, 7],
            [0, 3, 2, 7],
            [0, 2, 6, 7],
            [0, 6, 4, 7],
            [0, 4, 5, 7],
            [0, 5, 1, 7],
          ]) {
            const t = pattern.map((i) => v[i]);
            if (signedVolume(this.rest, ...t) < 0) [t[1], t[2]] = [t[2], t[1]];
            tet.push(...t);
            for (let i = 0; i < 4; i++)
              for (let j = i + 1; j < 4; j++) {
                const a = Math.min(t[i], t[j]),
                  b = Math.max(t[i], t[j]);
                edgeMap.set(a + ":" + b, [a, b]);
              }
          }
        }
    this.tets = new Uint16Array(tet);
    this.bulkGradient = new Float64Array(positions.length);
    this.bulkLambda = 0;
    this.volumes = Float64Array.from({ length: tet.length / 4 }, (_, i) =>
      signedVolume(this.rest, ...tet.slice(i * 4, i * 4 + 4)),
    );
    this.edges = new Uint16Array([...edgeMap.values()].flat());
    this.lengths = Float64Array.from(
      { length: this.edges.length / 2 },
      (_, i) => {
        const a = this.edges[i * 2] * 3,
          b = this.edges[i * 2 + 1] * 3;
        return Math.hypot(
          ...[0, 1, 2].map((k) => this.rest[a + k] - this.rest[b + k]),
        );
      },
    );
    this.originalLengths = this.lengths.slice();
    this.edgeLambda = new Float64Array(this.lengths.length);
    this.volumeLambda = new Float64Array(this.volumes.length);
    this.handles = new Map();
    this.clock = 0;
    this.safetyRecoveries = 0;
    this.restVolume = this.volumes.reduce((a, b) => a + b, 0);
  }

  grab(id, point, normal = [0, 0, 1], radius = 0.75) {
    const nodes = [];
    for (let i = 0; i < this.count; i++) {
      const k = i * 3,
        d = Math.hypot(
          this.position[k] - point[0],
          this.position[k + 1] - point[1],
          this.position[k + 2] - point[2],
        );
      if (d < radius * 1.5) {
        const weight = Math.exp((-d * d) / (radius * radius * 0.7));
        nodes.push({
          i: k,
          weight,
          start: Array.from(this.position.slice(k, k + 3)),
          lambda: [0, 0, 0],
        });
      }
    }
    this.handles.set(id, {
      point: [...point],
      target: [...point],
      current: [...point],
      normal: [...normal],
      pressure: 0,
      nodes,
    });
    return nodes.length;
  }

  move(id, target) {
    const h = this.handles.get(id);
    if (!h) return;
    const d = target.map((v, k) => v - h.point[k]);
    const reach = this.profile.reach;
    const scale = Math.min(1, reach / Math.max(1e-8, Math.hypot(...d)));
    h.target = h.point.map((v, k) => v + d[k] * scale);
  }
  release(id) {
    this.handles.delete(id);
  }
  releaseAll() {
    this.handles.clear();
  }
  reset() {
    this.position.set(this.rest);
    this.previous.set(this.rest);
    this.velocity.fill(0);
    this.lengths.set(this.originalLengths);
    this.releaseAll();
  }

  solveHandles(h) {
    for (const handle of this.handles.values())
      for (const node of handle.nodes) {
        const alpha = this.profile.grabCompliance / (h * h * node.weight);
        for (let k = 0; k < 3; k++) {
          const goal =
            node.start[k] +
            (handle.current[k] -
              handle.point[k] -
              handle.pressure * handle.normal[k]) *
              Math.sqrt(node.weight);
          const c = this.position[node.i + k] - goal;
          const dl = (-c - alpha * node.lambda[k]) / (1 + alpha);
          node.lambda[k] += dl;
          this.position[node.i + k] += dl;
        }
      }
  }

  solveEdges(h) {
    const p = this.position,
      alpha = this.profile.compliance / (h * h);
    for (let e = 0; e < this.lengths.length; e++) {
      const a = this.edges[e * 2] * 3,
        b = this.edges[e * 2 + 1] * 3;
      const x = p[a] - p[b],
        y = p[a + 1] - p[b + 1],
        z = p[a + 2] - p[b + 2],
        l = Math.hypot(x, y, z);
      if (l < 1e-9) continue;
      const rest = this.lengths[e];
      let dl = (-(l - rest) - alpha * this.edgeLambda[e]) / (2 + alpha);
      this.edgeLambda[e] += dl;
      // A hard strain envelope prevents a local thin neck, even for fast pointer jumps.
      const limit = clamp(
        l + 2 * dl,
        rest * 0.35,
        this.originalLengths[e] * this.profile.stretch,
      );
      dl = (limit - l) / 2 / l;
      p[a] += x * dl;
      p[a + 1] += y * dl;
      p[a + 2] += z * dl;
      p[b] -= x * dl;
      p[b + 1] -= y * dl;
      p[b + 2] -= z * dl;
    }
  }

  solveVolumes(h) {
    const p = this.position;
    for (let t = 0; t < this.volumes.length; t++) {
      const a = this.tets[t * 4] * 3,
        b = this.tets[t * 4 + 1] * 3,
        c = this.tets[t * 4 + 2] * 3,
        d = this.tets[t * 4 + 3] * 3;
      const ux = p[b] - p[a],
        uy = p[b + 1] - p[a + 1],
        uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a],
        vy = p[c + 1] - p[a + 1],
        vz = p[c + 2] - p[a + 2];
      const wx = p[d] - p[a],
        wy = p[d + 1] - p[a + 1],
        wz = p[d + 2] - p[a + 2];
      const bx = (vy * wz - vz * wy) / 6,
        by = (vz * wx - vx * wz) / 6,
        bz = (vx * wy - vy * wx) / 6;
      const cx = (wy * uz - wz * uy) / 6,
        cy = (wz * ux - wx * uz) / 6,
        cz = (wx * uy - wy * ux) / 6;
      const dx = (uy * vz - uz * vy) / 6,
        dy = (uz * vx - ux * vz) / 6,
        dz = (ux * vy - uy * vx) / 6;
      const ax = -bx - cx - dx,
        ay = -by - cy - dy,
        az = -bz - cz - dz;
      const volume = ux * bx + uy * by + uz * bz;
      const w =
        ax * ax +
        ay * ay +
        az * az +
        bx * bx +
        by * by +
        bz * bz +
        cx * cx +
        cy * cy +
        cz * cz +
        dx * dx +
        dy * dy +
        dz * dz;
      // Compliant local volumes allow material to redistribute under pressure.
      // A separate bulk constraint retains the total volume without tet locking.
      const barrier = volume < this.volumes[t] * 0.24;
      const alpha = barrier ? 0 : this.profile.volumeCompliance / (h * h);
      if (barrier) this.volumeLambda[t] = 0;
      const dl =
        (-(volume - this.volumes[t] * (barrier ? 0.24 : 1)) -
          alpha * this.volumeLambda[t]) /
        (w + alpha);
      this.volumeLambda[t] += dl;
      p[a] += ax * dl;
      p[a + 1] += ay * dl;
      p[a + 2] += az * dl;
      p[b] += bx * dl;
      p[b + 1] += by * dl;
      p[b + 2] += bz * dl;
      p[c] += cx * dl;
      p[c + 1] += cy * dl;
      p[c + 2] += cz * dl;
      p[d] += dx * dl;
      p[d + 1] += dy * dl;
      p[d + 2] += dz * dl;
    }
  }

  solveBulk(h) {
    const p = this.position,
      g = this.bulkGradient;
    g.fill(0);
    let volume = 0;
    // Sum the same oriented elements as the local constraints and restVolume.
    // Removing every shared face is not equivalent after a shaped cage's
    // individual tetrahedra have had their rest orientation corrected.
    for (let t = 0; t < this.tets.length; t += 4) {
      const a = this.tets[t] * 3,
        b = this.tets[t + 1] * 3,
        c = this.tets[t + 2] * 3,
        d = this.tets[t + 3] * 3;
      const ux = p[b] - p[a],
        uy = p[b + 1] - p[a + 1],
        uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a],
        vy = p[c + 1] - p[a + 1],
        vz = p[c + 2] - p[a + 2];
      const wx = p[d] - p[a],
        wy = p[d + 1] - p[a + 1],
        wz = p[d + 2] - p[a + 2];
      const bx = (vy * wz - vz * wy) / 6,
        by = (vz * wx - vx * wz) / 6,
        bz = (vx * wy - vy * wx) / 6;
      const cx = (wy * uz - wz * uy) / 6,
        cy = (wz * ux - wx * uz) / 6,
        cz = (wx * uy - wy * ux) / 6;
      const dx = (uy * vz - uz * vy) / 6,
        dy = (uz * vx - ux * vz) / 6,
        dz = (ux * vy - uy * vx) / 6;
      volume += ux * bx + uy * by + uz * bz;
      g[a] -= bx + cx + dx;
      g[a + 1] -= by + cy + dy;
      g[a + 2] -= bz + cz + dz;
      g[b] += bx;
      g[b + 1] += by;
      g[b + 2] += bz;
      g[c] += cx;
      g[c + 1] += cy;
      g[c + 2] += cz;
      g[d] += dx;
      g[d + 1] += dy;
      g[d + 2] += dz;
    }
    let w = 0;
    for (let i = 0; i < g.length; i++) w += g[i] * g[i];
    const alpha = 1e-8 / (h * h);
    const dl =
      (-(volume - this.restVolume) - alpha * this.bulkLambda) / (w + alpha);
    this.bulkLambda += dl;
    for (let i = 0; i < p.length; i++) p[i] += g[i] * dl;
  }

  step(dt = 1 / 60) {
    const substeps = 6,
      h = Math.min(dt, 1 / 30) / substeps,
      p = this.position,
      v = this.velocity;
    for (let s = 0; s < substeps; s++) {
      this.safe.set(p);
      this.previous.set(p);
      const damping = Math.exp(-this.profile.drag * h);
      for (let i = 0; i < this.count; i++) {
        const k = i * 3;
        v[k] *= damping;
        v[k + 1] = v[k + 1] * damping - 4 * h;
        v[k + 2] *= damping;
        for (let j = 0; j < 3; j++) p[k + j] += clamp(v[k + j], -8, 8) * h;
      }
      this.edgeLambda.fill(0);
      this.volumeLambda.fill(0);
      this.bulkLambda = 0;
      for (const handle of this.handles.values()) {
        // Build fingertip pressure over 100 ms instead of teleporting the surface
        // inward on the first frame, which can jam thin character shapes.
        handle.pressure = Math.min(
          this.profile.pressDepth,
          handle.pressure + (this.profile.pressDepth * h) / 0.1,
        );
        const distance = Math.hypot(
          ...handle.target.map((v, k) => v - handle.current[k]),
        );
        const fraction = Math.min(1, (9 * h) / Math.max(distance, 1e-8));
        for (let k = 0; k < 3; k++)
          handle.current[k] +=
            (handle.target[k] - handle.current[k]) * fraction;
        for (const node of handle.nodes) node.lambda.fill(0);
      }
      for (let iteration = 0; iteration < 3; iteration++) {
        this.solveHandles(h);
        this.solveEdges(h);
        this.solveVolumes(h);
        this.solveBulk(h);
        for (let i = 0; i < this.count; i++)
          p[i * 3 + 1] = Math.max(0.075, p[i * 3 + 1]);
      }
      // Backtrack a substep instead of allowing an inverted tetrahedron to propagate.
      let valid = false;
      for (let attempt = 0; attempt < 7; attempt++) {
        valid = true;
        for (let t = 0; t < this.volumes.length; t++) {
          if (
            signedVolume(
              p,
              this.tets[t * 4],
              this.tets[t * 4 + 1],
              this.tets[t * 4 + 2],
              this.tets[t * 4 + 3],
            ) <
            this.volumes[t] * 0.12
          ) {
            valid = false;
            break;
          }
        }
        if (valid) break;
        for (let k = 0; k < p.length; k++) p[k] = (p[k] + this.safe[k]) * 0.5;
      }
      if (!valid) {
        p.set(this.safe);
        this.safetyRecoveries++;
      }
      for (let i = 0; i < this.count; i++) {
        const k = i * 3;
        for (let j = 0; j < 3; j++)
          v[k + j] = (p[k + j] - this.previous[k + j]) / h;
        if (p[k + 1] < 0.077) {
          const friction = Math.exp(-this.profile.friction * h);
          v[k] *= friction;
          v[k + 2] *= friction;
          v[k + 1] = Math.max(v[k + 1], -v[k + 1] * this.profile.bounce);
        }
      }
    }
    if (this.profile.plastic && this.handles.size) {
      const rate = this.profile.plastic * dt;
      for (let e = 0; e < this.lengths.length; e++) {
        const a = this.edges[e * 2] * 3,
          b = this.edges[e * 2 + 1] * 3;
        const l = Math.hypot(
          p[a] - p[b],
          p[a + 1] - p[b + 1],
          p[a + 2] - p[b + 2],
        );
        this.lengths[e] = clamp(
          this.lengths[e] + (l - this.lengths[e]) * rate,
          this.originalLengths[e] * 0.65,
          this.originalLengths[e] * 1.45,
        );
      }
    }
    // A transient rest strain gives foam its slow rebound. Clay instead stores
    // permanent rest strain above; the two behaviors are intentionally distinct.
    if (this.profile.recovery && !this.profile.plastic) {
      for (let e = 0; e < this.lengths.length; e++) {
        const a = this.edges[e * 2] * 3,
          b = this.edges[e * 2 + 1] * 3;
        const current = Math.hypot(
          p[a] - p[b],
          p[a + 1] - p[b + 1],
          p[a + 2] - p[b + 2],
        );
        const goal = this.handles.size
          ? clamp(
              current,
              this.originalLengths[e] * 0.65,
              this.originalLengths[e] * 1.45,
            )
          : this.originalLengths[e];
        const rate =
          1 -
          Math.exp(-dt * (this.handles.size ? 5 : 1 / this.profile.recovery));
        this.lengths[e] += (goal - this.lengths[e]) * rate;
      }
    }
    this.clock += dt;
  }

  metrics() {
    let volume = 0,
      minRatio = Infinity,
      maxEdge = 0,
      inverted = 0;
    for (let t = 0; t < this.volumes.length; t++) {
      const v = signedVolume(
        this.position,
        ...this.tets.slice(t * 4, t * 4 + 4),
      );
      volume += v;
      minRatio = Math.min(minRatio, v / this.volumes[t]);
      if (v <= 0) inverted++;
    }
    for (let e = 0; e < this.lengths.length; e++) {
      const a = this.edges[e * 2] * 3,
        b = this.edges[e * 2 + 1] * 3;
      maxEdge = Math.max(
        maxEdge,
        Math.hypot(
          ...[0, 1, 2].map((k) => this.position[a + k] - this.position[b + k]),
        ) / this.originalLengths[e],
      );
    }
    return {
      particles: this.count,
      tetrahedra: this.volumes.length,
      volumeRatio: volume / this.restVolume,
      minTetRatio: minRatio,
      maxEdgeRatio: maxEdge,
      inverted,
      finite: this.position.every(Number.isFinite),
      handles: this.handles.size,
      safetyRecoveries: this.safetyRecoveries,
    };
  }
}

// A normalized compact C2 radial kernel supplies a smooth displacement field in
// physical rest space. Unlike cube-parametric weights, it has no cube-face seams.
// All weights are positive; a cursor never pulls a visible vertex directly.
export function skinBinding(body, q) {
  const rest = roundedCube(...q, body.shape),
    indices = [],
    weights = [];
  let sum = 0;
  for (let i = 0; i < body.count; i++) {
    const k = i * 3,
      r =
        Math.hypot(
          body.rest[k] - rest[0],
          body.rest[k + 1] - rest[1],
          body.rest[k + 2] - rest[2],
        ) / 0.95;
    if (r >= 1) continue;
    const w = (1 - r) ** 4 * (4 * r + 1);
    indices.push(k);
    weights.push(w);
    sum += w;
  }
  if (sum < 1e-12)
    throw new Error("Skin point is outside the volumetric support.");
  return {
    indices: Uint16Array.from(indices),
    weights: Float32Array.from(weights, (w) => w / sum),
    rest,
  };
}

export function skinPoint(body, binding, out, offset = 0) {
  let x = binding.rest[0],
    y = binding.rest[1],
    z = binding.rest[2];
  for (let i = 0; i < binding.indices.length; i++) {
    const k = binding.indices[i],
      w = binding.weights[i];
    x += (body.position[k] - body.rest[k]) * w;
    y += (body.position[k + 1] - body.rest[k + 1]) * w;
    z += (body.position[k + 2] - body.rest[k + 2]) * w;
  }
  out[offset] = x;
  out[offset + 1] = y;
  out[offset + 2] = z;
}
