// three.js renderer, camera, orbit controls and camera presets. World axes: X = rail z, Y = height, Z = rail x.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// halfWidth: how much of the bench (m, across the view) a preset must show; a narrow view backs the camera off.
// A tall view (aspect < 1) uses the portrait overview, looking down the rail from behind the laser.
const PRESETS = {
  overview: {
    position: [0.55, 0.75, 1.05], target: [0.55, 0.08, 0], halfWidth: 0.72,
    portrait: { position: [-0.62, 0.55, 0.5], target: [0.4, 0.04, 0], halfWidth: 0 },
  },
  laser: { position: [-0.15, 0.32, 0.45], target: [0.15, 0.1, 0], halfWidth: 0.22 },
  filter: { position: [0.12, 0.22, 0.3], target: [0.25, 0.1, 0], halfWidth: 0.1 },
  screen: { position: [0.2, 0.25, 0.35], target: [0.6, 0.1, 0], halfWidth: 0.3 },
};
const MAX_DISTANCE = 5;

export function createView(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2f38);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 20);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;   // stay above the table
  controls.minDistance = 0.05;
  controls.maxDistance = MAX_DISTANCE;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x303030, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(0.5, 1.5, 1.0);
  scene.add(sun);

  function resize() {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function setPreset(name, focusX) {
    const base = PRESETS[name] ?? PRESETS.overview;
    const preset = camera.aspect < 1 && base.portrait ? base.portrait : base;
    const shift = focusX !== undefined && (name === 'filter' || name === 'screen') ? focusX - preset.target[0] : 0;
    const target = new THREE.Vector3(preset.target[0] + shift, preset.target[1], preset.target[2]);
    const offset = new THREE.Vector3(...preset.position).sub(new THREE.Vector3(...preset.target));
    const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const needed = preset.halfWidth / Math.tan(halfFov);
    if (needed > offset.length()) offset.setLength(Math.min(needed, MAX_DISTANCE));
    camera.position.copy(target).add(offset);
    controls.target.copy(target);
    controls.update();
  }
  setPreset('overview');

  const callbacks = new Set();
  let frame = null;
  function loop() {
    frame = requestAnimationFrame(loop);
    controls.update();
    callbacks.forEach((fn) => fn());
    renderer.render(scene, camera);
  }

  return {
    THREE,
    renderer,
    scene,
    camera,
    controls,
    setPreset,
    start() {
      if (frame === null) loop();
    },
    stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
    renderOnce() {
      renderer.render(scene, camera);
    },
    onFrame(fn) {
      callbacks.add(fn);
      return () => callbacks.delete(fn);
    },
    dispose() {
      this.stop();
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
