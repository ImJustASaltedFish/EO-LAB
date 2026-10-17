// WebGL 2 detection without loading three.js, so the page can fall back to 2D-only.
export function webglAvailable() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}
