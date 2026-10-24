// 2D close-ups drawn on <canvas>: iris faces, the spatial-filter ring, plane A and the screen (spec §3.8).
import { beamColour, cardPixel } from '../optics/screen.js';
import { drawTarget } from './target.js';

export function niceStep(spanMm) {
  const raw = spanMm / 6;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const m = raw / pow;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
}

const viewHalf = (...sizes) => Math.min(0.025, Math.max(0.003, ...sizes));
const mmLabel = (value) => `${Number(value.toPrecision(3))} mm`;

function drawScaleBar(ctx, width, height, half) {
  const spanMm = half * 2e3;
  const step = niceStep(spanMm);
  ctx.fillStyle = 'rgba(225,230,238,0.9)';
  ctx.fillRect(8, height - 9, (step / spanMm) * width, 2);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(mmLabel(step), 8, height - 13);
}

function drawMessage(ctx, width, height, message) {
  ctx.fillStyle = 'rgba(162,169,182,0.9)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(message, width / 2, height / 2);
  ctx.textAlign = 'start';
}

// An iris or ring face: plate, hole and the light of one `beam` or several labelled `beams` where they land
// (metres, relative to the hole centre). Brightness uses a square-root curve rather than the screen's log curve, so
// the brightest part of a beam that overfills the plate (the expanded beam in step 2b) still shows where its centre is.
export function drawApertureInset(canvas, { r, outer, beam = null, beams = beam ? [beam] : [] }) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const reach = Math.max(0, ...beams.map((b) => 1.6 * (Math.hypot(b.dx, b.dy) + b.radius)));
  const half = Math.min(0.04, Math.max(0.003, 2.5 * r, reach));
  const scale = width / (2 * half);
  const image = ctx.createImageData(width, height);
  for (let j = 0; j < height; j++) {
    const y = half - (j + 0.5) / scale;
    for (let i = 0; i < width; i++) {
      const x = -half + (i + 0.5) / scale;
      const rho = Math.hypot(x, y);
      const base = rho <= r ? [8, 8, 10] : rho <= outer ? [52, 55, 61] : [18, 20, 24];
      let light = 0;
      for (const b of beams) {
        const dx = x - b.dx;
        const dy = y - b.dy;
        light += Math.exp((-2 * (dx * dx + dy * dy)) / (b.radius * b.radius));
      }
      if (rho <= r) light *= 0.25;            // light going through the hole barely shows on this face
      else if (rho > outer) light *= 0.1;
      const [lr, lg, lb] = beamColour(Math.sqrt(Math.min(1, light)));
      const k = 4 * (j * width + i);
      image.data[k] = Math.min(255, base[0] + lr);
      image.data[k + 1] = Math.min(255, base[1] + lg);
      image.data[k + 2] = Math.min(255, base[2] + lb);
      image.data[k + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  ctx.strokeStyle = 'rgba(0,191,255,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.max(1, r * scale), 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  for (const b of beams) {
    if (b.label) ctx.fillText(b.label, width / 2 + b.dx * scale + 5, height / 2 - b.dy * scale - 5);
  }
  drawScaleBar(ctx, width, height, half);
}

export function drawPlaneAInset(canvas, planeA, noLightText = '—') {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.fillStyle = '#34373d';
  ctx.fillRect(0, 0, width, height);
  if (!planeA) {
    drawMessage(ctx, width, height, noLightText);
    return;
  }
  const reach = Math.max(...planeA.rings.map((g) => Math.hypot(g.x, g.y) + g.radius));
  const half = viewHalf(1.1 * reach, 2.5 * planeA.holeRadius);
  const scale = width / (2 * half);
  const cx = width / 2;
  const cy = height / 2;
  ctx.fillStyle = '#08080a';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1, planeA.holeRadius * scale), 0, 2 * Math.PI);
  ctx.fill();
  planeA.rings.forEach((g, n) => {
    ctx.beginPath();
    ctx.arc(cx + g.x * scale, cy - g.y * scale, g.radius * scale, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(80,255,110,0.06)';
    ctx.fill();
    ctx.strokeStyle = `rgba(80,255,110,${0.8 - n * 0.2})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  drawScaleBar(ctx, width, height, half);
}

let scratch = null;
function scratchCanvas(pixels) {
  if (!scratch || scratch.width !== pixels) {
    scratch = document.createElement('canvas');
    scratch.width = pixels;
    scratch.height = pixels;
  }
  return scratch;
}

// The computed screen image with a mm ruler and the target paper. `target` (the target centre) and `mark` (the
// step-2a mark) are in rail coordinates, or null.
export function drawScreenInset(canvas, screen, { mark = null, target = null, noLightText = '—', pixel = cardPixel } = {}) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.fillStyle = '#0e1013';
  ctx.fillRect(0, 0, width, height);
  if (!screen) {
    drawMessage(ctx, width, height, noLightText);
    return;
  }
  const { image, pixels, size, centre } = screen.window;
  const off = scratchCanvas(pixels);
  const offCtx = off.getContext('2d');
  const data = offCtx.createImageData(pixels, pixels);
  for (let i = 0; i < pixels * pixels; i++) {
    const [r, g, b] = pixel(image[i]);
    data.data[4 * i] = r;
    data.data[4 * i + 1] = g;
    data.data[4 * i + 2] = b;
    data.data[4 * i + 3] = 255;
  }
  offCtx.putImageData(data, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, width, height);
  if (target) drawTarget(ctx, { centre: target, left: centre.x - size / 2, top: centre.y + size / 2, scale: width / size });

  const spanMm = size * 1e3;
  const step = niceStep(spanMm);
  ctx.strokeStyle = 'rgba(14,16,19,0.8)';
  ctx.lineWidth = 1;
  for (let mm = 0; mm <= spanMm + 1e-9; mm += step) {
    const p = (mm / spanMm) * width;
    ctx.beginPath();
    ctx.moveTo(p, height);
    ctx.lineTo(p, height - 6);
    ctx.moveTo(0, height - p);
    ctx.lineTo(6, height - p);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(14,16,19,0.9)';
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText(mmLabel(step), 8, 12);

  if (mark) {
    const px = ((mark.x - (centre.x - size / 2)) / size) * width;
    const py = ((centre.y + size / 2 - mark.y) / size) * height;
    if (px >= 0 && px <= width && py >= 0 && py <= height) {
      ctx.strokeStyle = 'rgba(255,179,71,0.95)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - 6, py);
      ctx.lineTo(px + 6, py);
      ctx.moveTo(px, py - 6);
      ctx.lineTo(px, py + 6);
      ctx.stroke();
    }
  }
}
