// three.js models for the Michelson page: the breadboard with the ready source, the parts students place, and the
// layout-guide outlines. World axes as Experiment 1: X = table z (along the source beam), Y = height, Z = table x.
import * as THREE from 'three';
import { MI } from '../michelson/config.js';
import { CONFIG } from '../optics/config.js';
import { brightPixel } from '../optics/screen.js';
import { createPartModel, createScreenModel, buildLaser } from './models.js';

const standard = (options) => new THREE.MeshStandardMaterial(options);
const SHARED = {
  table: standard({ color: 0x1d2025, roughness: 0.85, metalness: 0.1 }),
  hole: new THREE.MeshBasicMaterial({ color: 0x0b0c0e }),
  rail: standard({ color: 0x3b3f47, roughness: 0.6, metalness: 0.5 }),
  rack: standard({ color: 0x34383f, roughness: 0.7, metalness: 0.2 }),
};

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function cylinder(radius, height, material, segments = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
}

// A cylinder lying along X (an optic facing ±X, a knob or a micrometer barrel).
function cylinderX(radius, length, material, segments = 32) {
  const mesh = cylinder(radius, length, material, segments);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

// A post from the table up to `top`, at local x.
function post(material, top, x = 0) {
  const mesh = cylinder(0.006, top, material);
  mesh.position.set(x, top / 2, 0);
  return mesh;
}

// The three.js yaw that turns a model built facing world −X (toward the laser) to face `heading` (+ `extra` rad).
export function yawFor(heading, extra = 0) {
  return Math.PI - (heading * Math.PI) / 4 - extra;
}

function partMaterials() {
  return {
    anodised: standard({ color: 0x1b1c1f, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
    post: standard({ color: 0xb9bec7, roughness: 0.35, metalness: 0.8 }),
    silver: standard({ color: 0xe8ecf2, roughness: 0.05, metalness: 1, side: THREE.DoubleSide }),
    knurl: standard({ color: 0xc8cbd0, roughness: 0.6, metalness: 0.5 }),
  };
}

function applyLook(materials, { locked = false, selected = false } = {}) {
  for (const m of Object.values(materials)) {
    m.transparent = locked;
    m.opacity = locked ? 0.35 : 1;
    m.emissive.setHex(selected ? 0x0a4a5c : 0x000000);
  }
}

const glass = (opacity, color = 0xccffff, metalness = 0) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness, transparent: true, opacity, side: THREE.DoubleSide });

export function buildMichelsonTable(scene) {
  const root = new THREE.Group();
  root.name = 'table';
  const T = MI.table;
  const top = box(T.zMax - T.zMin, 0.03, T.xMax - T.xMin, SHARED.table);
  top.position.set((T.zMax + T.zMin) / 2, -0.015, (T.xMax + T.xMin) / 2);
  root.add(top);

  const zs = [];
  const xs = [];
  for (let z = T.holeZ0; z < T.zMax; z += T.pitch) zs.push(z);
  for (let x = T.holeX0; x < T.xMax; x += T.pitch) xs.push(x);
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.003, 12), SHARED.hole, zs.length * xs.length);
  const matrix = new THREE.Matrix4();
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const one = new THREE.Vector3(1, 1, 1);
  let index = 0;
  for (const z of zs) {
    for (const x of xs) {
      matrix.compose(new THREE.Vector3(z, 0.0005, x), flat, one);
      holes.setMatrixAt(index++, matrix);
    }
  }
  root.add(holes);

  const rack = box(1.0, 0.01, 0.08, SHARED.rack);
  rack.position.set(0.35, 0.005, T.xMin - 0.07);
  root.add(rack);

  // The ready source on row x = 0: laser, spatial filter, collimating lens and iris on a short rail.
  const railStart = MI.source.laserZ - 0.17;
  const rail = box(MI.source.irisZ - railStart + 0.02, 0.008, 0.03, SHARED.rail);
  rail.position.set((MI.source.irisZ + railStart) / 2, 0.004, 0);
  root.add(rail);
  const laser = buildLaser(root);
  laser.update({ height: MI.beamHeight });
  laser.group.position.x = MI.source.laserZ;
  const filter = createPartModel('sf');
  filter.group.position.x = MI.source.pinholeZ;
  filter.update({ height: MI.beamHeight, objective: true, pinhole: true, focus: CONFIG.objective.focusAt, phX: 0, phY: 0 }, {});
  const lens = createPartModel('lens');
  lens.group.position.x = MI.source.lensZ;
  lens.update({ height: MI.beamHeight }, {});
  const iris = createPartModel('a2');
  iris.group.position.x = MI.source.irisZ;
  root.add(filter.group, lens.group, iris.group);
  scene.add(root);
  return {
    root,
    setIris(opening) {
      iris.update({ height: MI.beamHeight, opening }, {});
    },
  };
}

// 50:50 plate in a ring mount on a rotation stage. The plate faces ±X; the heading turns the whole group.
function buildSplitter() {
  const materials = partMaterials();
  const plateMaterial = glass(0.45, 0xbfe8ff, 0.3);
  const group = new THREE.Group();
  const holder = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(MI.bs.radius + 0.002, 0.0025, 12, 48), materials.anodised);
  ring.rotation.y = Math.PI / 2;
  holder.add(ring, cylinderX(MI.bs.radius, 0.002, plateMaterial, 48));
  holder.position.y = MI.beamHeight;
  const stage = cylinder(0.02, 0.012, materials.anodised, 32);
  stage.position.y = 0.006;
  group.add(holder, post(materials.post, MI.beamHeight - MI.bs.radius - 0.004), stage);
  return {
    group,
    update(part, look = {}) {
      holder.rotation.set(0, -part.rotation, part.tilt);   // the knobs turn and tip the plate (visual feedback)
      applyLook(materials, look);
      plateMaterial.opacity = look.locked ? 0.15 : 0.45;
    },
  };
}

// Flat mirror in a square kinematic mount with two knobs; M1 sits on a linear stage with a micrometer.
function buildMirror(withStage) {
  const materials = partMaterials();
  const group = new THREE.Group();
  const head = new THREE.Group();
  const plate = box(0.01, 0.04, 0.04, materials.anodised);
  plate.position.set(0.006, MI.beamHeight, 0);
  const surface = cylinderX(MI.mirror.radius, 0.004, materials.silver, 40);
  surface.position.set(-0.001, MI.beamHeight, 0);
  const knobs = [[0.013, -0.013], [-0.013, 0.013]].map(([dy, dz]) => {
    const knob = cylinderX(0.004, 0.012, materials.knurl, 16);
    knob.position.set(0.017, MI.beamHeight + dy, dz);
    return knob;
  });
  head.add(plate, surface, ...knobs);
  group.add(head);
  if (withStage) {
    const stageTop = MI.beamHeight - 0.02;
    const stage = box(0.06, 0.015, 0.05, materials.anodised);
    stage.position.set(0.006, stageTop - 0.0075, 0);
    const barrel = cylinderX(0.004, 0.025, materials.silver, 16);
    barrel.position.set(0.05, stageTop - 0.0075, 0.012);
    const thimble = cylinderX(0.006, 0.018, materials.knurl, 24);
    thimble.position.set(0.07, stageTop - 0.0075, 0.012);
    group.add(stage, barrel, thimble, post(materials.post, stageTop - 0.015, 0.006));
  } else {
    group.add(post(materials.post, MI.beamHeight - 0.02, 0.006));
  }
  return {
    group,
    update(part, look = {}) {
      if (withStage) head.position.x = part.stage - MI.stage.initial;   // larger readings move the mirror back
      knobs[0].rotation.x = part.h * 300;   // knobs turn with their settings (visual feedback only)
      knobs[1].rotation.x = part.v * 300;
      applyLook(materials, look);
    },
  };
}

function buildBigLens() {
  const materials = partMaterials();
  const lensMaterial = glass(0.35);
  const group = new THREE.Group();
  const radius = 0.0254;
  const holder = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.003, 0.0035, 12, 56), materials.anodised);
  holder.rotation.y = Math.PI / 2;
  holder.position.y = MI.beamHeight;
  const disc = cylinderX(radius, 0.006, lensMaterial, 56);
  disc.position.y = MI.beamHeight;
  group.add(holder, disc, post(materials.post, MI.beamHeight - radius - 0.006));
  return {
    group,
    update(part, look = {}) {
      applyLook(materials, look);
      lensMaterial.opacity = look.locked ? 0.15 : 0.35;
    },
  };
}

const BUILDERS = {
  bs: buildSplitter,
  m1: () => buildMirror(true),
  m2: () => buildMirror(false),
  screen: () => createScreenModel({ pixel: brightPixel }),
  lens1: buildBigLens,
  lens2: buildBigLens,
};

export function createMichelsonPart(id) {
  const part = BUILDERS[id]();
  part.group.name = id;
  part.group.userData.partId = id;
  part.group.traverse((object) => {
    if (object.isMesh) object.userData.partId = id;
  });
  return part;
}

// A faint box the size of a part's footprint, for the layout guide.
export function createGhost(id) {
  const [along, across] = MI.footprints[id];
  const material = new THREE.MeshBasicMaterial({ color: 0x00bfff, transparent: true, opacity: 0.22, depthWrite: false });
  const ghost = box(along, 0.12, across, material);
  ghost.position.y = 0.06;
  const group = new THREE.Group();
  group.name = `guide-${id}`;
  group.add(ghost);
  return group;
}

const RACK_X = { bs: 0.0, m1: 0.15, m2: 0.3, screen: 0.5, lens1: 0.68, lens2: 0.8 };

// Where a part waits on the rack (world X, Z).
export function rackSlot(id) {
  return { x: RACK_X[id], z: MI.table.xMin - 0.07 };
}
