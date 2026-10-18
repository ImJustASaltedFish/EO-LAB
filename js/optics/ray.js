// Paraxial ray for the beam centre: positions x, y (m) and slopes tx = dx/dz, ty = dy/dz (rad).
export function propagateRay(ray, distance) {
  return { x: ray.x + ray.tx * distance, y: ray.y + ray.ty * distance, tx: ray.tx, ty: ray.ty };
}

export function thinLensRay(ray, focalLength, axis) {
  return {
    x: ray.x,
    y: ray.y,
    tx: ray.tx - (ray.x - axis.x) / focalLength,
    ty: ray.ty - (ray.y - axis.y) / focalLength,
  };
}

export const offsetFrom = (point, centre) => ({ x: point.x - centre.x, y: point.y - centre.y });

export const radial = (v) => Math.hypot(v.x, v.y);
