// Spatial filter (handout Fig. 1-1, 1-2): the field in the pinhole plane → far-field pattern and transmission.
// Spec §4.4. Positions are rail-frame metres; angles are radians.
import { CONFIG } from './config.js';

export function computePinhole(p) {
  const {
    wavelength: lambda,
    focalLength: f0,
    beamRadius: W,
    offset: u,
    angle: alpha,
    defocus: dz,
    objectiveAxis: ro,
    pinholeCentre: rp,
    pinholeRadius: a,
    noise = [],
    samples: G = CONFIG.pinholeGrid.samples,
    farFieldSamples: M = CONFIG.pinholeGrid.farFieldSamples,
    farFieldSpan: spanUnits = CONFIG.pinholeGrid.farFieldSpan,
  } = p;
  const k = (2 * Math.PI) / lambda;
  const w0 = (lambda * f0) / (Math.PI * W);
  const zR = (Math.PI * w0 * w0) / lambda;
  const w = w0 * Math.sqrt(1 + (dz / zR) ** 2);
  const invR = dz / (dz * dz + zR * zR);
  const amp = w0 / w;

  // Main beam: direction β = α − u/f0, waist centre ξc = r_o + f0·α. Noise copies are tilted by λν
  // and focus λν·f0 away from ξc. Every component then travels Δz past its waist.
  const bx = alpha.x - u.x / f0;
  const by = alpha.y - u.y / f0;
  const focusCentre = { x: ro.x + f0 * alpha.x, y: ro.y + f0 * alpha.y };
  const comps = [{ cx: focusCentre.x + bx * dz, cy: focusCentre.y + by * dz, tx: bx, ty: by, re: 1, im: 0 }];
  for (const n of noise) {
    const tx = bx + lambda * n.fx;
    const ty = by + lambda * n.fy;
    comps.push({
      cx: focusCentre.x + lambda * n.fx * f0 + tx * dz,
      cy: focusCentre.y + lambda * n.fy * f0 + ty * dz,
      tx,
      ty,
      re: n.re,
      im: n.im,
    });
  }

  // Sample the field over the pinhole on a G×G grid (local coordinates relative to its centre).
  const h = (2 * a) / G;
  const coords = new Float64Array(G);
  for (let i = 0; i < G; i++) coords[i] = -a + (i + 0.5) * h;
  const fieldRe = new Float64Array(G * G);
  const fieldIm = new Float64Array(G * G);
  let mainPower = 0;
  let noisePower = 0;
  for (let j = 0; j < G; j++) {
    const ey = rp.y + coords[j];
    for (let i = 0; i < G; i++) {
      if (coords[i] * coords[i] + coords[j] * coords[j] > a * a) continue;
      const ex = rp.x + coords[i];
      let mr = 0;
      let mi = 0;
      let nr = 0;
      let ni = 0;
      for (let c = 0; c < comps.length; c++) {
        const comp = comps[c];
        const dx = ex - comp.cx;
        const dy = ey - comp.cy;
        const r2 = dx * dx + dy * dy;
        const env = amp * Math.exp(-r2 / (w * w));
        if (env < 1e-12) continue;
        const phase = 0.5 * k * r2 * invR + k * (comp.tx * ex + comp.ty * ey);
        const cr = env * Math.cos(phase);
        const ci = env * Math.sin(phase);
        const vr = comp.re * cr - comp.im * ci;
        const vi = comp.re * ci + comp.im * cr;
        if (c === 0) {
          mr += vr;
          mi += vi;
        } else {
          nr += vr;
          ni += vi;
        }
      }
      fieldRe[j * G + i] = mr + nr;
      fieldIm[j * G + i] = mi + ni;
      mainPower += mr * mr + mi * mi;
      noisePower += nr * nr + ni * ni;
    }
  }
  const beamPower = (Math.PI * w0 * w0) / 2;
  const noiseTotal = noise.reduce((sum, n) => sum + n.re * n.re + n.im * n.im, 0);
  const transmission = Math.min(1, (mainPower * h * h) / beamPower);
  const noiseTransmission = noiseTotal > 0 ? Math.min(1, (noisePower * h * h) / (noiseTotal * beamPower)) : 0;

  // Far field by separable DFT: F = A·E·Aᵀ with A[m][i] = exp(−ik·θm·ρi).
  const span = (spanUnits * W) / f0;
  const dTheta = (2 * span) / M;
  const Ar = new Float64Array(M * G);
  const Ai = new Float64Array(M * G);
  for (let m = 0; m < M; m++) {
    const theta = -span + (m + 0.5) * dTheta;
    for (let i = 0; i < G; i++) {
      const ph = -k * theta * coords[i];
      Ar[m * G + i] = Math.cos(ph);
      Ai[m * G + i] = Math.sin(ph);
    }
  }
  const Tr = new Float64Array(M * G);
  const Ti = new Float64Array(M * G);
  for (let n = 0; n < M; n++) {
    for (let j = 0; j < G; j++) {
      const ar = Ar[n * G + j];
      const ai = Ai[n * G + j];
      for (let i = 0; i < G; i++) {
        const er = fieldRe[j * G + i];
        const ei = fieldIm[j * G + i];
        if (er === 0 && ei === 0) continue;
        Tr[n * G + i] += ar * er - ai * ei;
        Ti[n * G + i] += ar * ei + ai * er;
      }
    }
  }
  const data = new Float32Array(M * M);
  const norm = (h * h) / (Math.PI * w0 * w0);   // a perfect focused spot has ∫E dA = π·w0² → value 1 on axis
  let sum = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  for (let n = 0; n < M; n++) {
    const thetaY = -span + (n + 0.5) * dTheta;
    for (let m = 0; m < M; m++) {
      let fr = 0;
      let fi = 0;
      for (let i = 0; i < G; i++) {
        const tr = Tr[n * G + i];
        const ti = Ti[n * G + i];
        const ar = Ar[m * G + i];
        const ai = Ai[m * G + i];
        fr += tr * ar - ti * ai;
        fi += tr * ai + ti * ar;
      }
      const value = (fr * fr + fi * fi) * norm * norm;
      data[n * M + m] = value;
      const thetaX = -span + (m + 0.5) * dTheta;
      sum += value;
      sx += value * thetaX;
      sy += value * thetaY;
      sxx += value * thetaX * thetaX;
      syy += value * thetaY * thetaY;
    }
  }
  const centroid = sum > 0 ? { x: sx / sum, y: sy / sum } : { x: bx, y: by };
  const varX = sum > 0 ? Math.max(0, sxx / sum - centroid.x ** 2) : 0;
  const varY = sum > 0 ? Math.max(0, syy / sum - centroid.y ** 2) : 0;
  return {
    transmission,
    noiseTransmission,
    farField: { data, size: M, span },
    thetaE: 2 * Math.sqrt((varX + varY) / 2),
    centroid,
    waistRadius: w0,
    spotRadius: w,
    focusCentre,
    spotCentre: { x: comps[0].cx, y: comps[0].cy },
  };
}

export function sampleFarField(farField, tx, ty) {
  const { data, size, span } = farField;
  const d = (2 * span) / size;
  const fx = (tx + span) / d - 0.5;
  const fy = (ty + span) / d - 0.5;
  if (fx < 0 || fy < 0 || fx > size - 1 || fy > size - 1) return 0;
  const i = Math.min(size - 2, Math.floor(fx));
  const j = Math.min(size - 2, Math.floor(fy));
  const ux = fx - i;
  const uy = fy - j;
  const p00 = data[j * size + i];
  const p10 = data[j * size + i + 1];
  const p01 = data[(j + 1) * size + i];
  const p11 = data[(j + 1) * size + i + 1];
  return (p00 * (1 - ux) + p10 * ux) * (1 - uy) + (p01 * (1 - ux) + p11 * ux) * uy;
}

export function maskedFraction(farField, inside) {
  const { data, size, span } = farField;
  const d = (2 * span) / size;
  let total = 0;
  let kept = 0;
  for (let n = 0; n < size; n++) {
    const ty = -span + (n + 0.5) * d;
    for (let m = 0; m < size; m++) {
      const v = data[n * size + m];
      if (v === 0) continue;
      total += v;
      if (inside(-span + (m + 0.5) * d, ty)) kept += v;
    }
  }
  return total > 0 ? kept / total : 0;
}
