import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoftBody } from './soft-body.js';
import { WaxShell } from './wax-shell.js';
import { materialProfile, traits } from './materials.js';
import './studio.css';

const M = window.Malang;
const $ = id => document.getElementById(id);
let activeFilter = 'all', search = '', lastSlime = null, mode = 'touch';
const description = spec => {
  if (spec.type === 'wax') return '단단한 껍질의 가장자리를 쭉 당겨보세요.\n와장창 깨지면 쫀득한 속살이 나와요.';
  if (spec.type.includes('wax')) return '바삭한 겉껍질 안에 숨은 말랑한 속살.\n같은 자리를 톡톡 눌러 꺼내보세요.';
  if (spec.magnet) return '손끝을 기억하고 스르르 따라오는\n신기한 자석 퍼티예요.';
  if (spec.plastic) return '원하는 모양으로 주물러보세요.\n손끝이 만든 모양을 기억해요.';
  if (spec.jelly) return '투명한 몸과 작은 발이 말랑말랑.\n만질수록 우윳빛으로 물들어요.';
  if (spec.aurora) return '손끝이 닿을 때마다 흐르는 빛.\n오늘은 어떤 색을 만나게 될까요?';
  if (spec.type === 'cotton') return '작은 구름 한 조각을 쥔 것처럼.\n포슬포슬한 촉감을 느껴보세요.';
  if (spec.type === 'squishy') return '꾹 누르고, 천천히 기다려보세요.\n부드럽게 원래 모습으로 돌아와요.';
  return '촉촉한 빛을 머금은 나만의 말랑이.\n쭉 늘리고 놓으면 탱글탱글.';
};

function renderCatalog() {
  const items = M.catalog.filter(s => {
    const category = s.type.includes('wax') ? 'wax' : s.type === 'cotton' || s.type === 'squishy' || s.gloss < 0.2 ? 'foam' : 'jelly';
    return (activeFilter === 'all' || category === activeFilter) && s.name.includes(search);
  });
  $('studioCatalog').replaceChildren();
  for (const spec of items) {
    const button = document.createElement('button');
    button.className = 'catalog-item'; button.dataset.id = spec.id;
    button.setAttribute('aria-label', spec.name + ' 체험');
    const orb = document.createElement('span');
    orb.className = 'slime-orb ' + (spec.type.includes('wax') ? 'wax' : spec.type === 'cotton' || spec.gloss < 0.2 ? 'foam' : spec.shapePts ? 'special' : '');
    orb.style.setProperty('--slime', spec.waxColor || spec.color);
    const copy = document.createElement('span'); copy.className = 'catalog-copy';
    const name = document.createElement('b'); name.textContent = spec.name.replace(/[✨🌈]/gu, '');
    const small = document.createElement('small'); small.textContent = traits(spec)[0];
    copy.append(name, small);
    const grade = document.createElement('span'); grade.className = 'catalog-grade'; grade.textContent = spec.grade;
    button.append(orb, copy, grade);
    button.onclick = () => { M.select(spec.id); syncInfo(); };
    $('studioCatalog').append(button);
  }
  if (!items.length) { const p = document.createElement('p'); p.textContent = '이름을 다시 검색해 보세요.'; p.style.cssText = 'font-size:11px;color:#a38baa;text-align:center;padding:20px'; $('studioCatalog').append(p); }
  syncInfo();
}

function syncInfo() {
  const state = M.getState(), spec = state.spec;
  $('materialName').textContent = $('stageName').textContent = state.slime.customName || spec.name;
  $('materialGrade').textContent = state.slime.id === 'custom' ? '★' : spec.grade;
  $('materialDescription').textContent = description(spec);
  $('materialDescription').style.whiteSpace = 'pre-line';
  $('materialTags').replaceChildren(...traits(spec).slice(0, 4).map(t => { const e = document.createElement('span'); e.textContent = t; return e; }));
  const elasticity = Math.min(100, Math.round(spec.k / 0.22 * 100));
  const clarity = Math.round((1 - (spec.baseAlpha ?? 1)) * 100);
  const gloss = Math.round((spec.gloss ?? 0.5) * 100);
  for (const [id, val] of [['elastic', elasticity], ['clear', clarity], ['gloss', gloss]]) {
    $(id + 'Bar').style.width = val + '%'; $(id + 'Label').textContent = val;
  }
  $('previewBadge').textContent = state.preview ? '자유 체험 · COLLECTION ' + String(spec.id).padStart(2, '0') : '나의 말랑이 · Lv.' + state.slime.level;
  document.querySelectorAll('.catalog-item').forEach(b => {
    const selected = Number(b.dataset.id) === state.slime.id;
    b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected));
  });
  lastSlime = state.slime;
}

document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
  activeFilter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(t => t.classList.toggle('selected', t === b));
  renderCatalog();
});
$('slimeSearch').oninput = e => { search = e.target.value.trim(); renderCatalog(); };
document.querySelectorAll('[data-background]').forEach(b => b.onclick = () => {
  M.setBackground(b.dataset.background);
  document.querySelectorAll('[data-background]').forEach(t => t.classList.toggle('selected', t === b));
});
$('helpToggle').onclick = () => { window.malang3D?.cancelInteraction(); $('helpDialog').showModal(); };
$('closeHelp').onclick = () => $('helpDialog').close();
$('helpDialog').addEventListener('click', e => { if (e.target === $('helpDialog')) $('helpDialog').close(); });
let muted = localStorage.getItem('malang3d_muted') === 'true';
function soundUI() { M.toggleSound(muted); $('soundToggle').textContent = muted ? '♪̸' : '♫'; $('soundToggle').setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기'); }
$('soundToggle').onclick = () => { muted = !muted; localStorage.setItem('malang3d_muted', muted); soundUI(); };
soundUI();
$('resetSlime').onclick = () => { M.audio(); M.reset(); };
// Before using the collection economy, return from a temporary catalog preview.
['toggleInvBtn', 'fab-gacha', 'fab-shop', 'fab-custom', 'fab-book'].forEach(id => {
  $(id).addEventListener('click', () => { M.leavePreview(); syncInfo(); }, { capture: true });
});
renderCatalog();

class JellyStudio {
  constructor() {
    this.canvas = $('threeCanvas'); this.viewport = $('studioViewport');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.85;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enabled = false; this.controls.enableDamping = true; this.controls.enablePan = false;
    this.controls.minDistance = 5; this.controls.maxDistance = 13;
    this.controls.maxPolarAngle = Math.PI * 0.83; this.controls.minPolarAngle = 0.15;
    this.resetCamera();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    room.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b7a3bf', 0.8));
    const key = new THREE.DirectionalLight('#fff8fa', 2.2);
    key.position.set(-3, 6, 5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; key.shadow.bias = -0.001; key.shadow.normalBias = 0.025;
    key.shadow.radius = 4; this.scene.add(key);
    const rim = new THREE.DirectionalLight('#d7c6ff', 1.3); rim.position.set(4, 2, -2); this.scene.add(rim);
    const fill = new THREE.DirectionalLight('#d8f4ff', 0.5); fill.position.set(-4, 0, -3); this.scene.add(fill);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.platform = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.95, 0.12, 96), new THREE.MeshPhysicalMaterial({ color: '#eee3f1', roughness: 0.6, clearcoat: 0.3 }));
    this.platform.position.y = -1.91; this.platform.receiveShadow = true; this.scene.add(this.platform);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.89, 0.012, 8, 120), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -1.844; this.scene.add(ring);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.085 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.99; floor.receiveShadow = true; this.scene.add(floor);
    this.touches = new Map(); this.raycaster = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    this.wax = null; this.oldWax = []; this.decorations = []; this.effects = [];
    this.smallSphere = new THREE.SphereGeometry(1, 12, 8);
    this.state = M.getState(); this.bodyAlpha = this.state.spec.baseAlpha;
    this.build(this.state);
    new ResizeObserver(() => this.resize()).observe(this.viewport); this.resize();
    this.bindInput();
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.cancelInteraction(); $('loadingState').style.display = 'flex'; $('loadingState').textContent = '화면 연결이 끊겼어요. 복구를 기다리는 중…'; });
    this.canvas.addEventListener('webglcontextrestored', () => location.reload());
    $('qualityToggle').onclick = () => { this.highQuality = !this.highQuality; this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.highQuality ? 2 : 1.5)); this.resize(); $('qualityToggle').textContent = '화질 · ' + (this.highQuality ? '선명' : '균형'); $('qualityToggle').setAttribute('aria-pressed', String(!!this.highQuality)); };
    $('resetCamera').onclick = () => this.resetCamera();
    $('loadingState').style.display = 'none'; $('renderStatus').textContent = '실시간 3D · 마음껏 만져보세요';
    document.documentElement.dataset.renderer = 'three';
  }
  resize() {
    const { width, height } = this.viewport.getBoundingClientRect();
    this.renderer.setSize(width, height, false); this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix();
  }
  resetCamera() { this.camera.position.set(0, 2.3, 8.8); this.controls.target.set(0, -0.05, 0); this.controls.update(); }
  build(state) {
    this.cancelInteraction();
    if (this.body) { this.group.remove(this.body); this.soft.dispose(); this.body.material.dispose(); }
    this.wax?.dispose(); this.wax = null; this.oldWax.forEach(w => w.dispose()); this.oldWax = [];
    this.decorations.forEach(o => this.disposeObject(o)); this.decorations = [];
    this.effects.forEach(o => this.disposeObject(o)); this.effects = [];
    this.initialNodes = state.nodes; this.state = state;
    this.soft = new SoftBody(state);
    this.soft.geometry.computeBoundingBox();
    this.floorOffset = -1.84 - this.soft.geometry.boundingBox.min.y * state.radius * 0.016;
    this.body = new THREE.Mesh(this.soft.geometry, new THREE.MeshPhysicalMaterial(materialProfile(state.spec)));
    this.body.castShadow = true; this.group.add(this.body);
    this.group.scale.setScalar(state.radius * 0.016);
    this.group.position.set(0, this.floorOffset, 0);
    this.makeDecorations(state);
    if (state.waxIntact) this.createWax(state);
    syncInfo();
  }
  createWax(state) {
    this.wax = new WaxShell(this.soft.geometry, { ...state.spec }, this.group, () => M.breakWax(), heavy => M.crack(heavy));
    this.waxLayer = state.currentWaxLayer;
  }
  disposeObject(object) { this.group.remove(object); object.traverse(o => { if (o.geometry && o.geometry !== this.smallSphere) o.geometry.dispose(); if (o.material && o.material !== this.body?.material) o.material.dispose(); }); }
  sphere(color, radius, materialOptions = {}) {
    const mesh = new THREE.Mesh(this.smallSphere, new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 0.6, ...materialOptions }));
    mesh.scale.setScalar(radius); this.group.add(mesh); this.decorations.push(mesh); return mesh;
  }
  makeDecorations(state) {
    const { spec } = state;
    state.foamBeads.forEach((b, i) => {
      const cb = spec.customBeads?.[Math.floor((i - (spec.beads ? 44 : 0)) / 5)];
      const color = b.col || (spec.beadColors ? spec.beadColors[i % spec.beadColors.length] : ['#fff8fe', '#f8d6e5', '#ffffff'][i % 3]);
      const mesh = this.sphere(color.replace(/rgba?\(([^)]+)\)/, match => match), b.r * (cb?.rMul || 1), { roughness: cb?.pearl ? 0.13 : 0.45, iridescence: cb?.pearl ? 0.5 : 0 });
      mesh.userData = { kind: 'bead', data: b };
      if (cb?.shape === 'star') {
        const star = new THREE.Shape();
        for (let j = 0; j < 10; j++) {
          const a = Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? 0.43 : 1;
          if (j === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        star.closePath();
        mesh.geometry = new THREE.ExtrudeGeometry(star, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, steps: 1 });
      }
      if (cb?.shape === 'heart') {
        const heart = new THREE.Shape(); heart.moveTo(0, -0.8); heart.bezierCurveTo(-2, 0.6, -0.4, 1.7, 0, 0.7); heart.bezierCurveTo(0.4, 1.7, 2, 0.6, 0, -0.8);
        mesh.geometry = new THREE.ExtrudeGeometry(heart, { depth: 0.4, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2, steps: 1 });
      }
    });
    state.cottonPuffs.forEach(p => { const m = this.sphere('#f8f4f2', p.r, { roughness: 1, clearcoat: 0, sheen: 1 }); m.userData = { kind: 'puff', data: p }; });
    state.jellyFeet.forEach(f => { const m = new THREE.Mesh(this.smallSphere, this.body.material); m.scale.set(f.r, f.r * 1.65, f.r); m.userData = { kind: 'foot', data: f }; this.group.add(m); this.decorations.push(m); });
    if (spec.jelly || spec.faceTopping) {
      [['lx', 'ly', -0.2, 0.1], ['rx', 'ry', 0.2, 0.1], ['mx', 'my', 0, -0.035]].forEach(([kx, ky, x, y], i) => {
        const m = this.sphere('#4e415b', i === 2 ? 0.042 : 0.052, { roughness: 0.35, clearcoat: 0.2 });
        m.scale.y *= i === 2 ? 0.65 : 1.2; m.scale.z *= 0.5;
        m.userData = { kind: 'face', x, y, kx, ky }; m.position.set(x, y, 0.93);
      });
    }
    if (spec.decor === 'apple') {
      const apple = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.28, 8), new THREE.MeshStandardMaterial({ color: '#78513b', roughness: 0.8 })); stem.rotation.z = -0.2; apple.add(stem);
      const leaf = new THREE.Mesh(this.smallSphere, new THREE.MeshStandardMaterial({ color: '#63933d', roughness: 0.6 })); leaf.position.set(0.15, 0.04, 0); leaf.scale.set(0.2, 0.055, 0.08); leaf.rotation.z = 0.5; apple.add(leaf);
      apple.userData = { kind: 'apple' }; this.group.add(apple); this.decorations.push(apple);
    }
    state.galaxyStars.forEach(st => { const m = this.sphere(new THREE.Color().setHSL(st.hue / 360, 0.6, 0.8), st.sz, { emissive: '#a69aeb', emissiveIntensity: 2 }); m.userData = { kind: 'galaxy', data: st }; });
    // Small embedded air pockets make the jelly depth readable from the first frame.
    if (!spec.type.includes('wax') && spec.gloss >= 0.4 && spec.baseAlpha < 0.95 && !spec.galaxy) {
      for (let i = 0; i < 12; i++) {
        const x = (Math.random() - 0.5) * 1.05, y = (Math.random() - 0.5) * 0.9;
        const m = this.sphere('#caeafa', 0.018 + Math.random() * 0.025, { roughness: 0.05, metalness: 0.1 });
        m.userData = { kind: 'air', x, y, z: 0.2 + Math.random() * 0.45 };
      }
    }
  }
  onPhysicsStep(frame) {
    this.bodyAlpha = frame.bodyAlpha;
    const s = M.getState();
    if (s.nodes !== this.initialNodes) this.build(s);
    this.state = s;
    if (this.wax && (!s.waxIntact || this.waxLayer !== s.currentWaxLayer)) {
      this.wax.breakAll(); this.oldWax.push(this.wax); this.wax = null;
      if (s.waxIntact) this.createWax(s);
    }
    for (const touch of this.touches.values()) {
      if (this.wax && !touch.orbit && performance.now() - touch.lastWax > 480) {
        touch.lastWax = performance.now();
        this.wax.press(touch.local, ++touch.pulse);
      }
    }
    for (let i = s.fizzBubbles.length - 1; i >= 0; i--) { const b = s.fizzBubbles[i]; b.oy -= b.sp; b.wp += 0.05; if (b.oy < -0.9) s.fizzBubbles.splice(i, 1); }
    s.sparkles.forEach(b => { b.ph += b.spd; b.ox += b.dx || 0; b.oy += b.dy || 0; });
    for (let i = s.crunchParticles.length - 1; i >= 0; i--) { const p = s.crunchParticles[i]; p.x += p.vx; p.y += p.vy; p.alpha -= p.dust ? 0.0045 : 0.02; if (p.dust) p.size += p.grow; if (p.alpha <= 0) s.crunchParticles.splice(i, 1); }
    // 2D debris is superseded by the actual 3D shell fragments.
    s.waxShards.length = 0; s.decorShards.length = 0;
    Object.keys(s.jellyFace).forEach(k => { s.jellyFace[k] *= 0.97; });
  }
  updateDecorations(s, time) {
    for (const mesh of this.decorations) {
      const u = mesh.userData, b = u.data;
      if (u.kind === 'bead' || u.kind === 'puff') {
        const n = s.nodes[b.ni % s.nodes.length];
        const x = (n.x - s.core.x) / s.radius * b.f + (b.ox || 0), y = -(n.y - s.core.y) / s.radius * b.f - (b.oy || 0);
        const depth = Math.sqrt(Math.max(0.05, 1 - x * x - y * y)) * (s.spec.shapePts ? 0.4 : 0.88);
        mesh.position.set(x, y, depth * (u.kind === 'puff' ? 0.85 : 1.01));
      } else if (u.kind === 'foot') {
        b.slide *= 0.985; const ni = b.baseNi + b.slide, a = ((Math.floor(ni) % s.nodes.length) + s.nodes.length) % s.nodes.length, f = ni - Math.floor(ni);
        const p = s.nodes[a], q = s.nodes[(a + 1) % s.nodes.length];
        b.px = p.x + (q.x - p.x) * f; b.py = p.y + (q.y - p.y) * f + b.out * s.radius;
        mesh.position.set((b.px - s.core.x) / s.radius, -(b.py - s.core.y) / s.radius, 0.05);
      } else if (u.kind === 'face') {
        mesh.position.set(u.x + s.jellyFace[u.kx] / s.radius, u.y - s.jellyFace[u.ky] / s.radius, s.spec.jelly ? 0.66 : 0.91);
      } else if (u.kind === 'apple') {
        mesh.visible = s.waxIntact || !s.spec.type.includes('wax');
        mesh.position.set(0, Math.max(...s.nodes.map(n => -(n.y - s.core.y) / s.radius)) + 0.47, 0);
      } else if (u.kind === 'galaxy') {
        mesh.position.set(Math.cos(b.ang) * b.f, Math.sin(b.ang) * b.f * 0.8, Math.sqrt(1 - b.f * b.f) * 0.9);
        mesh.material.emissiveIntensity = 1 + Math.sin(time * b.spd + b.ph) * 0.7;
      } else if (u.kind === 'air') mesh.position.set(u.x, u.y, u.z);
    }
    const source = [
      ...s.fizzBubbles.map(b => ({ x: b.ox + Math.sin(b.wp) * 0.03, y: -b.oy, z: 0.84, size: b.r, color: '#f0fcff', opacity: 0.4, bubble: true })),
      ...s.sparkles.map(b => ({ x: b.ox, y: -b.oy, z: Math.sqrt(Math.max(0.1, 1 - b.ox ** 2 - b.oy ** 2)) * 0.96, size: b.sz * (0.6 + 0.3 * Math.sin(b.ph)), color: b.col, opacity: 0.9, star: true })),
      ...s.crunchParticles.map(p => ({ x: (p.x - s.core.x) / s.radius, y: -(p.y - s.core.y) / s.radius, z: 0.95, size: p.size / s.radius, color: 'rgb(' + (p.rgb || '255,255,255') + ')', opacity: p.alpha })),
    ];
    while (this.effects.length < source.length) {
      const mesh = new THREE.Mesh(this.smallSphere, new THREE.MeshPhysicalMaterial({ transparent: true, roughness: 0.1, depthWrite: false }));
      this.effects.push(mesh); this.group.add(mesh);
    }
    this.effects.forEach((m, i) => {
      const p = source[i]; m.visible = !!p && (!s.waxIntact || p.star);
      if (!p) return;
      m.position.set(p.x, p.y, p.z); m.scale.set(p.size, p.size, p.star ? p.size * 0.2 : p.size);
      m.material.color.set(p.color); m.material.opacity = p.opacity; m.material.emissive.set(p.star ? p.color : '#000000'); m.material.emissiveIntensity = p.star ? 1 : 0;
    });
  }
  renderFrame(dt) {
    if (!this.body) return;
    const s = this.state;
    this.soft.update(s, [...this.touches.values()], dt);
    const scale = s.radius * 0.016;
    this.group.scale.setScalar(scale);
    this.group.position.set((s.core.x - s.width / 2) * 0.016, this.floorOffset - (s.core.y - s.height / 2) * 0.016, 0);
    const mat = this.body.material;
    const color = s.spec.aurora ? new THREE.Color().setHSL(s.auroraHue / 360, s.auroraSat / 100, 0.92 - s.auroraSat * 0.0025)
      : s.spec.jelly ? new THREE.Color().setHSL(s.jellyHue / 360, s.jellySat / 100, s.jellyLit / 100)
      : new THREE.Color(s.spec.mysteryCore ? s.mysteryColor : s.spec.color);
    mat.color.copy(color); mat.attenuationColor.copy(color);
    mat.transmission = materialProfile(s.spec, this.bodyAlpha).transmission;
    if (s.spec.mysteryCore && !s.waxIntact) { mat.emissive.copy(color); mat.emissiveIntensity = 0.12 + 0.08 * Math.sin(performance.now() * 0.0011); }
    this.updateDecorations(s, performance.now() * 0.001);
    const floorY = (-1.85 - this.group.position.y) / scale;
    this.wax?.update(dt, floorY); this.oldWax.forEach(w => w.update(dt, floorY));
    for (let i = this.oldWax.length - 1; i >= 0; i--) if (!this.oldWax[i].fragments.length) { this.oldWax[i].dispose(); this.oldWax.splice(i, 1); }
    if (this.lastBg !== s.bgColor) {
      this.lastBg = s.bgColor; this.platform.material.color.set(s.bgColor).lerp(new THREE.Color('#f5f1fc'), 0.5);
      document.body.classList.toggle('night', new THREE.Color(s.bgColor).getHSL({}).l < 0.35);
    }
    this.controls.update(); this.renderer.render(this.scene, this.camera);
    if (s.slime !== lastSlime) syncInfo();
    $('waxStatus').hidden = !s.spec.type.includes('wax');
    if (s.spec.type.includes('wax')) $('waxStatus').textContent = s.waxIntact ? (s.spec.type === 'wax' ? '가장자리를 쭉 당기면 껍질이 깨져요' : '코팅 ' + (s.currentWaxLayer + 1) + '겹째 · ' + (this.wax?.patches.filter(p => p.removed).length || 0) + '곳 깨짐') : '껍질이 벗겨졌어요. 속살을 만져보세요!';
  }
  pick(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const objects = [this.body]; if (this.wax?.mesh.visible) objects.push(this.wax.mesh);
    return this.raycaster.intersectObjects(objects, false)[0];
  }
  cancelInteraction() {
    if (!this.touches) return;
    for (const id of this.touches.keys()) if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    this.touches.clear(); M.cancelPointers();
  }
  bindInput() {
    this.canvas.addEventListener('pointerdown', e => {
      if (mode !== 'touch' || e.button > 0) return;
      const hit = this.pick(e);
      if (!hit) {
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), point = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(plane, point)) M.background(this.state.width / 2 + point.x / 0.016, this.state.height / 2 - point.y / 0.016);
        return;
      }
      e.preventDefault(); this.canvas.setPointerCapture(e.pointerId);
      const local = this.group.worldToLocal(hit.point.clone());
      const normal = this.camera.getWorldDirection(new THREE.Vector3());
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point);
      const x = this.state.core.x + local.x * this.state.radius, y = this.state.core.y - local.y * this.state.radius;
      const offset = M.start(e.pointerId, x, y);
      const pulse = e.pointerId * 10000 + Math.floor(performance.now());
      const touch = { local, startLocal: local.clone(), plane, offset, pulse, lastWax: performance.now(), origin: hit.point.clone(), x: e.clientX, y: e.clientY };
      this.touches.set(e.pointerId, touch); this.wax?.press(local, pulse);
    });
    this.canvas.addEventListener('pointermove', e => {
      const touch = this.touches.get(e.pointerId); if (!touch) return;
      this.pick(e);
      const point = new THREE.Vector3(); if (!this.raycaster.ray.intersectPlane(touch.plane, point)) return;
      const local = this.group.worldToLocal(point);
      const moved = Math.hypot(e.clientX - touch.x, e.clientY - touch.y);
      if (moved > 3) {
        M.move(e.pointerId, this.state.core.x + local.x * this.state.radius + touch.offset.x, this.state.core.y - local.y * this.state.radius + touch.offset.y);
        touch.local.copy(local);
        this.wax?.press(local, touch.pulse);
      }
    });
    const end = e => { if (!this.touches.has(e.pointerId)) return; this.touches.delete(e.pointerId); M.end(e.pointerId); if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId); };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', () => this.cancelInteraction());
    this.canvas.addEventListener('lostpointercapture', e => { if (this.touches.has(e.pointerId)) this.cancelInteraction(); });
    window.addEventListener('blur', () => this.cancelInteraction());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.cancelInteraction(); });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
}

try { window.malang3D = new JellyStudio(); }
catch (error) {
  console.error('3D initialization failed:', error);
  window.malang3D = null;
  $('studioViewport').style.display = 'none'; $('slimeCanvas').style.display = 'block';
  $('renderStatus').textContent = '3D를 사용할 수 없어 2D로 실행 중';
  M.showToast('이 브라우저는 3D 화면을 지원하지 않아 2D로 열었어요.');
  document.documentElement.dataset.renderer = 'fallback';
}
function setMode(next) {
  mode = next; window.malang3D?.cancelInteraction();
  if (window.malang3D) window.malang3D.controls.enabled = mode === 'orbit';
  for (const type of ['touch', 'orbit']) { $(type + 'Mode').classList.toggle('selected', mode === type); $(type + 'Mode').setAttribute('aria-pressed', String(mode === type)); }
  $('interactionHint').textContent = mode === 'touch' ? '꾹 누르고, 쭉 늘려보세요' : '드래그로 돌리고, 휠이나 두 손가락으로 확대해요';
}
$('touchMode').onclick = () => setMode('touch'); $('orbitMode').onclick = () => setMode('orbit');
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('dialog[open]') || [...document.querySelectorAll('.modal-overlay')].some(m => getComputedStyle(m).display !== 'none')) return;
  if (e.code === 'Space') { e.preventDefault(); M.audio(); const s = M.getState(); M.jiggle(s.core.x - s.radius * 0.2, s.core.y); }
  if (e.code === 'KeyR') M.reset();
  if (e.code === 'KeyV') setMode(mode === 'touch' ? 'orbit' : 'touch');
  if (e.code.startsWith('Arrow') && window.malang3D) {
    e.preventDefault(); const studio = window.malang3D;
    const relative = studio.camera.position.clone().sub(studio.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(relative);
    spherical.theta += e.code === 'ArrowLeft' ? -0.15 : e.code === 'ArrowRight' ? 0.15 : 0;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + (e.code === 'ArrowUp' ? -0.12 : e.code === 'ArrowDown' ? 0.12 : 0), 0.15, 2.6);
    studio.camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(studio.controls.target)); studio.controls.update();
  }
});
