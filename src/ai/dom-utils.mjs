export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function isVisible(el) {
  if (!el) return false;
  let cur = el;
  while (cur && cur.nodeType === 1) {
    const style = getComputedStyle(cur);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    cur = cur.parentElement;
  }
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

export function parsePercent(value) {
  return Number(String(value || "").replace("%", "")) || 0;
}
