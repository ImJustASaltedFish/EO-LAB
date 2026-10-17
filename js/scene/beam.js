// Glowing beam segments and light spots drawn from a BenchResult. World axes: X = rail z, Y = height, Z = rail x.
import * as THREE from 'three';

const MIN_RADIUS = 0.0006;
const UP = new THREE.Vector3(0, 1, 0);

export function beamOpacity(power) {
  return Math.min(0.85, Math.max(0.15, 0.15 + 0.7 * Math.max(0, power) ** 0.35));
}

function glowMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    color: 0x3cff5a,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function tube(segment, scale, extra, opacity) {
  const a = new THREE.Vector3(segment.z0, segment.y0, segment.x0);
  const b = new THREE.Vector3(segment.z1, segment.y1, segment.x1);
  const length = a.distanceTo(b);
  if (length < 1e-6) return null;
  const r0 = Math.max(segment.r0, MIN_RADIUS) * scale + extra;
  const r1 = Math.max(segment.r1, MIN_RADIUS) * scale + extra;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, length, 20, 1, true), glowMaterial(opacity));
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return mesh;
}

export function createBeamView(scene) {
  const group = new THREE.Group();
  group.name = 'beam';
  scene.add(group);
  function clear() {
    for (const child of [...group.children]) {
      child.geometry.dispose();
      child.material.dispose();
      group.remove(child);
    }
  }
  return {
    group,
    update(result) {
      clear();
      if (!result || !result.laserOn) return;
      for (const segment of result.segments) {
        const opacity = beamOpacity(segment.power);
        const core = tube(segment, 1, 0, opacity);
        const glow = tube(segment, 2.2, 0.0008, opacity * 0.25);
        if (core) group.add(core);
        if (glow) group.add(glow);
      }
      for (const spot of result.spots) {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(spot.radius, 0.001), 32), glowMaterial(beamOpacity(spot.power)));
        disc.rotation.y = Math.PI / 2;
        disc.position.set(spot.z - 0.0012, spot.y, spot.x);
        group.add(disc);
      }
    },
  };
}
