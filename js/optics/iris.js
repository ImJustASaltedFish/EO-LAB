// Power fraction of a Gaussian beam (1/e² radius w, centre offset s) passing a circular hole of radius r (spec §4.7):
// T = ∫0^r (4ρ/w²)·exp(−2(ρ² + s²)/w²)·I0(4ρs/w²) dρ, by 64-point Gauss–Legendre quadrature.

export function gaussLegendre(n) {
  const x = new Float64Array(n);
  const w = new Float64Array(n);
  const m = Math.ceil(n / 2);
  for (let i = 0; i < m; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let pp = 0;
    for (let iter = 0; iter < 100; iter++) {
      let p1 = 1;
      let p2 = 0;
      for (let j = 1; j <= n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j;
      }
      pp = (n * (z * p1 - p2)) / (z * z - 1);
      const previous = z;
      z = previous - p1 / pp;
      if (Math.abs(z - previous) < 1e-15) break;
    }
    x[i] = -z;
    x[n - 1 - i] = z;
    w[i] = 2 / ((1 - z * z) * pp * pp);
    w[n - 1 - i] = w[i];
  }
  return { x, w };
}

const RULE = gaussLegendre(64);

// e^{−|x|}·I0(x), Abramowitz & Stegun 9.8.1–9.8.2.
export function besselI0e(x) {
  const ax = Math.abs(x);
  if (ax < 3.75) {
    const t = (ax / 3.75) ** 2;
    const i0 = 1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813)))));
    return i0 * Math.exp(-ax);
  }
  const t = 3.75 / ax;
  const poly = 0.39894228 + t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281
    + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377)))))));
  return poly / Math.sqrt(ax);
}

export function gaussianThroughHole(w, s, r) {
  if (r <= 0) return 0;
  if (w <= 0) return s < r ? 1 : 0;
  // Outside [s − 6w, s + 6w] the integrand is below e^−72.
  const lo = Math.max(0, s - 6 * w);
  const hi = Math.min(r, s + 6 * w);
  if (hi <= lo) return 0;
  const half = (hi - lo) / 2;
  const mid = (hi + lo) / 2;
  let sum = 0;
  for (let i = 0; i < RULE.x.length; i++) {
    const rho = mid + half * RULE.x[i];
    const d = rho - s;
    sum += RULE.w[i] * ((4 * rho) / (w * w)) * Math.exp((-2 * d * d) / (w * w)) * besselI0e((4 * rho * s) / (w * w));
  }
  return Math.min(1, Math.max(0, sum * half));
}
