// Seeded random numbers (mulberry32) and helpers. Same seed → same run.
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An independent stream per random event, so draws never depend on the order of events.
export function deriveSeed(seed, salt) {
  let h = (seed ^ Math.imul(salt >>> 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export const uniform = (rng, lo, hi) => lo + (hi - lo) * rng();

export const randomSign = (rng) => (rng() < 0.5 ? -1 : 1);

export function randomVector(rng, magnitudeMin, magnitudeMax) {
  const angle = 2 * Math.PI * rng();
  const magnitude = uniform(rng, magnitudeMin, magnitudeMax);
  return { x: magnitude * Math.cos(angle), y: magnitude * Math.sin(angle) };
}

export function randomSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

export const SALT = Object.freeze({ laser: 1, noise: 2, pinhole: 4, lateral: 5, michelson: 6 });
