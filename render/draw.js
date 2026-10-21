// 通用绘图工具：主题色、缓动、路径、描线、文字、光标、动态背景等。所有函数都是时间的纯函数，便于逐帧渲染。
//
// 两套主题：
//   classic  —— 原粗剪的深蓝纯色风格；
//   vibrant  —— 动感科技蓝：深蓝底上的极光光团、斜向扫光、流动透视网格、上下边带流光与景深粒子；
//               前景用不透明的深宝蓝卡片、白色与蓝灰文字、香槟金点睛、实心蓝色标签，不用荧光色与线框。
const THEMES = {
  classic: {
    navy900: '#062045', navy800: '#0F2B46', navy700: '#123E54',
    teal: '#2DD4BF', teal5: '#2DB4AA', amber: '#F59E0B', amber7: '#B45309',
    paper: '#F8FAFC', ink: '#0F2B46', muted: '#7B8B9A', mutedDark: '#ACB6C0', white: '#FFFFFF',
    hi: '#2DD4BF', hiFill: '#2DB4AA', onLight: '#2DB4AA',
    ui0: '#081423', ui1: '#0c1c30', tile: 'rgba(15,43,70,.86)', slotOff: 'rgba(15,43,70,.45)', dot: '#5d7f99',
    column: 'rgba(255,255,255,.035)', card2: '#163a59', term: '#0b1220', side: '#0F2B46', cloud: '#3b82a0', cloudFar: '#2a6f8f',
  },
  vibrant: {
    // teal 在本主题中即“主线条色”（柔白）；hi 为点睛色（香槟金）；onLight 为纸面上的强调色；amber 仍用于画面中的目标高亮
    navy900: '#020A2A', navy800: '#0E2163', navy700: '#0E3A9E',
    teal: '#E6ECFF', teal5: '#E6ECFF', amber: '#FFB020', amber7: '#D98E04',
    paper: '#F8FAFC', ink: '#0B1B4D', muted: '#6B7FA8', mutedDark: '#9FB0D6', white: '#FFFFFF',
    hi: '#E6C27A', hiFill: '#E6C27A', onLight: '#1E4FD8',
    sky: '#4CC3FF', electric: '#1E6BFF', violet: '#6A5CFF', streak: '#35E6E0',
    bgTop: '#03104A', bgMid: '#062585', bgBottom: '#020B33',
    ui0: '#061545', ui1: '#0C1D58', tile: '#0E2163', slotOff: '#0A1A52', dot: '#8EA6E0', column: '#0E2163',
    card2: '#16307E', term: '#050E33', side: '#0A1A52', cloud: '#C8D6FF', cloudFar: '#5B7FE0',
  },
};
export const C = { ...THEMES.classic };
export const THEME = { name: 'classic', vibrant: false };
export function applyTheme(name) {
  const t = THEMES[name] ? name : 'classic';
  Object.assign(C, THEMES[t]);
  THEME.name = t; THEME.vibrant = t === 'vibrant';
}
// 全片时间：动态背景与连接线光脉冲随全片时间连续运动，跨镜头不跳变
let NOW = 0;
export const setNow = t => { NOW = t; };

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
// 面板：动感主题下，默认深色面板（fill 为 navy800）为不透明深宝蓝卡片：上浅下深的微渐变、上亮下暗的细边、顶部高光线与柔和投影
export function panel(ctx, x, y, w, h, { fill = C.navy800, stroke = null, r = 14, alpha = 1, shadow = false } = {}) {
  const isCard = THEME.vibrant && fill === C.navy800;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (shadow || isCard) { ctx.shadowColor = isCard ? 'rgba(0,4,30,.55)' : 'rgba(0,0,0,.35)'; ctx.shadowBlur = isCard ? 40 : 30; ctx.shadowOffsetY = isCard ? 16 : 10; }
  rr(ctx, x, y, w, h, r);
  if (isCard) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#152B78'); g.addColorStop(1, '#0B1A4F'); ctx.fillStyle = g; }
  else ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  if (isCard) {
    const edge = ctx.createLinearGradient(0, y, 0, y + h);
    edge.addColorStop(0, 'rgba(170,195,255,.38)'); edge.addColorStop(1, 'rgba(170,195,255,.06)');
    ctx.strokeStyle = edge; ctx.lineWidth = 1.25; ctx.stroke();
    ctx.save(); ctx.clip();
    const hl = ctx.createLinearGradient(x, 0, x + w, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.5, 'rgba(255,255,255,.24)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(x, y, w, 1.5);
    ctx.restore();
  }
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
// 沿折线描出前 k（0–1）部分，带外发光：用于青色连接线。
// 动感主题下不用彩色光晕：主线条为半透明柔白，描线时线头更亮，描完后有一段白色光点沿线流动
export function drawLine(ctx, pts, k, { color = C.teal, width = 4, glow = 10, close = false, dash = null, alpha = 1, flow = true } = {}) {
  if (k <= 0) return;
  const L = polyLength(pts, close), V = THEME.vibrant, lit = V && flow && !dash && glow && L > 60;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
  if (glow && !V) { ctx.shadowColor = rgba(color, 0.8); ctx.shadowBlur = glow; }
  ctx.setLineDash(dash ? dash : [L * clamp(k), L + 10]);
  if (lit) { ctx.save(); ctx.globalAlpha *= 0.6; polyPath(ctx, pts, close); ctx.stroke(); ctx.restore(); }
  else { polyPath(ctx, pts, close); ctx.stroke(); }
  if (lit) {
    const len = Math.min(160, L * 0.35);
    let pos;
    if (k < 1) pos = L * k;
    else { const off = (pts[0][0] * 7 + pts[0][1] * 13) % 997; pos = (NOW * 520 + off) % (L + len); }
    ctx.setLineDash([len, L + len]); ctx.lineDashOffset = -(pos - len);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = width + 1; ctx.shadowColor = 'rgba(255,255,255,.7)'; ctx.shadowBlur = 8;
    polyPath(ctx, pts, close); ctx.stroke();
  }
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
  drawLine(ctx, [[x - s * 0.5, y], [x - s * 0.12, y + s * 0.38], [x + s * 0.55, y - s * 0.42]], k, { color, width: s * 0.16, glow: 8, flow: false });
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

// ---------- 背景 ----------
// classic：深蓝渐变 + 静态点阵。vibrant：动态背景（dots:false 时为“安静版”，用于点云等主体复杂的画面）
export function bgNavy(ctx, { top = C.navy900, bottom = C.navy800, dots = true } = {}) {
  if (THEME.vibrant) return vibrantBg(ctx, { calm: dots === false });
  const g = ctx.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  if (dots) {
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let x = 40; x < 1920; x += 48) for (let y = 40; y < 1080; y += 48) ctx.fillRect(x, y, 2, 2);
  }
}

const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')); return c; };
const GLOW = mk(64, 64, g => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.22, 'rgba(190,235,255,.65)'); r.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
const GRAIN = mk(256, 256, g => {
  const d = g.createImageData(256, 256), R = rng(9);
  for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
});
const BLOBS = [ // 极光光团：颜色、基准位置、半径、漂移幅度与速度
  { c: 'electric', x: 380, y: 260, r: 820, ax: 260, ay: 140, sx: 0.07, sy: 0.05, p: 0.0, a: 0.55 },
  { c: 'sky', x: 1560, y: 220, r: 700, ax: 220, ay: 160, sx: 0.05, sy: 0.08, p: 1.7, a: 0.28 },
  { c: 'violet', x: 1400, y: 900, r: 760, ax: 300, ay: 120, sx: 0.06, sy: 0.04, p: 3.1, a: 0.32 },
  { c: 'electric', x: 600, y: 980, r: 620, ax: 240, ay: 100, sx: 0.08, sy: 0.06, p: 4.4, a: 0.35 },
];
const PARTS = (() => { const R = rng(41); return Array.from({ length: 150 }, () => ({ x: R() * 1920, y: R() * 1080, z: 0.25 + R() * 0.75, vx: 10 + R() * 25, vy: 6 + R() * 18, f: 0.8 + R() * 2.4, p: R() * 6.28 })); })();
// 光流只走画面上下两条带，避开中部内容区
const STREAMS = (() => { const R = rng(53); return Array.from({ length: 8 }, (_, i) => ({ y: (i % 2 ? 820 : 70) + Math.floor(i / 2) * 60 + (R() - 0.5) * 30, a: 40 + R() * 70, f: 0.002 + R() * 0.003, p: R() * 6.28, w: 0.15 + R() * 0.25, v: 380 + R() * 380, o: R() * 3000 })); })();

function vibrantBg(ctx, { calm = false } = {}) {
  const T = NOW, W = 1920, H = 1080;
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, C.bgTop); base.addColorStop(0.55, C.bgMid); base.addColorStop(1, C.bgBottom);
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of BLOBS) {
    const x = b.x + Math.sin(T * b.sx * 6.28 + b.p) * b.ax, y = b.y + Math.cos(T * b.sy * 6.28 + b.p) * b.ay;
    const r = b.r * (1 + 0.08 * Math.sin(T * 0.4 + b.p)), a = b.a * (calm ? 0.5 : 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(C[b.c], a)); g.addColorStop(0.6, rgba(C[b.c], a * 0.3)); g.addColorStop(1, rgba(C[b.c], 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 斜向光带，每 7 秒扫过一次
  const ph = (T % 7) / 7, bx = lerp(-900, 2700, ph);
  ctx.save(); ctx.transform(1, 0, -0.5, 1, 0, 0);
  const sw = ctx.createLinearGradient(bx - 260, 0, bx + 260, 0);
  sw.addColorStop(0, 'rgba(120,200,255,0)'); sw.addColorStop(0.5, `rgba(120,200,255,${calm ? 0.035 : 0.06})`); sw.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = sw; ctx.fillRect(bx - 260, 0, 520 + H, H); ctx.restore();
  ctx.restore();
  // 透视数据网格：横线向观众流动
  if (!calm) {
    const hy = 650, vx = 960;
    ctx.save(); ctx.lineWidth = 1;
    for (let x = -1500; x <= 3400; x += 150) {
      const g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, rgba(C.sky, 0)); g.addColorStop(1, rgba(C.sky, 0.16));
      ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(vx + (x - vx) * 0.08, hy); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const z = (i + ((T * 0.5) % 1)) / 14, y = hy + (H - hy) * Math.pow(z, 2.2);
      ctx.strokeStyle = rgba(C.sky, 0.2 * z); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }
  // 光流：正弦曲线上的彗星光点
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  STREAMS.slice(0, calm ? 3 : 8).forEach(s => {
    ctx.beginPath();
    for (let x = -100; x <= W + 100; x += 40) { const y = s.y + Math.sin(x * s.f + s.p + T * s.w) * s.a; x < -99 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.setLineDash([]); ctx.strokeStyle = rgba(C.sky, calm ? 0.04 : 0.07); ctx.lineWidth = 1.5; ctx.stroke();
    const L = W + 400, pos = (T * s.v + s.o) % (L + 600);
    ctx.setLineDash([220, L + 600]); ctx.lineDashOffset = -(pos - 220);
    ctx.strokeStyle = rgba(C.streak, calm ? 0.3 : 0.45); ctx.lineWidth = 2; ctx.shadowColor = rgba(C.streak, 0.9); ctx.shadowBlur = 12; ctx.stroke();
    ctx.shadowBlur = 0;
  });
  ctx.restore();
  // 粒子：三层景深，缓慢漂移并闪烁
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  PARTS.forEach((p, i) => {
    if (calm && i % 2) return;
    const x = ((p.x + T * p.vx * p.z) % W + W) % W, y = ((p.y - T * p.vy * p.z) % H + H) % H;
    const tw = 0.5 + 0.5 * Math.sin(T * p.f + p.p), s = 5 + 20 * p.z * (0.6 + 0.4 * tw);
    ctx.globalAlpha = (0.2 + 0.6 * tw) * p.z; ctx.drawImage(GLOW, x - s / 2, y - s / 2, s, s);
  });
  ctx.restore();
  // 暗角与颗粒
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0);
  v.addColorStop(0, 'rgba(2,8,40,0)'); v.addColorStop(1, 'rgba(2,8,40,.6)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = 0.035; ctx.globalCompositeOperation = 'overlay';
  const ox = Math.floor((T * 997) % 256), oy = Math.floor((T * 613) % 256);
  ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
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
