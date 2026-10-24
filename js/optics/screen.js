// What the observation screen shows (spec §4.5): samplers for each beam state, rendering, D4σ, tone map, colours.
// Samplers return intensity relative to the ideal aligned peak at the same screen position.
import { CONFIG } from './config.js';
import { noiseMultiplier } from './noise.js';

export function toneMap(relative) {
  if (!(relative > 0)) return 0;
  const { k } = CONFIG.tone;
  return Math.min(1, Math.log10(1 + k * relative) / Math.log10(1 + k));
}

// Green that rolls off toward white near saturation.
export function beamColour(v) {
  const x = Math.min(1, Math.max(0, v));
  const g = Math.min(1, x / 0.8);
  const w = Math.max(0, (x - 0.8) / 0.2);
  return [Math.round(30 * g + 200 * w), Math.round(255 * g), Math.round(60 * g + 170 * w)];
}

const CARD_BASE = [68, 70, 72];

// A white card in a dim lab, lit to brightness v (0–1) with no tone curve (the Michelson fringes).
export function brightPixel(v) {
  const [r, g, b] = beamColour(v);
  return [Math.min(255, CARD_BASE[0] + r), Math.min(255, CARD_BASE[1] + g), Math.min(255, CARD_BASE[2] + b)];
}

// A white card in a dim lab, lit by the green beam (relative intensity through the log tone curve).
export function cardPixel(relative) {
  return brightPixel(toneMap(relative));
}

export function screenWindow(expectedDiameter) {
  const { windowFactor, windowMin, windowMax } = CONFIG.screen;
  return Math.min(windowMax, Math.max(windowMin, windowFactor * expectedDiameter));
}

// Laser beam before the objective: Gaussian with dust noise, clipped by earlier holes.
export function rawBeamSampler({ centre, radius, noise, clips = [] }) {
  const noiseScale = CONFIG.laser.waistRadius / radius;
  return (x, y) => {
    const dx = x - centre.x;
    const dy = y - centre.y;
    for (const c of clips) {
      const s = c.radius / radius;
      const px = c.centre.x + dx * s - c.hole.x;
      const py = c.centre.y + dy * s - c.hole.y;
      if (px * px + py * py > c.r * c.r) return 0;
    }
    const env = Math.exp((-2 * (dx * dx + dy * dy)) / (radius * radius));
    if (env < 1e-9) return 0;
    return noise ? env * noiseMultiplier(noise, dx * noiseScale, dy * noiseScale) : env;
  };
}

// A beam that spreads from a point source with an angular pattern: x = A·θ + B at the screen.
export function angularSampler({ pattern, A, B, masks = [] }) {
  return (x, y) => {
    const tx = (x - B.x) / A;
    const ty = (y - B.y) / A;
    for (const inside of masks) if (!inside(tx, ty)) return 0;
    return pattern(tx, ty);
  };
}

// After the objective without a pinhole: the magnified, inverted raw beam (spec §4.4 item 6).
export function expandedPattern({ direction, angularRadius, focalLength, noise }) {
  return (tx, ty) => {
    const rx = tx - direction.x;
    const ry = ty - direction.y;
    const env = Math.exp((-2 * (rx * rx + ry * ry)) / (angularRadius * angularRadius));
    if (env < 1e-9) return 0;
    return noise ? env * noiseMultiplier(noise, -rx * focalLength, -ry * focalLength) : env;
  };
}

export function gaussianSpotSampler({ centre, radius }) {
  return (x, y) => {
    const dx = x - centre.x;
    const dy = y - centre.y;
    return Math.exp((-2 * (dx * dx + dy * dy)) / (radius * radius));
  };
}

// Render a square window centred on `centre`; row 0 is the top. D4σ = mean of 4σx and 4σy.
export function renderScreen({ sample, centre, size, pixels = CONFIG.screen.imageSize }) {
  const image = new Float32Array(pixels * pixels);
  const step = size / pixels;
  let sum = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let peak = 0;
  for (let j = 0; j < pixels; j++) {
    const y = centre.y + size / 2 - (j + 0.5) * step;
    for (let i = 0; i < pixels; i++) {
      const x = centre.x - size / 2 + (i + 0.5) * step;
      const v = sample(x, y);
      image[j * pixels + i] = v;
      if (v > 0) {
        sum += v;
        sx += v * x;
        sy += v * y;
        sxx += v * x * x;
        syy += v * y * y;
        if (v > peak) peak = v;
      }
    }
  }
  let d4sigma = 0;
  let centroid = { x: centre.x, y: centre.y };
  if (sum > 0) {
    centroid = { x: sx / sum, y: sy / sum };
    const varX = Math.max(0, sxx / sum - centroid.x ** 2);
    const varY = Math.max(0, syy / sum - centroid.y ** 2);
    d4sigma = 2 * (Math.sqrt(varX) + Math.sqrt(varY));
  }
  return { image, pixels, size, centre, d4sigma, centroid, peak };
}
