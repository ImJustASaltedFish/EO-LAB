import * as THREE from 'three';
import { test, assert, assertEqual, assertClose } from '../harness.js';
import { webglAvailable } from '../../js/scene/webgl.js';
import { createView } from '../../js/scene/view.js';
import { buildBench, createPartModel, rackSlot, createScreenModel, buildLaser } from '../../js/scene/models.js';
import { createInitialState, PART_IDS } from '../../js/lab/state.js';
import { CONFIG } from '../../js/optics/config.js';

test('scene: WebGL 2 is available in the test browser', () => {
  assert(webglAvailable(), 'webgl2 missing');
});

test('scene: bench and every part model build and render', () => {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px;position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  const view = createView(host);
  const benchModel = buildBench(view.scene);
  benchModel.laser.update({ height: 0.1 });
  const parts = createInitialState(1).parts;
  for (const id of PART_IDS) {
    const model = createPartModel(id);
    view.scene.add(model.group);
    const slot = rackSlot(id);
    model.group.position.set(slot.x, 0, slot.z);
    model.update({ ...parts[id], objective: true, pinhole: true }, { locked: id === 'lens', selected: id === 'a1', cardImage: null });
    assertEqual(model.group.userData.partId, id);
  }
  view.setPreset('overview');
  view.renderOnce();
  assert(view.renderer.info.render.calls > 10, `draw calls ${view.renderer.info.render.calls}`);
  view.dispose();
  host.remove();
});

test('scene: the spatial filter post is centred under its base; the iris pin swings with the opening', () => {
  const parts = createInitialState(1).parts;
  const sf = createPartModel('sf');
  sf.update({ ...parts.sf, objective: true, pinhole: true }, {});
  const base = sf.group.getObjectByName('base');
  const post = sf.group.getObjectByName('post');
  assertClose(post.position.x, base.position.x, 1e-9, 'post under the middle of the base, along the beam');
  assertClose(post.position.z, base.position.z, 1e-9, 'post under the middle of the base, across the beam');
  const iris = createPartModel('a1');
  const pin = iris.group.getObjectByName('pin');
  const angle = () => Math.atan2(pin.position.y - parts.a1.height, pin.position.z);
  iris.update({ ...parts.a1, opening: CONFIG.iris.openingMax }, {});
  assertClose(angle(), Math.PI / 2, 1e-6, 'fully open: the pin points straight up');
  iris.update({ ...parts.a1, opening: CONFIG.iris.openingMin }, {});
  assertClose(angle(), Math.PI / 4, 1e-6, 'closed: the pin has swung 45° to the side');
});

test('scene: the screen card carries the target paper, centred where it is told', () => {
  const screen = createPartModel('screen');
  const { size, centreHeight } = CONFIG.screen;
  screen.update(createInitialState(1).parts.screen, { cardImage: null, target: { x: 2e-3, y: centreHeight + 3e-3 } });
  const canvas = screen.group.getObjectByName('card').material.map.image;
  const perMetre = canvas.width / size;
  const g = (x, y) => canvas.getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data[1];
  const half = canvas.width / 2;
  assert(g(half + 2e-3 * perMetre, half - 3e-3 * perMetre) < 40, 'crosshair crossing at the target centre');
  assert(g(half, half) > 60, `the card centre, 3.6 mm from the target centre, is plain paper: ${g(half, half)}`);
});

test('scene: camera presets adapt to the shape of the 3D view', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const viewOf = (width, height) => {
    host.style.cssText = `width:${width}px;height:${height}px;position:absolute;left:-9999px;top:0`;
    return createView(host);
  };
  const tall = viewOf(300, 600);
  tall.setPreset('overview');
  assert(tall.camera.position.x < 0, `a tall view looks down the rail from the laser end: x=${tall.camera.position.x}`);
  tall.setPreset('filter', 0.25);
  const halfFov = Math.atan(Math.tan((tall.camera.fov * Math.PI) / 360) * tall.camera.aspect);
  const distance = tall.camera.position.distanceTo(tall.controls.target);
  assert(distance >= 0.1 / Math.tan(halfFov) - 1e-9, `the spatial-filter close-up fits horizontally: ${distance}`);
  tall.dispose();
  const wide = viewOf(1200, 600);
  wide.setPreset('overview');
  assertClose(wide.camera.position.distanceTo(wide.controls.target), Math.hypot(0.67, 1.05), 1e-6, 'a wide view keeps the standard overview');
  wide.dispose();
  host.remove();
});

test('scene: custom camera presets, and looking at a given point', () => {
  const host = document.createElement('div');
  host.style.cssText = 'width:800px;height:600px;position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  const presets = { overview: { position: [1, 1, 1], target: [0, 0, 0], halfWidth: 0 }, close: { position: [0.2, 0.3, 0.4], target: [0.1, 0.1, 0.1], halfWidth: 0 } };
  const view = createView(host, { presets });
  view.setPreset('close');
  assertClose(view.controls.target.x, 0.1, 1e-12);
  view.setPreset('close', { x: 0.5, y: 0.1, z: -0.2 });
  assertClose(view.controls.target.z, -0.2, 1e-12);
  assertClose(view.camera.position.x - view.controls.target.x, 0.1, 1e-9, 'same offset, new target');
  view.dispose();
  host.remove();
});

test('scene: the screen card takes a pixel mapping; the laser model can be built on its own', () => {
  const screen = createScreenModel({ pixel: () => [200, 10, 10] });
  screen.update({ placed: true }, { cardImage: new Float32Array(CONFIG.screen.cardPixels ** 2) });
  const canvas = screen.group.getObjectByName('card').material.map.image;
  const [r, g] = canvas.getContext('2d').getImageData(20, 20, 1, 1).data;
  assert(r > 150 && g < 50, `painted with the given mapping: ${r},${g}`);
  const laser = buildLaser(new THREE.Group());
  laser.update({ height: 0.1 });
  assertEqual(laser.group.name, 'laser');
});
