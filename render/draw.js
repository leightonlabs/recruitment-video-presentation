// 通用绘图工具：颜色、缓动、路径、描线、文字、光标等。所有函数都是时间的纯函数，便于逐帧渲染。
export const C = {
  navy900: '#062045', navy800: '#0F2B46', navy700: '#123E54',
  teal: '#2DD4BF', teal5: '#2DB4AA', amber: '#F59E0B', amber7: '#B45309',
  paper: '#F8FAFC', ink: '#0F2B46', muted: '#7B8B9A', mutedDark: '#ACB6C0', white: '#FFFFFF',
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const easeOut = k => 1 - Math.pow(1 - clamp(k), 4);
export const easeInOut = k => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
export function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function panel(ctx, x, y, w, h, { fill = C.navy800, stroke = null, r = 14, alpha = 1, shadow = false } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; }
  rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  ctx.shadowColor = 'transparent';
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}

export function polyPath(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (close) ctx.closePath();
}
export function polyLength(pts, close = true) {
  let L = 0;
  const n = close ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return L;
}
// 沿折线描出前 k（0–1）部分，带外发光：用于青色连接线
export function drawLine(ctx, pts, k, { color = C.teal, width = 4, glow = 10, close = false, dash = null, alpha = 1 } = {}) {
  if (k <= 0) return;
  const L = polyLength(pts, close);
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
  if (glow) { ctx.shadowColor = rgba(color, 0.8); ctx.shadowBlur = glow; }
  ctx.setLineDash(dash ? dash : [L * clamp(k), L + 10]);
  polyPath(ctx, pts, close); ctx.stroke();
  ctx.restore();
}
export function nodes(ctx, pts, size = 10, color = C.teal, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  pts.forEach(p => ctx.fillRect(p[0] - size / 2, p[1] - size / 2, size, size));
  ctx.restore();
}
export function dashRect(ctx, x, y, w, h, { color = C.amber, width = 3, alpha = 1, dash = [12, 8] } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.strokeRect(x, y, w, h); ctx.restore();
}
export function text(ctx, str, x, y, { font = '400 32px NS', color = C.white, align = 'left', base = 'alphabetic', alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(str, x, y); ctx.restore();
}
// 中文按字换行，返回行数
export function wrap(ctx, str, x, y, maxW, lh, opts = {}) {
  ctx.save(); ctx.font = opts.font || '400 32px NS';
  const lines = []; let cur = '';
  for (const ch of str) {
    if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  lines.slice(0, opts.maxLines || 99).forEach((l, i) => text(ctx, l, x, y + i * lh, opts));
  return lines.length;
}
export function check(ctx, x, y, s, k, color = C.teal) {
  if (k <= 0) return;
  drawLine(ctx, [[x - s * 0.5, y], [x - s * 0.12, y + s * 0.38], [x + s * 0.55, y - s * 0.42]], k, { color, width: s * 0.16, glow: 8 });
}
export function cursor(ctx, x, y, { color = '#fff', alpha = 1, press = 0 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); const s = 1 - press * 0.15; ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.lineTo(14, 36); ctx.lineTo(19, 34); ctx.lineTo(13, 21); ctx.lineTo(23, 21); ctx.closePath();
  ctx.fillStyle = color; ctx.strokeStyle = '#0b1220'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
  if (press > 0) { ctx.beginPath(); ctx.arc(0, 0, 18 + press * 14, 0, 7); ctx.strokeStyle = rgba(C.teal, 0.6 * (1 - press)); ctx.lineWidth = 3; ctx.stroke(); }
  ctx.restore();
}
export function checkbox(ctx, x, y, label, on, { color = C.white } = {}) {
  ctx.save(); ctx.strokeStyle = on ? C.teal : C.mutedDark; ctx.lineWidth = 2; ctx.strokeRect(x, y - 18, 22, 22);
  if (on) { ctx.fillStyle = C.teal; ctx.fillRect(x + 4, y - 14, 14, 14); }
  ctx.restore();
  text(ctx, label, x + 36, y, { font: '400 24px NS', color });
}
// 斜线填充当前裁剪区域
export function hatch(ctx, x, y, w, h, color, gap = 12, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = 2;
  for (let i = -h; i < w; i += gap) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); }
  ctx.restore();
}
export function bgNavy(ctx, { top = C.navy900, bottom = C.navy800, dots = true } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  if (dots) {
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let x = 40; x < 1920; x += 48) for (let y = 40; y < 1080; y += 48) ctx.fillRect(x, y, 2, 2);
  }
}
// 以图像坐标 (cx, cy) 为中心缩放 s 倍、放到屏幕 (sx, sy)，返回图像坐标 → 屏幕坐标的映射
export function placeImage(ctx, img, { s = 1, cx = 960, cy = 540, sx = 960, sy = 540, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(sx, sy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  ctx.drawImage(img, 0, 0, img.width, img.height); ctx.restore();
  return p => [(p[0] - cx) * s + sx, (p[1] - cy) * s + sy];
}
// 把图像放进矩形框（裁剪），zoom 为相对“铺满宽度”的倍数，focus 为图像坐标中心
export function imageInRect(ctx, img, rect, { zoom = 1, focus = [960, 540], alpha = 1, filter = 'none' } = {}) {
  const s = (rect.w / img.width) * zoom;
  ctx.save(); rr(ctx, rect.x, rect.y, rect.w, rect.h, rect.r ?? 10); ctx.clip(); ctx.filter = filter;
  const m = placeImage(ctx, img, { s, cx: focus[0], cy: focus[1], sx: rect.x + rect.w / 2, sy: rect.y + rect.h / 2, alpha });
  ctx.restore();
  return m;
}
export const centroid = pts => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
export const bbox = pts => {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
