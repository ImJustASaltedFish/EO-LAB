import { test, assert, assertEqual } from '../harness.js';
import { webglAvailable } from '../../js/scene/webgl.js';
import { createView } from '../../js/scene/view.js';
import { buildBench, createPartModel, rackSlot } from '../../js/scene/models.js';
import { createInitialState, PART_IDS } from '../../js/lab/state.js';

test('scene: WebGL 2 is available in the test browser', () => {
  assert(webglAvailable(), 'webgl2 missing');
});

test('scene: bench and every part model build and render', () => {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px;position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  const view = createView(host);
  const benchModel = buildBench(view.scene);
  benchModel.laser.update({ height: 0.1, pitch: 0, yaw: 0 });
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
