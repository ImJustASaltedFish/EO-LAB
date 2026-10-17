// three.js models of the bench and parts. World axes: X = rail z, Y = height, Z = rail x (metres).
import * as THREE from 'three';
import { CONFIG } from '../optics/config.js';
import { cardPixel } from '../optics/screen.js';

const standard = (options) => new THREE.MeshStandardMaterial(options);

const SHARED = {
  table: standard({ color: 0x2a2d33, roughness: 0.85, metalness: 0.1 }),
  hole: new THREE.MeshBasicMaterial({ color: 0x0b0c0e }),
  rail: standard({ color: 0x3b3f47, roughness: 0.6, metalness: 0.5 }),
  tick: new THREE.MeshBasicMaterial({ color: 0x9aa0aa }),
  block: standard({ color: 0x0e0f11, roughness: 0.9 }),
  rack: standard({ color: 0x34383f, roughness: 0.7, metalness: 0.2 }),
  laserBody: standard({ color: 0x2f3a4a, roughness: 0.4, metalness: 0.5 }),
  laserNose: standard({ color: 0x111111, roughness: 0.6 }),
  mount: standard({ color: 0x1b1c1f, roughness: 0.5, metalness: 0.4 }),
  accent: standard({ color: 0x00bfff, roughness: 0.5 }),
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

// A post holder and a post from the table to `top`; returns a function that resizes the post.
function addPost(group, material) {
  const holder = cylinderY(0.012, 0.012, material);
  holder.position.y = 0.006;
  const post = cylinderY(0.006, 1, material);
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
    post: standard({ color: 0xb9bec7, roughness: 0.35, metalness: 0.8 }),
    accent: standard({ color: 0x00bfff, roughness: 0.5 }),
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

function buildLaser(root) {
  const group = new THREE.Group();
  group.name = 'laser';
  const body = cylinderX(0.02, 0.16, SHARED.laserBody);
  const nose = cylinderX(0.008, 0.01, SHARED.laserNose);
  const plate = box(0.12, 0.012, 0.07, SHARED.mount);
  const post = cylinderY(0.008, 1, SHARED.rail);
  const knobs = [0, 1, 2].map(() => cylinderY(0.006, 0.014, SHARED.accent));
  group.add(body, nose, plate, post, ...knobs);
  root.add(group);
  return {
    group,
    update({ height, pitch, yaw }) {
      body.position.set(-0.085, height, 0);
      nose.position.set(-0.004, height, 0);
      plate.position.set(-0.085, height - 0.028, 0);
      const postLength = Math.max(0.001, height - 0.034);
      post.scale.y = postLength;
      post.position.set(-0.085, postLength / 2, 0);
      knobs[0].position.set(-0.135, height - 0.02, 0.028);
      knobs[1].position.set(-0.135, height - 0.02, -0.028);
      knobs[2].position.set(-0.035, height - 0.02, 0.028);
      knobs[0].rotation.y = pitch * 300;   // knobs turn with their settings (visual feedback only)
      knobs[1].rotation.y = yaw * 300;
    },
  };
}

function buildIris() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const setPost = addPost(group, materials.post);
  const R = CONFIG.iris.plateRadius;
  const plate = new THREE.Mesh(new THREE.RingGeometry(0.006, R, 48), materials.anodised);
  plate.rotation.y = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.002, 8, 48), materials.anodised);
  rim.rotation.y = Math.PI / 2;
  const lever = box(0.003, 0.004, 0.012, materials.accent);
  group.add(plate, rim, lever);
  let opening = null;
  return {
    group,
    update(part, look = {}) {
      setPost(part.height - R);
      plate.position.y = part.height;
      rim.position.y = part.height;
      lever.position.set(0, part.height + R * 0.7, 0.012);
      if (part.opening !== opening) {
        plate.geometry.dispose();
        plate.geometry = new THREE.RingGeometry(part.opening / 2, R, 48);
        opening = part.opening;
      }
      applyLook(materials, look);
    },
  };
}

function buildSpatialFilter() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const setPost = addPost(group, materials.post);
  const base = box(0.075, 0.008, 0.05, materials.anodised);
  const ringPlate = box(0.006, 0.05, 0.05, materials.anodised);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(CONFIG.mount.ringRadius + 0.0015, 0.0015, 8, 32), materials.accent);
  ring.rotation.y = Math.PI / 2;
  const pinPlate = box(0.004, 0.05, 0.05, materials.anodised);
  const objective = cylinderX(0.009, 0.02, standard({ color: 0xc9ccd2, roughness: 0.3, metalness: 0.9 }));
  const pinhole = new THREE.Mesh(new THREE.CircleGeometry(0.004, 24), standard({ color: 0x111111, side: THREE.DoubleSide }));
  pinhole.rotation.y = Math.PI / 2;
  const knobX = cylinderY(0.004, 0.01, materials.accent);
  const knobY = cylinderY(0.004, 0.01, materials.accent);
  knobY.rotation.x = Math.PI / 2;
  group.add(base, ringPlate, ring, pinPlate, objective, pinhole, knobX, knobY);
  return {
    group,
    update(part, look = {}) {
      const h = part.height;
      setPost(h - 0.03);
      base.position.set(-0.03, h - 0.03, 0);
      ringPlate.position.set(-CONFIG.mount.ringOffset, h, 0);
      ring.position.set(-CONFIG.mount.ringOffset - 0.004, h, 0);
      pinPlate.position.set(0.002, h, 0);
      const dz = part.focus - CONFIG.objective.focusAt;
      objective.visible = part.objective;
      objective.position.set(-(CONFIG.objective.focalLength + dz) - 0.006, h, 0);
      pinhole.visible = part.pinhole;
      pinhole.position.set(-0.0005, h, 0);
      knobX.position.set(0.002, h + 0.03, 0.018);
      knobY.position.set(0.002, h, 0.03);
      knobX.rotation.y = part.phX * 2e4;   // pinhole knobs turn with their settings (visual feedback only)
      knobY.rotation.y = part.phY * 2e4;
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

function paintCard(data, pixels, image) {
  for (let j = 0; j < pixels; j++) {
    const row = pixels - 1 - j;   // texture row 0 is the bottom; image row 0 is the top
    for (let i = 0; i < pixels; i++) {
      const [r, g, b] = cardPixel(image ? image[row * pixels + i] : 0);
      const k = 4 * (j * pixels + i);
      data[k] = r;
      data[k + 1] = g;
      data[k + 2] = b;
      data[k + 3] = 255;
    }
  }
}

function buildScreen() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const { size, centreHeight, cardPixels } = CONFIG.screen;
  const data = new Uint8Array(cardPixels * cardPixels * 4);
  paintCard(data, cardPixels, null);
  const texture = new THREE.DataTexture(data, cardPixels, cardPixels, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const cardMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: false });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cardMaterial);
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
      paintCard(data, cardPixels, look.cardImage ?? null);
      texture.needsUpdate = true;
      applyLook(materials, look);
      cardMaterial.transparent = Boolean(look.locked);
      cardMaterial.opacity = look.locked ? 0.4 : 1;
    },
  };
}

const BUILDERS = { a1: buildIris, a2: buildIris, sf: buildSpatialFilter, lens: buildLens, screen: buildScreen };

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
