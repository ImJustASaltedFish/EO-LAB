// three.js models of the bench and parts. World axes: X = rail z, Y = height, Z = rail x (metres).
import * as THREE from 'three';
import { CONFIG } from '../optics/config.js';
import { cardPixel } from '../optics/screen.js';
import { drawTarget } from '../ui/target.js';

const standard = (options) => new THREE.MeshStandardMaterial(options);

const SHARED = {
  table: standard({ color: 0x1d2025, roughness: 0.85, metalness: 0.1 }),
  hole: new THREE.MeshBasicMaterial({ color: 0x0b0c0e }),
  rail: standard({ color: 0x3b3f47, roughness: 0.6, metalness: 0.5 }),
  tick: new THREE.MeshBasicMaterial({ color: 0x9aa0aa }),
  block: standard({ color: 0x0e0f11, roughness: 0.9 }),
  rack: standard({ color: 0x34383f, roughness: 0.7, metalness: 0.2 }),
  laserBody: standard({ color: 0x2f3a4a, roughness: 0.4, metalness: 0.5 }),
  laserNose: standard({ color: 0x111111, roughness: 0.6 }),
  mount: standard({ color: 0x1b1c1f, roughness: 0.5, metalness: 0.4 }),
};

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function cylinderX(radius, length, material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function cylinderY(radius, height, material, segments = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
}

function cylinderZ(radius, length, material, segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

// Flat disc / ring facing along the beam (±X).
function discX(radius, material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, segments), material);
  mesh.rotation.y = Math.PI / 2;
  return mesh;
}

function ringX(inner, outer, material, segments = 64) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, segments), material);
  mesh.rotation.y = Math.PI / 2;
  return mesh;
}

// A post holder and a post from the table to `top`, centred at x; returns a function that resizes the post.
function addPost(group, material, x = 0, radius = 0.006) {
  const holder = cylinderY(0.012, 0.012, material);
  holder.position.set(x, 0.006, 0);
  const post = cylinderY(radius, 1, material);
  post.name = 'post';
  post.position.x = x;
  group.add(holder, post);
  return (top) => {
    const length = Math.max(0.001, top - 0.012);
    post.scale.y = length;
    post.position.y = 0.012 + length / 2;
  };
}

function partMaterials() {
  return {
    anodised: standard({ color: 0x1b1c1f, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
    blade: standard({ color: 0x0c0d0f, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide }),
    post: standard({ color: 0xb9bec7, roughness: 0.35, metalness: 0.8 }),
    chrome: standard({ color: 0xd4d8de, roughness: 0.25, metalness: 0.95, side: THREE.DoubleSide }),
    brass: standard({ color: 0xb08a3e, roughness: 0.35, metalness: 0.85 }),
    knurl: standard({ color: 0xc8cbd0, roughness: 0.6, metalness: 0.5 }),
  };
}

function applyLook(materials, { locked = false, selected = false }) {
  for (const m of Object.values(materials)) {
    m.transparent = locked;
    m.opacity = locked ? 0.35 : 1;
    m.emissive.setHex(selected ? 0x0a4a5c : 0x000000);
  }
}

export function buildBench(scene) {
  const root = new THREE.Group();
  root.name = 'bench';
  const table = box(1.4, 0.03, 0.6, SHARED.table);
  table.position.set(0.5, -0.015, 0);
  root.add(table);

  const xs = [];
  const zs = [];
  for (let x = -0.1875; x < 1.2; x += 0.025) xs.push(x);
  for (let z = -0.2875; z < 0.3; z += 0.025) zs.push(z);
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.003, 12), SHARED.hole, xs.length * zs.length);
  const matrix = new THREE.Matrix4();
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const one = new THREE.Vector3(1, 1, 1);
  let index = 0;
  for (const x of xs) {
    for (const z of zs) {
      matrix.compose(new THREE.Vector3(x, 0.0005, z), flat, one);
      holes.setMatrixAt(index++, matrix);
    }
  }
  root.add(holes);

  const rail = box(1.15, 0.008, 0.03, SHARED.rail);
  rail.position.set(0.575, 0.004, 0);
  root.add(rail);
  for (let mm = 0; mm <= 1150; mm += 50) {
    const tick = box(0.0015, 0.001, mm % 100 === 0 ? 0.03 : 0.018, SHARED.tick);
    tick.position.set(mm / 1000, 0.0085, 0.024);
    root.add(tick);
  }

  const block = box(0.02, 0.06, 0.06, SHARED.block);
  block.position.set(CONFIG.rail.beamBlockZ + 0.01, CONFIG.laser.exitHeight, 0);
  root.add(block);

  const rack = box(1.0, 0.01, 0.08, SHARED.rack);
  rack.position.set(0.5, 0.005, -0.24);
  root.add(rack);

  scene.add(root);
  return { root, laser: buildLaser(root) };
}

export function buildLaser(root) {
  const group = new THREE.Group();
  group.name = 'laser';
  const body = cylinderX(0.02, 0.16, SHARED.laserBody);
  const nose = cylinderX(0.008, 0.01, SHARED.laserNose);
  const plate = box(0.12, 0.012, 0.07, SHARED.mount);
  const post = cylinderY(0.008, 1, SHARED.rail);
  group.add(body, nose, plate, post);
  root.add(group);
  return {
    group,
    // The laser is fixed and level: only its (random) exit height changes the model.
    update({ height }) {
      body.position.set(-0.085, height, 0);
      nose.position.set(-0.004, height, 0);
      plate.position.set(-0.085, height - 0.028, 0);
      const postLength = Math.max(0.001, height - 0.034);
      post.scale.y = postLength;
      post.position.set(-0.085, postLength / 2, 0);
    },
  };
}

// The iris pin points straight up when fully open and swings 45° to the side (toward +x, the student's right
// when facing the laser side) as the iris closes, like a post-mounted iris diaphragm.
function irisPinAngle(opening) {
  const { openingMin, openingMax } = CONFIG.iris;
  const t = Math.min(1, Math.max(0, (opening - openingMin) / (openingMax - openingMin)));
  return Math.PI / 4 + (Math.PI / 4) * t;
}

function buildIris() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const setPost = addPost(group, materials.post);
  const R = CONFIG.iris.plateRadius;
  const inner = R - 0.0055;      // the housing's face ring is 5.5 mm wide; the blades fill the rest
  const thickness = 0.008;
  const housing = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, thickness, 64, 1, true), materials.anodised);
  shell.rotation.z = Math.PI / 2;
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(inner, inner, thickness, 64, 1, true), materials.anodised);
  bore.rotation.z = Math.PI / 2;
  const frontFace = ringX(inner, R, materials.anodised);
  frontFace.position.x = -thickness / 2;
  const backFace = ringX(inner, R, materials.anodised);
  backFace.position.x = thickness / 2;
  const bladesFront = ringX(0.006, inner, materials.blade);
  bladesFront.position.x = -0.001;
  const bladesBack = ringX(0.006, inner, materials.blade);
  bladesBack.position.x = 0.001;
  const screws = [-1, 1].map((side) => {
    const screw = cylinderX(0.0012, 0.001, materials.chrome, 12);
    screw.position.set(-thickness / 2 - 0.0004, 0, side * (R - 0.0028));
    return screw;
  });
  housing.add(shell, bore, frontFace, backFace, bladesFront, bladesBack, ...screws);
  const pin = cylinderY(0.0008, 0.014, materials.chrome, 12);
  pin.name = 'pin';
  const pinCap = cylinderY(0.0013, 0.003, materials.chrome, 12);
  group.add(housing, pin, pinCap);
  let opening = null;
  return {
    group,
    update(part, look = {}) {
      setPost(part.height - R);
      housing.position.y = part.height;
      if (part.opening !== opening) {
        for (const blades of [bladesFront, bladesBack]) {
          blades.geometry.dispose();
          blades.geometry = new THREE.RingGeometry(part.opening / 2, inner, 64);
        }
        opening = part.opening;
      }
      const phi = irisPinAngle(part.opening);
      const along = (r) => [-0.002, part.height + r * Math.sin(phi), r * Math.cos(phi)];
      pin.position.set(...along(R + 0.007));
      pinCap.position.set(...along(R + 0.0155));
      pin.rotation.set(Math.PI / 2 - phi, 0, 0);
      pinCap.rotation.set(Math.PI / 2 - phi, 0, 0);
      applyLook(materials, look);
    },
  };
}

// Spatial filter like a post-mounted filter: a base block on one post under its middle; a front plate with a
// bore that slides with the focus micrometer and carries the objective; a rear plate holding the pinhole with
// knurled X/Y knobs on brass collars (top knob = vertical, side knob = horizontal).
function buildSpatialFilter() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const baseLength = 0.07;
  const baseCentreX = -0.03;     // the base runs from 65 mm upstream of the pinhole plane to 5 mm past it
  const setPost = addPost(group, materials.anodised, baseCentreX, 0.0063);
  const base = box(baseLength, 0.02, 0.05, materials.anodised);
  base.name = 'base';
  const lock = cylinderZ(0.003, 0.006, materials.brass);

  const rear = box(0.008, 0.05, 0.05, materials.anodised);
  const holderFrame = box(0.0015, 0.018, 0.018, materials.blade);
  const holderHole = discX(0.0045, materials.blade);
  const pinhole = discX(0.004, materials.chrome);
  const pinholeDot = discX(0.0007, materials.blade);
  const topCollar = cylinderY(0.004, 0.004, materials.brass);
  const topKnob = cylinderY(0.0065, 0.009, materials.knurl);
  const sideCollar = cylinderZ(0.004, 0.004, materials.brass);
  const sideKnob = cylinderZ(0.0065, 0.009, materials.knurl);

  const front = box(0.008, 0.034, 0.036, materials.anodised);
  const frontHole = discX(0.0055, materials.blade);
  const objective = new THREE.Group();
  const barrel = cylinderX(0.008, 0.024, materials.chrome);
  barrel.position.x = -0.014;      // positions relative to the objective tip
  const band = cylinderX(0.0083, 0.002, materials.anodised);
  band.position.x = -0.022;
  const nose = cylinderX(0.0045, 0.004, materials.chrome);
  nose.position.x = -0.002;
  objective.add(barrel, band, nose);

  const micrometer = cylinderX(0.0045, 0.02, materials.chrome);
  const thimble = cylinderX(0.0065, 0.016, materials.knurl);

  group.add(base, lock, rear, holderFrame, holderHole, pinhole, pinholeDot, topCollar, topKnob, sideCollar, sideKnob,
    front, frontHole, objective, micrometer, thimble);
  return {
    group,
    update(part, look = {}) {
      const h = part.height;
      const baseTop = h - 0.022;
      setPost(baseTop - 0.02);
      base.position.set(baseCentreX, baseTop - 0.01, 0);
      lock.position.set(baseCentreX, baseTop - 0.016, 0.028);

      rear.position.set(0.001, baseTop + 0.025, 0);
      holderFrame.position.set(-0.0035, h, 0);
      holderHole.position.set(-0.0044, h, 0);
      pinhole.visible = part.pinhole;
      pinholeDot.visible = part.pinhole;
      pinhole.position.set(-0.0047, h, 0);
      pinholeDot.position.set(-0.0049, h, 0);
      const plateTop = baseTop + 0.05;
      topCollar.position.set(0.001, plateTop + 0.002, 0);
      topKnob.position.set(0.001, plateTop + 0.0085, 0);
      sideCollar.position.set(0.001, h, 0.027);
      sideKnob.position.set(0.001, h, 0.0335);
      topKnob.rotation.y = part.phY * 2e4;   // knobs turn with their settings (visual feedback only)
      sideKnob.rotation.y = part.phX * 2e4;

      // The objective's tip sits at its principal plane, f0 + Δz upstream of the pinhole; its plate moves with it.
      const tipX = -(CONFIG.objective.focalLength + part.focus - CONFIG.objective.focusAt);
      front.position.set(tipX - 0.03, baseTop + 0.017, 0);
      frontHole.position.set(tipX - 0.0345, h, 0);
      objective.visible = part.objective;
      objective.position.set(tipX, h, 0);

      micrometer.position.set(baseCentreX - baseLength / 2 - 0.01, baseTop - 0.01, 0.016);
      thimble.position.set(baseCentreX - baseLength / 2 - 0.028, baseTop - 0.01, 0.016);
      thimble.rotation.x = (part.focus / 0.0005) * 2 * Math.PI;   // 0.5 mm per turn
      applyLook(materials, look);
    },
  };
}

function buildLens() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const setPost = addPost(group, materials.post);
  const radius = CONFIG.lens.diameter / 2;
  const holder = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.002, 0.003, 12, 48), materials.anodised);
  holder.rotation.y = Math.PI / 2;
  const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0xccffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35 });
  const glass = cylinderX(radius, 0.004, glassMaterial, 48);
  group.add(holder, glass);
  return {
    group,
    update(part, look = {}) {
      setPost(part.height - radius - 0.004);
      holder.position.y = part.height;
      glass.position.y = part.height;
      applyLook(materials, look);
      glassMaterial.opacity = look.locked ? 0.15 : 0.35;
    },
  };
}

// The card texture: the computed light over the whole card (image row 0 is the top), upscaled, with the target
// paper printed over it.
function paintCard(ctx, light, image, target, pixel) {
  const { size, centreHeight, cardPixels } = CONFIG.screen;
  const lightCtx = light.getContext('2d');
  const data = lightCtx.createImageData(cardPixels, cardPixels);
  for (let i = 0; i < cardPixels * cardPixels; i++) {
    const [r, g, b] = pixel(image ? image[i] : 0);
    data.data[4 * i] = r;
    data.data[4 * i + 1] = g;
    data.data[4 * i + 2] = b;
    data.data[4 * i + 3] = 255;
  }
  lightCtx.putImageData(data, 0, 0);
  const { width } = ctx.canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(light, 0, 0, width, width);
  drawTarget(ctx, { centre: target, left: -size / 2, top: centreHeight + size / 2, scale: width / size, lineWidth: 1.5, font: 11 });
}

// The screen card; `pixel` turns an image value into a colour (Experiment 1: relative intensity on the log curve).
export function createScreenModel({ pixel = cardPixel } = {}) {
  const materials = partMaterials();
  const group = new THREE.Group();
  const { size, centreHeight, cardPixels, cardTexture } = CONFIG.screen;
  const canvas = document.createElement('canvas');
  canvas.width = cardTexture;
  canvas.height = cardTexture;
  const light = document.createElement('canvas');
  light.width = cardPixels;
  light.height = cardPixels;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Without a target centre (e.g. in tests) the target paper sits in the middle of the card.
  const paint = (image, target) => {
    paintCard(canvas.getContext('2d'), light, image, target ?? { x: 0, y: centreHeight }, pixel);
    texture.needsUpdate = true;
  };
  paint(null, null);
  const cardMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: false });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cardMaterial);
  card.name = 'card';
  card.rotation.y = -Math.PI / 2;   // faces −X, toward the laser; local +X maps to world +Z (rail +x)
  card.position.set(0, centreHeight, 0);
  const back = box(0.003, size + 0.006, size + 0.006, materials.anodised);
  back.position.set(0.003, centreHeight, 0);
  const foot = box(0.06, 0.004, 0.16, materials.anodised);
  foot.position.set(0.03, 0.002, 0);
  const standHeight = centreHeight - size / 2;
  const stand = box(0.004, standHeight, 0.02, materials.anodised);
  stand.position.set(0.004, standHeight / 2, 0);
  group.add(card, back, foot, stand);
  return {
    group,
    update(part, look = {}) {
      paint(look.cardImage ?? null, look.target);
      applyLook(materials, look);
      cardMaterial.transparent = Boolean(look.locked);
      cardMaterial.opacity = look.locked ? 0.4 : 1;
    },
  };
}

const BUILDERS = { a1: buildIris, a2: buildIris, sf: buildSpatialFilter, lens: buildLens, screen: () => createScreenModel() };

export function createPartModel(id) {
  const part = BUILDERS[id]();
  part.group.name = id;
  part.group.userData.partId = id;
  part.group.traverse((object) => {
    if (object.isMesh) object.userData.partId = id;
  });
  return part;
}

const RACK_X = { a1: 0.08, a2: 0.22, sf: 0.42, lens: 0.66, screen: 0.86 };

export function rackSlot(id) {
  return { x: RACK_X[id], z: -0.24 };
}
