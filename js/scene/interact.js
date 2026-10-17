// Pointer interaction with parts: drag from the rack to the rail, along the rail, back to the rack; tap-to-place.
import * as THREE from 'three';

export function groundPoint(origin, direction, height = 0) {
  if (Math.abs(direction.y) < 1e-6) return null;
  const t = (height - origin.y) / direction.y;
  if (t <= 0) return null;
  return { x: origin.x + t * direction.x, z: origin.z + t * direction.z };
}

export function dropTarget(point) {
  if (!point) return { kind: 'cancel' };
  if (Math.abs(point.z) <= 0.12) return { kind: 'rail', z: point.x };
  if (point.z <= -0.15) return { kind: 'rack' };
  return { kind: 'cancel' };
}

const TAP_PIXELS = 5;

export function createInteraction({ view, parts, canPick, onLocked, onDrop, onRemove, onSelect }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const canvas = view.renderer.domElement;
  let drag = null;       // { id, x, y, moved }
  let press = null;      // pointer-down on empty space: { x, y }
  let selected = null;

  function rayFrom(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, view.camera);
    return raycaster.ray;
  }

  function pick(event) {
    rayFrom(event);
    const meshes = [];
    parts.forEach((part) => part.group.traverse((object) => {
      if (object.isMesh) meshes.push(object);
    }));
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.object.userData.partId : null;
  }

  function targetOf(event) {
    const ray = rayFrom(event);
    return dropTarget(groundPoint(ray.origin, ray.direction));
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    const id = pick(event);
    if (!id) {
      press = { x: event.clientX, y: event.clientY };
      return;
    }
    if (!canPick(id)) {
      onLocked(id);
      return;
    }
    drag = { id, x: event.clientX, y: event.clientY, moved: false };
    view.controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > TAP_PIXELS) drag.moved = true;
    if (!drag.moved) return;
    const ray = rayFrom(event);
    const p = groundPoint(ray.origin, ray.direction);
    if (p) parts.get(drag.id).group.position.set(p.x, 0, Math.abs(p.z) <= 0.12 ? 0 : p.z);
  }

  function onPointerUp(event) {
    view.controls.enabled = true;
    if (drag) {
      const { id, moved } = drag;
      drag = null;
      if (!moved) {
        selected = selected === id ? null : id;
        onSelect(selected);
        return;
      }
      const target = targetOf(event);
      if (target.kind === 'rail') onDrop(id, target.z);
      else if (target.kind === 'rack') onRemove(id);
      else onDrop(id, null);
      return;
    }
    const wasTap = press && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= TAP_PIXELS;
    press = null;
    if (wasTap && selected) {
      const target = targetOf(event);
      if (target.kind === 'rail') onDrop(selected, target.z);
      selected = null;
      onSelect(null);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  return {
    get selected() {
      return selected;
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
    },
  };
}
