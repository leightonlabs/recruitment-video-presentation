// 通用绘图工具：主题色、缓动、路径、描线、文字、光标、动态背景等。所有函数都是时间的纯函数，便于逐帧渲染。
//
// 两套主题：
//   classic  —— 原粗剪的深蓝纯色风格；
//   vibrant  —— 动感科技蓝：明亮宝蓝底色，点阵光波、流动透视网格、细光线与粒子等清晰的动态元素；
//               面板为不透明深蓝卡片，线条与文字以白色为主、琥珀色点睛，不用荧光发光效果。
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
    // teal 在本主题中即“主线条色”，取白色；hi 为重点高亮（琥珀）；onLight 为浅色卡片上的强调色（品牌蓝）
    navy900: '#061A5C', navy800: '#0A2270', navy700: '#1240B8',
    teal: '#FFFFFF', teal5: '#FFFFFF', amber: '#FFB020', amber7: '#D97F00',
    paper: '#FFFFFF', ink: '#0B1B4D', muted: '#5D6E92', mutedDark: '#C3D2F5', white: '#FFFFFF',
    hi: '#FFB020', hiFill: '#FFB020', onLight: '#1747D6',
    bgTop: '#1858F2', bgMid: '#0C3FCB', bgBottom: '#072B94',
    ui0: '#061A5E', ui1: '#0A2270', tile: '#0A2270', slotOff: '#0D2E8A', dot: '#A9C2FF',
    column: '#0A2270', card2: '#123A9E', term: '#06154A', side: '#0A2270', cloud: '#DCE8FF', cloudFar: '#7FA6FF',
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
// 面板：动感主题下，默认深色面板（fill 为 navy800）为不透明卡片：投影、细白边与顶部高光线
export function panel(ctx, x, y, w, h, { fill = C.navy800, stroke = null, r = 14, alpha = 1, shadow = false } = {}) {
  const isCard = THEME.vibrant && fill === C.navy800;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (shadow || isCard) { ctx.shadowColor = isCard ? 'rgba(3,14,60,.45)' : 'rgba(0,0,0,.35)'; ctx.shadowBlur = isCard ? 28 : 30; ctx.shadowOffsetY = 10; }
  rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  ctx.shadowColor = 'transparent';
  if (isCard) {
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.clip();
    const hl = ctx.createLinearGradient(x, 0, x + w, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.5, 'rgba(255,255,255,.32)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(x, y, w, 2);
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
// 动感主题下不发光：主线条为半透明白，描线时线头更亮，描完后有一段白色光点沿线流动
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
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = width + 1;
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

// 动态背景的元素都是清晰的点和细线，不用大面积模糊光斑，避免画面发虚
const PARTS = (() => { const R = rng(41); return Array.from({ length: 70 }, () => ({ x: R() * 1920, y: R() * 1080, z: 0.3 + R() * 0.7, vx: 6 + R() * 14, vy: 10 + R() * 22, f: 0.6 + R() * 1.8, p: R() * 6.28 })); })();
// 细光线只走画面上下两条带，避开中部内容区
const STREAKS = (() => { const R = rng(53); return Array.from({ length: 6 }, (_, i) => ({ y: (i % 2 ? 900 : 60) + Math.floor(i / 2) * 44 + Math.round((R() - 0.5) * 20), len: 260 + R() * 260, v: 260 + R() * 260, o: R() * 4000, dir: i % 3 === 1 ? -1 : 1 })); })();

function vibrantBg(ctx, { calm = false } = {}) {
  const T = NOW, W = 1920, H = 1080;
  // 底色：左上明亮、右下深沉的宝蓝斜向渐变，再加一处缓慢移动的大范围亮区
  const base = ctx.createLinearGradient(0, 0, W * 0.55, H * 1.15);
  base.addColorStop(0, C.bgTop); base.addColorStop(0.5, C.bgMid); base.addColorStop(1, C.bgBottom);
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  const lx = 620 + Math.sin(T * 0.11) * 360, ly = 240 + Math.cos(T * 0.08) * 140;
  const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 1400);
  lg.addColorStop(0, `rgba(110,170,255,${calm ? 0.14 : 0.22})`); lg.addColorStop(1, 'rgba(110,170,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  // 点阵：每 40px 一个方点，一道斜向光波每 6 秒扫过，经过处点变亮变大
  const wave = ((T / 6) % 1) * (W + H + 900) - 450;
  for (let y = 20; y < H; y += 40) for (let x = 20; x < W; x += 40) {
    const d = Math.abs(x + y * 0.8 - wave), k = d < 260 ? Math.pow(1 - d / 260, 2) : 0;
    const a = (calm ? 0.07 : 0.1) + k * (calm ? 0.16 : 0.3), sz = 2 + k * 1.5;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  // 透视网格：横线向观众流动
  if (!calm) {
    const hy = 700, vx = 960;
    ctx.save(); ctx.lineWidth = 1;
    for (let x = -1500; x <= 3400; x += 160) {
      const g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.16)');
      ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(vx + (x - vx) * 0.08, hy); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const z = (i + ((T * 0.4) % 1)) / 12, y = hy + (H - hy) * Math.pow(z, 2.2);
      ctx.strokeStyle = `rgba(255,255,255,${(0.18 * z).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }
  // 细光线：上下边带内水平滑过的白色细线，带渐隐尾巴
  STREAKS.slice(0, calm ? 2 : 6).forEach(s => {
    const span = W + s.len * 2, p = (T * s.v + s.o) % span - s.len, x = s.dir > 0 ? p : W - p;
    const g = ctx.createLinearGradient(x - s.dir * s.len, 0, x, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${calm ? 0.35 : 0.55})`);
    ctx.fillStyle = g; ctx.fillRect(Math.min(x, x - s.dir * s.len), s.y, s.len, 1.5);
  });
  // 粒子：实心小圆点，三层景深缓慢上浮并闪烁
  ctx.save(); ctx.fillStyle = '#FFFFFF';
  PARTS.forEach((p, i) => {
    if (calm && i % 2) return;
    const x = ((p.x + T * p.vx * p.z) % W + W) % W, y = ((p.y - T * p.vy * p.z) % H + H) % H;
    const tw = 0.5 + 0.5 * Math.sin(T * p.f + p.p);
    ctx.globalAlpha = (0.25 + 0.5 * tw) * p.z; ctx.beginPath(); ctx.arc(x, y, 1 + 1.8 * p.z, 0, 7); ctx.fill();
  });
  ctx.restore();
  // 轻微压暗四角
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(4,18,80,0)'); v.addColorStop(1, 'rgba(4,18,80,.35)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
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
