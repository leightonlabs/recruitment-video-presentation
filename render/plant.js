// 场站画面的公共部分：夜空背景、片头镜头路线、场站主图（取代原水管主图）与同类样本图。
// 主图按两倍分辨率渲染，供工作台、对比、规范页等镜头放大截取时保持清晰；标注区域由三维模型投影得到。
import { makeFacility, FACILITY } from './facility.js';
import { lerp, seg, clamp, easeInOut, rng } from './draw.js';

const W = 1920, H = 1080;

// 夜空：深靛蓝渐变、地平线辉光、极淡星点（scale 用于两倍分辨率画布）
const STARS = (() => { const R = rng(5); return Array.from({ length: 160 }, () => [R() * W, R() * H * 0.55, R(), R() * 6.28]); })();
export function night(ctx, t, horizon, scale = 1) {
  ctx.save(); ctx.scale(scale, scale);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#01030B'); g.addColorStop(clamp(horizon / H - 0.08), '#041033'); g.addColorStop(clamp(horizon / H), '#08205A'); g.addColorStop(1, '#020611');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(1100, horizon); ctx.scale(1, 0.32);
  const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1100); hg.addColorStop(0, 'rgba(40,110,255,.38)'); hg.addColorStop(1, 'rgba(40,110,255,0)');
  ctx.fillStyle = hg; ctx.fillRect(-1300, -1100, 2600, 2200); ctx.restore();
  STARS.forEach(([x, y, a, p]) => { if (y > horizon - 40) return; ctx.globalAlpha = (0.1 + 0.35 * a) * (0.7 + 0.3 * Math.sin(t * 1.3 + p)); ctx.fillStyle = '#cfe0ff'; ctx.fillRect(x, y, 1.6, 1.6); });
  ctx.restore();
}
export function vignette(ctx, a = 0.45) {
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,2,10,${a})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
// 三维画布以“加亮”方式叠加：光点只增加亮度，不遮挡下层
export function drawPlant(ctx, canvas, w = W, h = H) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(canvas, 0, 0, w, h); ctx.restore();
}
export const horizonOf = F => F.project([F.cam.position.x, 0, -400])[1];

// 片头镜头：0–5 秒从远处缓慢推近；第 5 秒的构图即场站主图
export const HERO_T = 5, HERO_STEAM_T = 20;
export function heroCamera(F, t) {
  const k = easeInOut(seg(t, 0, 5));
  F.setCamera([lerp(-20, -16.5, k), lerp(10.5, 9.2, k), lerp(40, 34, k)], [lerp(1.0, 1.6, k), lerp(3.6, 3.9, k), -5], 28);
}

// 凸包（单调链），用于把目标包围盒的投影变成多边形
export function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const corners = ([a, b]) => { const p = []; for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) p.push([x, y, z]); return p; };
export const targetPolygon = (F, cam = F.cam, vp) => hull(corners(FACILITY.targetBox).map(v => F.project(v, cam, vp)));

// 场站主图：片头最后一帧的构图（同一时刻的蒸汽），两倍分辨率；标注区域为主图像素坐标
export function makePlantHero() {
  const S = 2, F2 = makeFacility({ W: W * S, H: H * S });
  heroCamera(F2, HERO_T); F2.update({ t: HERO_STEAM_T + HERO_T });
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const g = c.getContext('2d');
  night(g, HERO_T, horizonOf(F2) / S, S);
  drawPlant(g, F2.render(), W * S, H * S);
  const target = targetPolygon(F2);
  const xs = target.map(p => p[0]), ys = target.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], bw = x1 - x0, bh = y1 - y0;
  const [gx, gy] = F2.project(FACILITY.glare);
  const anchors = {
    target,
    glare: [gx - 34 * S, gy - 30 * S, gx + 34 * S, gy + 30 * S],
    steam: [x0 + bw * 0.62, y0 + bh * 0.15, x1 + bw * 0.45, y1 + bh * 0.4], // 阀组右侧被蒸汽遮住的区域
  };
  F2.dispose();
  return { canvas: c, anchors };
}

// 同类样本：三座精馏塔塔顶都属同类目标，轮流取用，并在四周不同方位、远近与蒸汽量下取景
export function sampleCamera(F, i) {
  const R = rng(100 + i), col = FACILITY.columns[[2, 0, 1][i % 3]], top = [col.c[0], col.h + 0.2, col.c[2]];
  const a = -2.4 + R() * 4.8, d = 5 + R() * 11, h = -1.5 + R() * 6;
  F.setCamera([top[0] + Math.sin(a) * d, top[1] + h, top[2] + Math.cos(a) * d], [top[0], top[1] - 0.8 - R() * 1.5, top[2]], 28 + R() * 10);
  F.update({ t: 30 + i * 3.7, steamAmount: 0.6 + R() * 2.2 });
}
export function renderSample(F, i, w = 480, h = 270) {
  sampleCamera(F, i);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#020818'); sky.addColorStop(1, '#0a2160'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  drawPlant(g, F.render(), w, h);
  return c;
}
// 样本 023：从塔的另一侧取景，蒸汽更浓，塔顶阀组被遮住大半；返回画面与目标中心（像素坐标）
export function renderSample023(F) {
  const top = FACILITY.target;
  F.setCamera([top[0] + 6.5, top[1] + 1.6, top[2] + 9.5], [top[0], top[1] - 0.6, top[2]], 30);
  F.update({ t: 47.3, steamAmount: 1.5 });
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  night(g, 64, horizonOf(F)); drawPlant(g, F.render());
  return { canvas: c, focus: F.project(top) };
}
