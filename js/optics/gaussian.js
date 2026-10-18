// Gaussian beam optics with the complex beam parameter q (1/q = 1/R − iλ/(πw²)).
// q = z + i·zR, where z is the distance past the waist and zR the Rayleigh range.
import { complex, cinv, csub } from './complex.js';

export function qAtWaist(waistRadius, wavelength) {
  return complex(0, (Math.PI * waistRadius * waistRadius) / wavelength);
}

export function propagateQ(q, distance) {
  return complex(q.re + distance, q.im);
}

export function thinLensQ(q, focalLength) {
  return cinv(csub(cinv(q), complex(1 / focalLength, 0)));
}

export function beamRadius(q, wavelength) {
  return Math.sqrt((wavelength * (q.re * q.re + q.im * q.im)) / (Math.PI * q.im));
}

export function waistRadiusOf(q, wavelength) {
  return Math.sqrt((wavelength * q.im) / Math.PI);
}

// Distance from this plane to the waist; positive when the waist is still ahead.
export function distanceToWaist(q) {
  return -q.re;
}

export function curvatureRadius(q) {
  return q.re === 0 ? Infinity : q.re + (q.im * q.im) / q.re;
}
