// Pointer interaction on the Michelson breadboard (spec §3.4): drag parts from the rack or the table and see them
// snap where they can stand, drop them on the rack to remove them, tap-to-place, and R / Shift+R to turn the selected
// part. World axes: X = table z, Y = height, Z = table x.
import * as THREE from 'three';
import { groundPoint } from './interact.js';
import { MI } from '../michelson/config.js';

const TAP_PIXELS = 5;

// Where a pointer on the table plane (world X, Z) drops a part: on the table (table position), on the rack, or nowhere.
export function tableDrop(point) {
  if (!point) return { kind: 'cancel' };
  const pos = { x: point.z, z: point.x };
  const T = MI.table;
  if (pos.x < T.xMin && pos.x > T.xMin - 0.2) return { kind: 'rack' };
  if (pos.x >= T.xMin && pos.x <= T.xMax && pos.z >= T.zMin && pos.z <= T.zMax) return { kind: 'table', pos };
  return { kind: 'cancel' };
}

// preview(id, pos) → the snapped table position the part would take, or null if it cannot stand there.
export function createTableInteraction({ view, parts, canPick, onLocked, preview, onDrop, onRemove, onSelect, onTurn }) {
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

  function dropOf(event) {
    const ray = rayFrom(event);
    return tableDrop(groundPoint(ray.origin, ray.direction));
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
    const group = parts.get(drag.id).group;
    const drop = dropOf(event);
    if (drop.kind === 'table') {
      const at = preview(drag.id, drop.pos) ?? drop.pos;
      group.position.set(at.z, 0, at.x);
      return;
    }
    const ray = rayFrom(event);
    const p = groundPoint(ray.origin, ray.direction);
    if (p) group.position.set(p.x, 0, p.z);
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
      const drop = dropOf(event);
      if (drop.kind === 'table') onDrop(id, drop.pos);
      else if (drop.kind === 'rack') onRemove(id);
      else onDrop(id, null);
      return;
    }
    const wasTap = press && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= TAP_PIXELS;
    press = null;
    if (wasTap && selected) {
      const drop = dropOf(event);
      if (drop.kind === 'table') onDrop(selected, drop.pos);
      selected = null;
      onSelect(null);
    }
  }

  function onKeyDown(event) {
    if (!selected || (event.key !== 'r' && event.key !== 'R')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) return;
    onTurn(selected, event.shiftKey ? -1 : 1);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  return {
    get selected() {
      return selected;
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
