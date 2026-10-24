// Interference of the beams that reach the observation screen (Michelson spec §4.4–4.5). Pure: no DOM.
// A beam on the card: { centre: {u, v}, tilt: {u, v}, opl, A, C, power } — its hit point, its direction along the
// card axes, its optical path length there, its ray matrix (for parallel input rays) and its power. The source
// is { waist, aperture }: the Gaussian radius and the iris radius at the start.

const LN5 = Math.log(5);

export function coherenceContrast(pathDifference, coherenceLength) {
  return Math.exp(-LN5 * ((2 * pathDifference) / coherenceLength) ** 2);
}

// 1/R of the wavefront (0 for a flat one, and at a focus, where the geometric model stops).
export const curvature = (beam) => (Math.abs(beam.A) < 1e-9 ? 0 : beam.C / beam.A);

// Spot on the card: Gaussian radius w, disc radius r and centre intensity (power / area integral).
export function profile(beam, source, minSpot = 50e-6) {
  let w = Math.abs(beam.A) * source.waist;
  let r = Math.abs(beam.A) * source.aperture;
  if (Math.min(w, r) < minSpot) {
    w = minSpot;
    r = 3 * minSpot;
  }
  const area = ((Math.PI * w * w) / 2) * (1 - Math.exp((-2 * r * r) / (w * w)));
  return { w, r, peak: beam.power / area };
}

const sinc = (x) => (Math.abs(x) < 1e-8 ? 1 : Math.sin(x) / x);

// Intensity on the card at (u, v): Σ|Eᵢ|² + Σ 2|Eᵢ||Eⱼ|·V·S·cos(Δφ). `pixel` averages fringes finer than a pixel;
// `extraPhase` (tap the table) is added to the first beam.
export function interferenceSampler(beams, { source, wavelength, coherenceLength, pixel = 0, extraPhase = 0 }) {
  const k = (2 * Math.PI) / wavelength;
  const prepared = beams.map((beam) => ({ ...beam, ...profile(beam, source), q: curvature(beam) }));
  const pairs = [];
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const a = prepared[i];
      const b = prepared[j];
      pairs.push({ i, j, a, b, V: coherenceContrast(a.opl - b.opl, coherenceLength), offset: k * (a.opl - b.opl) + (i === 0 ? extraPhase : 0) });
    }
  }
  const amplitude = (b, du, dv) => {
    const rho2 = du * du + dv * dv;
    return rho2 > b.r * b.r ? 0 : Math.sqrt(b.peak) * Math.exp(-rho2 / (b.w * b.w));
  };
  return (u, v) => {
    const amps = prepared.map((b) => amplitude(b, u - b.centre.u, v - b.centre.v));
    let intensity = 0;
    for (const a of amps) intensity += a * a;
    for (const p of pairs) {
      const ea = amps[p.i];
      const eb = amps[p.j];
      if (ea === 0 || eb === 0) continue;
      const au = u - p.a.centre.u;
      const av = v - p.a.centre.v;
      const bu = u - p.b.centre.u;
      const bv = v - p.b.centre.v;
      const phase = p.offset + k * (p.a.tilt.u * au + p.a.tilt.v * av - p.b.tilt.u * bu - p.b.tilt.v * bv
        + 0.5 * (p.a.q * (au * au + av * av) - p.b.q * (bu * bu + bv * bv)));
      let smear = 1;
      if (pixel > 0) {
        const gu = k * (p.a.tilt.u - p.b.tilt.u + p.a.q * au - p.b.q * bu);
        const gv = k * (p.a.tilt.v - p.b.tilt.v + p.a.q * av - p.b.q * bv);
        smear = sinc((Math.hypot(gu, gv) * pixel) / 2);
      }
      intensity += 2 * ea * eb * p.V * smear * Math.cos(phase);
    }
    return Math.max(0, intensity);
  };
}

// The numbers the checks and readouts use for a pair of beams (spec §4.5).
export function fringeNumbers(a, b, { source, wavelength, coherenceLength }) {
  const pa = profile(a, source);
  const pb = profile(b, source);
  const qa = curvature(a);
  const qb = curvature(b);
  const du = a.tilt.u - b.tilt.u;
  const dv = a.tilt.v - b.tilt.v;
  const alpha = Math.hypot(du, dv);
  const radius = Math.min(pa.r, pb.r);
  const dq = qa - qb;
  // The ring centre is where the phase difference is flat: (tₐ − t_b) + qₐ(s − cₐ) − q_b(s − c_b) = 0.
  const centre = Math.abs(dq) > 1e-9
    ? { u: (qa * a.centre.u - qb * b.centre.u - du) / dq, v: (qa * a.centre.v - qb * b.centre.v - dv) / dq }
    : null;
  const mid = { u: (a.centre.u + b.centre.u) / 2, v: (a.centre.v + b.centre.v) / 2 };
  return {
    contrast: coherenceContrast(a.opl - b.opl, coherenceLength),
    pathDifference: a.opl - b.opl,
    alpha,
    spacing: alpha > 1e-12 ? wavelength / alpha : Infinity,   // below 1e-12 rad the beams are parallel
    rings: (radius * radius * Math.abs(dq)) / (2 * wavelength),
    centre,
    centred: centre !== null && Math.hypot(centre.u - mid.u, centre.v - mid.v) < radius,
    overlap: Math.hypot(a.centre.u - b.centre.u, a.centre.v - b.centre.v),
    radius,
  };
}
