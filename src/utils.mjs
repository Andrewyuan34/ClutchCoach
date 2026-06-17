export const $ = (id) => document.getElementById(id);
export const rand = (a) => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const fill = (tpl, map) => tpl.replace(/\{(\w)\}/g, (_, k) => map[k] ?? "");
