import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { VolumeBody, skinBinding, skinPoint } from "../physics/volume-body.js";
import { materialProfile } from "../catalog.js";
import { SmoothSkin, disposeTree } from "./skin.js";
import { Coating } from "./coating.js";

const palettes = {
  pastel: ["#fff2ea", "#ff91bb", "#a5d8ec"],
  ice: ["#ffffff", "#b9e6f5", "#91bfdc"],
  stars: ["#ffe091", "#fff5cb"],
  confetti: ["#ffc85b", "#ff87a9", "#86cbd9"],
  tapioca: ["#40271d", "#594030"],
  choco: ["#774725", "#e9cda7"],
  seeds: ["#ffe28b"],
  pearl: ["#f8edf9", "#fff8dd"],
};
function starGeometry(heart = false) {
  const s = new THREE.Shape();
  if (heart) {
    s.moveTo(0, -0.9);
    s.bezierCurveTo(-2, 0.3, -0.7, 1.8, 0, 0.7);
    s.bezierCurveTo(0.7, 1.8, 2, 0.3, 0, -0.9);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        r = i % 2 ? 0.45 : 1,
        x = Math.sin(a) * r,
        y = Math.cos(a) * r;
      i ? s.lineTo(x, y) : s.moveTo(x, y);
    }
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false });
}
export class Studio {
  constructor(container, { onTouch = () => {}, onCoating = () => {} } = {}) {
    this.container = container;
    this.onTouch = onTouch;
    this.onCoating = onCoating;
    this.muted = false;
    this.pointers = new Map();
    this.scheduled = [];
    this.effects = [];
    this.touchHeat = 0;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute(
      "aria-label",
      "말랑이를 눌러 늘리고 주무르는 3D 공간",
    );
    this.canvas.tabIndex = 0;
    container.append(this.canvas);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#f3f1ea");
    this.camera = new THREE.PerspectiveCamera(37, 1, 0.1, 40);
    this.camera.position.set(3.0, 2.8, 6.7);
    this.camera.lookAt(0, 1.1, 0);
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.env.texture;
    room.dispose();
    pmrem.dispose();
    const ambient = new THREE.HemisphereLight("#ffffff", "#cbc7b8", 1.1);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight("#fff5e1", 3.1);
    key.position.set(-3, 7, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.00015;
    key.shadow.radius = 4;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#dcefff", 1.5);
    fill.position.set(5, 3, -3);
    this.scene.add(fill);
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshBasicMaterial({ color: "#f3f1ea", toneMapped: false }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.scene.add(this.floor);
    const receiver = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.08 }),
    );
    receiver.rotation.x = -Math.PI / 2;
    receiver.position.y = 0.003;
    receiver.receiveShadow = true;
    this.scene.add(receiver);
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext("2d"),
      gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, "rgba(75,66,47,.24)");
    gradient.addColorStop(0.5, "rgba(75,66,47,.09)");
    gradient.addColorStop(1, "rgba(75,66,47,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 4.1),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(shadowCanvas),
        transparent: true,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.scene.add(this.shadow);
    this.decor = new THREE.Group();
    this.scene.add(this.decor);
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.installInput();
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 1.1, 0);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 9;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.48;
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.last = performance.now();
    this.accumulator = 0;
    this.frame = 0;
    this.running = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clearInput();
        this.accumulator = 0;
      }
      this.last = performance.now();
    });
    window.addEventListener("blur", () => this.clearInput());
    this.renderer.setAnimationLoop((time) => this.animate(time));
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < 600 ? 46 : 37;
    this.camera.updateProjectionMatrix();
  }
  select(item) {
    this.clearInput();
    if (this.skin) {
      this.scene.remove(this.skin.mesh);
      this.skin.dispose();
    }
    if (this.coating) {
      this.scene.remove(this.coating.group);
      this.coating.dispose();
      this.coating = null;
    }
    disposeTree(this.decor);
    this.attachments = [];
    this.instanced = [];
    for (const e of this.effects) {
      this.scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
    }
    this.effects = [];
    this.item = { ...item };
    if (item.mystery)
      this.item.color = new THREE.Color()
        .setHSL(Math.random(), 0.55, 0.64)
        .getStyle();
    const profile = materialProfile(item);
    this.baseCompliance = profile.compliance;
    this.body = new VolumeBody(profile, item.shape);
    const material = new THREE.MeshPhysicalMaterial({
      color: this.item.color,
      roughness: profile.roughness,
      metalness: item.metal ? 0.8 : 0,
      transmission: item.metal ? 0 : profile.transmission,
      thickness: 1.5,
      ior: 1.34,
      attenuationColor: new THREE.Color(this.item.color),
      attenuationDistance: 1.6,
      clearcoat: item.texture === "cotton" ? 0 : 1,
      clearcoatRoughness: 0.2,
      iridescence: item.iridescent ? 1 : 0,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [180, 430],
      envMapIntensity: item.metal ? 1.8 : 1.0,
    });
    this.skin = new SmoothSkin(this.body, material);
    this.scene.add(this.skin.mesh);
    if (item.shell) {
      this.coating = new Coating(this.body, item);
      this.scene.add(this.coating.group);
    }
    this.makeDecor();
    this.touchHeat = 0;
    for (let i = 0; i < 45; i++) this.body.step();
    this.skin.update();
    this.coating?.update(0);
    this.onCoating(this.coating ? "코팅을 톡톡 눌러 깨 보세요" : "");
  }
  setBackground(value) {
    const color =
      { cream: "#f3f1ea", rose: "#f2e5e6", mint: "#e7eee6", night: "#252936" }[
        value
      ] || "#f3f1ea";
    this.scene.background.set(color);
    this.floor.material.color.set(color);
  }
  sound(kind = "soft") {
    if (this.muted) return;
    try {
      this.audio ||= new AudioContext();
      this.audio.resume();
      const ctx = this.audio,
        duration = kind === "crack" ? 0.13 : 0.16,
        buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp((-i / data.length) * 5);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value =
        kind === "crack" ? 4200 : kind === "crunch" ? 1600 : 300;
      const gain = ctx.createGain();
      gain.gain.value = 0.17;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    } catch {}
  }
  makeDecor() {
    const item = this.item;
    let seed = typeof item.id === "number" ? item.id * 1753 : 42;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const addInstanced = (
      count,
      geometry,
      material,
      colors,
      surface = false,
      scale = 0.045,
    ) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count),
        nodes = [];
      mesh.frustumCulled = false;
      for (let i = 0; i < count; i++) {
        let q = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1];
        if (surface) {
          const m = Math.max(...q.map(Math.abs));
          q = q.map((v) => (v / m) * 1.008);
        } else q = q.map((v) => v * 0.79);
        const binding = skinBinding(this.body, q);
        nodes.push({
          binding,
          scale: scale * (0.65 + random() * 0.7),
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(random() * 3, random() * 3, random() * 3),
          ),
        });
        mesh.setColorAt(i, new THREE.Color(colors[i % colors.length]));
      }
      this.instanced.push({ mesh, nodes });
      this.decor.add(mesh);
    };
    if (item.beads) {
      const fancy = ["confetti", "stars"].includes(item.beads);
      addInstanced(
        item.beads === "tapioca" ? 48 : 100,
        fancy ? starGeometry() : new THREE.SphereGeometry(1, 10, 8),
        new THREE.MeshPhysicalMaterial({ roughness: 0.33, clearcoat: 0.6 }),
        palettes[item.beads] || palettes.pastel,
        true,
        item.beads === "tapioca" ? 0.068 : 0.047,
      );
      if (item.beads === "confetti")
        addInstanced(
          20,
          starGeometry(true),
          new THREE.MeshStandardMaterial({ roughness: 0.4 }),
          ["#ff86ab"],
          true,
          0.05,
        );
    }
    if (item.bubbles || item.bigBubbles || item.jellyfish)
      addInstanced(
        item.bigBubbles ? 20 : 35,
        new THREE.TorusGeometry(1, 0.045, 5, 14),
        new THREE.MeshPhysicalMaterial({
          roughness: 0.12,
          metalness: 0.15,
          clearcoat: 1,
          iridescence: 1,
        }),
        ["#f9ffff"],
        false,
        item.bigBubbles ? 0.12 : 0.04,
      );
    if (item.glitter)
      addInstanced(
        item.glitter === "stars" ? 90 : 150,
        item.glitter === "stars"
          ? starGeometry()
          : new THREE.OctahedronGeometry(1),
        new THREE.MeshStandardMaterial({
          metalness: 0.7,
          roughness: 0.15,
          emissive: "#b09aa9",
          emissiveIntensity: 0.16,
        }),
        item.glitter === "rainbow"
          ? ["#fff3ab", "#f6a3d2", "#8dcddd", "#b297e0"]
          : item.glitter === "gold"
            ? ["#ffde8a"]
            : ["#fff7ea", "#c1bbf0"],
        true,
        0.014,
      );
    const attach = (mesh, q) => {
      this.attachments.push({ mesh, binding: skinBinding(this.body, q) });
      this.decor.add(mesh);
    };
    if (item.face) {
      for (const x of [-0.2, 0.2]) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 16, 12),
          new THREE.MeshStandardMaterial({ color: "#332d35", roughness: 0.3 }),
        );
        eye.scale.z = 0.6;
        attach(eye, [x, 0.05, 1.015]);
      }
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.075, 0.018, 0),
        new THREE.Vector3(0, -0.07, 0.02),
        new THREE.Vector3(0.075, 0.018, 0),
      );
      attach(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, 12, 0.014, 7, false),
          new THREE.MeshStandardMaterial({ color: "#443641" }),
        ),
        [0, -0.1, 1.02],
      );
    }
    if (item.stem)
      attach(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.045, 0.25, 9),
          new THREE.MeshStandardMaterial({ color: "#765438" }),
        ),
        [0, 1.08, 0],
      );
    if (item.jellyfish)
      for (let i = 0; i < 7; i++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.04, -0.2, 0.03),
          new THREE.Vector3(-0.04, -0.36, 0.07),
        ]);
        attach(
          new THREE.Mesh(
            new THREE.TubeGeometry(curve, 12, 0.065, 9, false),
            this.skin.mesh.material.clone(),
          ),
          [(i - 3) * 0.23, -0.72, 0.65],
        );
      }
  }
  updateDecor() {
    const temp = new THREE.Object3D(),
      p = new Float32Array(3);
    for (const { mesh, nodes } of this.instanced) {
      nodes.forEach((node, i) => {
        skinPoint(this.body, node.binding, p);
        temp.position.fromArray(p);
        temp.quaternion.copy(node.rotation);
        temp.scale.setScalar(node.scale);
        temp.updateMatrix();
        mesh.setMatrixAt(i, temp.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const a of this.attachments) {
      skinPoint(this.body, a.binding, p);
      a.mesh.position.fromArray(p);
    }
  }
  burst(point) {
    if (!this.item.fizz && !this.item.dust && this.item.texture !== "crunch")
      return;
    for (let i = 0; i < 6 && this.effects.length < 48; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(this.item.dust ? 0.025 : 0.04, 8, 6),
        new THREE.MeshStandardMaterial({
          color: this.item.dust ? "#fff4df" : "#f9ffff",
          transparent: true,
          opacity: 0.65,
          roughness: 0.3,
        }),
      );
      mesh.position.copy(point);
      this.scene.add(mesh);
      this.effects.push({
        mesh,
        age: 0,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.2,
          0.6 + Math.random(),
          (Math.random() - 0.5) * 1.2,
        ),
      });
    }
  }
  ray(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster;
  }
  installInput() {
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !this.skin) return;
      const hits = this.ray(e).intersectObject(
        this.coating?.mesh || this.skin.mesh,
      );
      let hit = hits[0] || this.ray(e).intersectObject(this.skin.mesh)[0];
      if (!hit) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.canvas.setPointerCapture(e.pointerId);
      const normal = hit.face.normal
          .clone()
          .transformDirection(hit.object.matrixWorld),
        direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        direction,
        hit.point,
      );
      this.body.release("magnet");
      this.body.grab(e.pointerId, hit.point.toArray(), normal.toArray());
      this.pointers.set(e.pointerId, {
        plane,
        point: hit.point.clone(),
        origin: hit.point.clone(),
        stretchBroken: false,
        normal,
        time: 0,
        hitTime: 0,
      });
      this.canvas.classList.add("holding");
      this.touchHeat = Math.min(1, this.touchHeat + 0.16);
      this.sound(
        this.coating
          ? "crack"
          : this.item.texture === "crunch"
            ? "crunch"
            : "soft",
      );
      this.burst(hit.point);
      this.onTouch();
      if (this.coating) {
        const result = this.coating.hit(hit.point);
        this.onCoating(
          result.broken
            ? "바사삭! 속살을 주물러 보세요"
            : "조금 더 누르면 껍질이 깨져요",
        );
      }
    });
    this.canvas.addEventListener("pointermove", (e) => {
      const handle = this.pointers.get(e.pointerId);
      if (handle) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const point = new THREE.Vector3();
        this.ray(e).ray.intersectPlane(handle.plane, point);
        point.y = Math.max(0.18, point.y);
        this.body.move(e.pointerId, point.toArray());
        if (
          this.item.id === 4 &&
          this.coating &&
          !handle.stretchBroken &&
          point.distanceTo(handle.origin) > 0.7
        ) {
          for (let i = 0; i < 7; i++) this.coating.hit(handle.origin);
          handle.stretchBroken = true;
          this.sound("crack");
          this.onCoating("당긴 곳의 껍질이 바사삭 갈라졌어요");
        }
        handle.point.copy(point);
      } else if (
        this.item?.magnet &&
        e.pointerType === "mouse" &&
        e.buttons === 0
      ) {
        const hit = this.ray(e).intersectObject(this.skin.mesh)[0];
        if (hit) {
          if (!this.body.handles.has("magnet"))
            this.body.grab("magnet", hit.point.toArray(), [0, 0, 0], 1.1);
          const n = new THREE.Vector3();
          this.camera.getWorldDirection(n);
          this.body.move(
            "magnet",
            hit.point.clone().addScaledVector(n, -0.35).toArray(),
          );
        } else this.body.release("magnet");
      }
    });
    const release = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.body.release(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!this.pointers.size) this.canvas.classList.remove("holding");
    };
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
    this.canvas.addEventListener("lostpointercapture", release);
    this.canvas.addEventListener("pointerleave", () =>
      this.body?.release("magnet"),
    );
    this.canvas.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        this.poke();
      }
      if (e.key === "Escape") this.clearInput();
    });
  }
  clearInput() {
    this.body?.releaseAll();
    this.pointers.clear();
    this.scheduled = [];
    this.canvas?.classList.remove("holding");
  }
  poke() {
    if (!this.body) return;
    const binding = skinBinding(this.body, [0.1, 0.4, 1]),
      point = new Float32Array(3);
    skinPoint(this.body, binding, point);
    this.body.grab("poke", Array.from(point), [0, 0.3, 1]);
    this.body.move("poke", [point[0], point[1] - 0.22, point[2] - 0.45]);
    this.scheduled.push({ id: "poke", remaining: 0.48 });
    this.sound(this.coating ? "crack" : "soft");
    this.onTouch();
    if (this.coating) this.coating.hit(new THREE.Vector3().fromArray(point));
    this.touchHeat = Math.min(1, this.touchHeat + 0.2);
    this.burst(new THREE.Vector3().fromArray(point));
  }
  reset() {
    this.select(this.item);
  }
  view() {
    this.camera.position.set(3, 2.8, 6.7);
    this.controls.target.set(0, 1.1, 0);
    this.controls.update();
  }
  animate(time) {
    if (!this.running || !this.body || document.hidden) return;
    const dt = Math.min((time - this.last) / 1000, 0.05);
    this.last = time;
    this.accumulator += dt;
    for (const [id, h] of this.pointers) {
      h.time += dt;
      h.hitTime += dt;
      if (this.coating && h.hitTime > 0.42) {
        this.coating.hit(h.point);
        h.hitTime = 0;
      }
      if (h.time > 1.2 && !this.coating) {
        this.touchHeat = Math.min(1, this.touchHeat + dt * 0.08);
      }
    }
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      const s = this.scheduled[i];
      s.remaining -= dt;
      if (s.remaining <= 0) {
        this.body.release(s.id);
        this.scheduled.splice(i, 1);
      }
    }
    if (this.coating) {
      const intact =
        1 - this.coating.removed.size / this.coating.regions.length;
      this.body.profile.compliance =
        this.baseCompliance * (1 - intact) + 0.00009 * intact;
    }
    let steps = 0;
    while (this.accumulator >= 1 / 60 && steps < 3) {
      this.body.step(1 / 60);
      this.accumulator -= 1 / 60;
      steps++;
    }
    this.skin.update();
    this.coating?.update(dt);
    this.updateDecor();
    this.touchHeat = Math.max(0, this.touchHeat - dt * 0.012);
    if (this.item.iridescent && !this.item.metal)
      this.skin.mesh.material.color.setHSL(
        (0.69 + this.touchHeat * 0.32) % 1,
        0.48,
        0.73,
      );
    if (this.item.jellyfish) {
      this.skin.mesh.material.transmission = 0.82 - this.touchHeat * 0.6;
      this.skin.mesh.material.roughness = 0.12 + this.touchHeat * 0.25;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dt;
      e.mesh.position.addScaledVector(e.velocity, dt);
      e.mesh.material.opacity = Math.max(0, 0.65 - e.age * 0.65);
      if (e.age > 1) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frame++;
  }
  metrics() {
    return {
      ...this.body.metrics(),
      skinVertices: this.skin.bindings.length,
      frame: this.frame,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      shellRemoved: this.coating?.removed.size || 0,
    };
  }
}
