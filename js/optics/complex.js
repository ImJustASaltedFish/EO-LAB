// Minimal complex arithmetic on { re, im } objects.
export const complex = (re, im = 0) => ({ re, im });
export const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });

export function cinv(a) {
  const d = a.re * a.re + a.im * a.im;
  return { re: a.re / d, im: -a.im / d };
}

export const cdiv = (a, b) => cmul(a, cinv(b));
export const cabs = (a) => Math.hypot(a.re, a.im);
