// Fixed "dust noise" on the laser beam (handout Fig. 1-1a): K tilted copies of the beam, spec §4.1 and §4.4.
import { CONFIG } from './config.js';
import { createRng, deriveSeed, uniform, SALT } from './rng.js';

export function createNoise(seed) {
  const { count, freqMin, freqMax, power, gridSize, gridSpan } = CONFIG.noise;
  const rng = createRng(deriveSeed(seed, SALT.noise));
  const amplitude = Math.sqrt(power / count);
  const components = [];
  for (let k = 0; k < count; k++) {
    const direction = 2 * Math.PI * rng();
    const frequency = uniform(rng, freqMin, freqMax);
    const phase = 2 * Math.PI * rng();
    components.push({
      fx: frequency * Math.cos(direction),
      fy: frequency * Math.sin(direction),
      re: amplitude * Math.cos(phase),
      im: amplitude * Math.sin(phase),
    });
  }
  // Intensity multiplier |1 + Σ c·e^{i2πν·ρ}|² over ±gridSpan·W0 in input-plane metres.
  const half = gridSpan * CONFIG.laser.waistRadius;
  const step = (2 * half) / gridSize;
  const field = new Float32Array(gridSize * gridSize);
  for (let j = 0; j < gridSize; j++) {
    const y = -half + (j + 0.5) * step;
    for (let i = 0; i < gridSize; i++) {
      const x = -half + (i + 0.5) * step;
      let re = 1;
      let im = 0;
      for (const c of components) {
        const phi = 2 * Math.PI * (c.fx * x + c.fy * y);
        const cos = Math.cos(phi);
        const sin = Math.sin(phi);
        re += c.re * cos - c.im * sin;
        im += c.re * sin + c.im * cos;
      }
      field[j * gridSize + i] = re * re + im * im;
    }
  }
  return { components, field, gridSize, half, step };
}

// Intensity multiplier at input-plane position (x, y) relative to the beam centre (bilinear; 1 outside the grid).
export function noiseMultiplier(noise, x, y) {
  const { field, gridSize, half, step } = noise;
  const fx = (x + half) / step - 0.5;
  const fy = (y + half) / step - 0.5;
  if (fx < 0 || fy < 0 || fx >= gridSize - 1 || fy >= gridSize - 1) return 1;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const a = field[j * gridSize + i];
  const b = field[j * gridSize + i + 1];
  const c = field[(j + 1) * gridSize + i];
  const d = field[(j + 1) * gridSize + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}
