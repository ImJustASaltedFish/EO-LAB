import * as THREE from 'three';
import { test, assert, assertEqual, assertClose } from '../harness.js';
import { createView } from '../../js/scene/view.js';
import { buildMichelsonTable, createMichelsonPart, createGhost, yawFor, rackSlot } from '../../js/scene/michelson-models.js';
import { tableDrop } from '../../js/scene/table.js';
import { createMichelsonState, PART_IDS } from '../../js/michelson/state.js';

test('michelson scene: the table, the ready source and every part build and render', () => {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px;position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  const view = createView(host);
  const table = buildMichelsonTable(view.scene);
  table.setIris(1e-3);
  const parts = createMichelsonState(1).parts;
  for (const id of PART_IDS) {
    const model = createMichelsonPart(id);
    view.scene.add(model.group);
    const slot = rackSlot(id);
    model.group.position.set(slot.x, 0, slot.z);
    model.update(parts[id], { locked: id === 'lens1', selected: id === 'bs', cardImage: null });
    assertEqual(model.group.userData.partId, id);
    view.scene.add(createGhost(id));
  }
  view.renderOnce();
  assert(view.renderer.info.render.calls > 20, `draw calls ${view.renderer.info.render.calls}`);
  view.dispose();
  host.remove();
});

test('michelson scene: headings turn models built facing the laser; M1 rides its stage', () => {
  const facing = (heading) => new THREE.Vector3(-1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawFor(heading));
  assertClose(facing(4).x, -1, 1e-12, 'heading 4 faces the laser (−X)');
  assertClose(facing(2).z, 1, 1e-12, 'heading 2 faces table +x (world +Z)');
  assertClose(facing(6).z, -1, 1e-12, 'heading 6 faces table −x');
  const m1 = createMichelsonPart('m1');
  m1.update({ ...createMichelsonState(1).parts.m1, stage: 0.0225 }, {});
  const head = m1.group.children[0];
  assertClose(head.position.x, 0.01, 1e-12, 'stage 22.5 mm moves the mirror 10 mm back');
});

test('michelson scene: pointer drops land on the table, on the rack, or nowhere', () => {
  const onTable = tableDrop({ x: 0.3, z: 0.1 });
  assertEqual(onTable.kind, 'table');
  assertClose(onTable.pos.z, 0.3, 1e-12, 'world X is table z');
  assertClose(onTable.pos.x, 0.1, 1e-12, 'world Z is table x');
  assertEqual(tableDrop({ x: 0.3, z: -0.5 }).kind, 'rack');
  assertEqual(tableDrop({ x: 0.3, z: 0.6 }).kind, 'cancel');
  assertEqual(tableDrop(null).kind, 'cancel');
});
