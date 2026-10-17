import * as THREE from 'three';
import { test, assert, assertEqual, assertClose } from '../harness.js';
import { createBeamView, beamOpacity } from '../../js/scene/beam.js';
import { groundPoint, dropTarget } from '../../js/scene/interact.js';

test('scene: beam view draws core + glow per segment and one disc per spot', () => {
  const scene = new THREE.Scene();
  const beam = createBeamView(scene);
  beam.update({
    laserOn: true,
    segments: [
      { z0: 0, x0: 0, y0: 0.1, z1: 0.1, x1: 0, y1: 0.1, r0: 5e-4, r1: 5e-4, power: 1 },
      { z0: 0.1, x0: 0, y0: 0.1, z1: 0.8, x1: 0, y1: 0.1, r0: 5e-4, r1: 6e-4, power: 0.8 },
    ],
    spots: [{ z: 0.8, x: 0, y: 0.1, radius: 1e-3, power: 0.1 }],
  });
  assertEqual(beam.group.children.length, 5);
  beam.update({ laserOn: false, segments: [], spots: [] });
  assertEqual(beam.group.children.length, 0);
});

test('scene: beam opacity grows with power within 0.15–0.85', () => {
  assertClose(beamOpacity(0), 0.15, 1e-12);
  assertClose(beamOpacity(1), 0.85, 1e-12);
  assert(beamOpacity(0.01) < beamOpacity(0.5), 'monotonic');
});

test('interact: pointer rays meet the table top', () => {
  const p = groundPoint({ x: 0.5, y: 0.5, z: 0.5 }, { x: 0, y: -1, z: -1 });
  assertClose(p.x, 0.5, 1e-12);
  assertClose(p.z, 0, 1e-12);
  assertEqual(groundPoint({ x: 0, y: 0.5, z: 0 }, { x: 1, y: 0, z: 0 }), null, 'parallel ray');
  assertEqual(groundPoint({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 1, z: 0 }), null, 'pointing up');
});

test('interact: drop targets are the rail band, the rack area, or nothing', () => {
  const rail = dropTarget({ x: 0.42, z: 0.05 });
  assertEqual(rail.kind, 'rail');
  assertClose(rail.z, 0.42, 1e-12);
  assertEqual(dropTarget({ x: 0.3, z: -0.2 }).kind, 'rack');
  assertEqual(dropTarget({ x: 0.3, z: 0.25 }).kind, 'cancel');
  assertEqual(dropTarget(null).kind, 'cancel');
});
