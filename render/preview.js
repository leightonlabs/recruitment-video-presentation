// 改版预览：用数字孪生场站渲染新方案的关键画面，供客户确认方向后再接入正片。
// window.renderPreview(名称) 画出一帧；名称见 FRAMES。
import { makeFacility, FACILITY } from './facility.js';
import { C, applyTheme, setNow, text, rr, rgba, lerp, seg, easeOut, easeInOut, clamp, rng, panel, checkbox, cursor, check, hatch, bgNavy, drawLine } from './draw.js';

applyTheme('vibrant');
const W = 1920, H = 1080;
const ctx = document.getElementById('stage').getContext('2d');
const F = makeFacility();
const ACC = '#6CCFF0', AMBER = '#FFB020';

// ---------- 夜空背景：深靛蓝渐变、地平线辉光、极淡星点 ----------
const STARS = (() => { const R = rng(5); return Array.from({ length: 160 }, () => [R() * W, R() * H * 0.55, R(), R() * 6.28]); })();
function night(t, horizon) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#01030B'); g.addColorStop(clamp(horizon / H - 0.08), '#041033'); g.addColorStop(clamp(horizon / H), '#08205A'); g.addColorStop(1, '#020611');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(1100, horizon); ctx.scale(1, 0.32);
  const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1100); hg.addColorStop(0, 'rgba(40,110,255,.38)'); hg.addColorStop(1, 'rgba(40,110,255,0)');
  ctx.fillStyle = hg; ctx.fillRect(-1300, -1100, 2600, 2200); ctx.restore();
  STARS.forEach(([x, y, a, p]) => { if (y > horizon - 40) return; ctx.globalAlpha = (0.1 + 0.35 * a) * (0.7 + 0.3 * Math.sin(t * 1.3 + p)); ctx.fillStyle = '#cfe0ff'; ctx.fillRect(x, y, 1.6, 1.6); });
  ctx.globalAlpha = 1;
}
function finish() {
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,2,10,.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------- 标注元素 ----------
function brackets(b, { color = 'rgba(255,255,255,.6)', len = 16, pad = 8, width = 1.5, alpha = 1 } = {}) {
  const [x0, y0, x1, y1] = [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
  for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { ctx.moveTo(x + sx * len, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * len); }
  ctx.stroke(); ctx.restore();
  return [x0, y0, x1, y1];
}
function tag(str, x, y, { amber = false, alpha = 1, size = 20 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = `700 ${size}px NS`;
  const w = ctx.measureText(str).width + 24, h = size + 14;
  rr(ctx, x, y - h, w, h, 4); ctx.fillStyle = 'rgba(8,28,92,.78)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = amber ? AMBER : '#86D6F2'; ctx.textBaseline = 'middle'; ctx.fillText(str, x + 12, y - h / 2 + 1);
  ctx.restore();
}
function label(str, x, y, { idx = '', alpha = 1, color = 'rgba(225,235,255,.85)' } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha;
  if (idx) { ctx.font = '400 13px JB'; ctx.fillStyle = 'rgba(134,214,242,.8)'; ctx.fillText(idx, x, y - 22); }
  ctx.font = '700 17px NS'; ctx.fillStyle = color; ctx.fillText(str, x, y - 4); ctx.restore();
}
function title(str, x, y, size = 72) {
  ctx.save(); ctx.font = `700 ${size}px NS`; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,6,40,.6)'; ctx.shadowBlur = 18;
  ctx.fillText(str, x, y); ctx.restore();
}
function eyebrow(str, x, y) {
  ctx.save(); ctx.font = '700 26px NS'; ctx.fillStyle = '#86D6F2'; ctx.letterSpacing = '5px'; ctx.fillText(str, x, y); ctx.restore();
}
function notice(str) { text(ctx, str, 128, 1030, { font: '400 18px NS', color: 'rgba(200,225,255,.6)' }); }
const horizonY = () => F.project([F.cam.position.x, 0, -400])[1];

// ---------- 片头 S01：扫描显现 → 感知标注 ----------
// 三维层以“加亮”方式叠在夜空上，光点只增加亮度，不遮挡背景
const draw3D = () => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(F.render(), 0, 0); ctx.restore(); };
// 识别波：各设备按从左到右的顺序依次点亮再回落
const UNIT_ORDER = [11, 1, 2, 9, 10, 3, 4, 5, 12, 6, 8, 7];
const unitWave = tb => { const u = []; UNIT_ORDER.forEach((id, i) => { const p = seg(tb, i * 0.05, i * 0.05 + 0.5); u[id] = Math.sin(Math.PI * p) * 0.9; }); return u; };
function s01Camera(t) {
  const k = easeInOut(seg(t, 0, 5));
  F.setCamera([lerp(-20, -16.5, k), lerp(10.5, 9.2, k), lerp(40, 34, k)], [lerp(1.0, 1.6, k), lerp(3.6, 3.9, k), -5], 28);
}
function s01(t) {
  s01Camera(t); setNow(t);
  const scan = lerp(-17, 19, easeInOut(seg(t, 0.15, 2.8))), glow = seg(t, 0.1, 0.4) * (1 - seg(t, 2.6, 3.0));
  F.update({ t: 20 + t, scan, scanGlow: glow, glare: 1, units: t > 3 ? unitWave(t - 3) : [] });
  night(t, horizonY());
  draw3D();
  if (t >= 3.0) perception(t - 3.0);
  if (t > 0.8) { ctx.save(); ctx.globalAlpha = easeOut(seg(t, 0.8, 1.3)); title('AI，怎样看懂真实世界？', 128, 900); ctx.restore(); }
  notice('本片部分画面由代码生成，仅作工作场景示意');
  finish();
}
function perception(tb) {
  // 通用模型的误判：琥珀色虚线框落在球罐反光上
  const ga = easeOut(seg(tb, 0.7, 1.0));
  if (ga > 0) {
    const [gx, gy] = F.project(FACILITY.glare);
    ctx.save(); ctx.globalAlpha = ga; ctx.setLineDash([8, 6]); ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
    ctx.strokeRect(gx - 34, gy - 30, 68, 60); ctx.restore();
    tag('通用模型：异常？', gx - 34, gy - 40, { amber: true, alpha: ga });
  }
  // 真正的目标：塔顶阀组（部分被蒸汽遮挡），精确的角标框
  const ta = easeOut(seg(tb, 1.1, 1.45));
  if (ta > 0) {
    const b = F.projectBox(FACILITY.targetBox);
    ctx.save(); ctx.globalAlpha = ta * 0.12; ctx.fillStyle = ACC; ctx.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); ctx.restore();
    ctx.save(); ctx.globalAlpha = ta * 0.5; ctx.strokeStyle = ACC; ctx.lineWidth = 1; ctx.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); ctx.restore();
    brackets(b, { color: ACC, len: 18, pad: 6, width: 2.5, alpha: ta });
    tag('边界案例 017', b[2] + 16, b[1] + 10, { alpha: ta });
  }
}

// ---------- 其余镜头 ----------
const T = FACILITY.target, TB = FACILITY.targetBox;
const boxPts = ([a, b]) => { const p = []; for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) p.push([x, y, z]); return p; };
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
function box3d(box, cam, vp, { color = ACC, width = 2, alpha = 1 } = {}) {
  const q = boxPts(box).map(v => F.project(v, cam, vp));
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowColor = rgba(color, 0.6); ctx.shadowBlur = 8;
  ctx.beginPath(); EDGES.forEach(([i, j]) => { ctx.moveTo(...q[i]); ctx.lineTo(...q[j]); }); ctx.stroke(); ctx.restore();
  return q;
}
// 只截取目标附近的局部：判断二不含右侧被蒸汽挡住的部分
const PARTIAL = [TB[0], [TB[0][0] + (TB[1][0] - TB[0][0]) * 0.6, TB[1][1], TB[1][2]]];

// S02 场景工作台：画布为场站局部，琥珀色为通用模型输出（框在反光上、漏掉蒸汽遮挡处），青色为现场复核
function s02() {
  setNow(7);
  F.setCamera([-6, 9, 22], [6.4, 5.4, -2.8], 30);
  F.update({ t: 27, steamAmount: 1.3 });
  ctx.fillStyle = C.ui0; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.ui1; ctx.fillRect(0, 0, W, 64); ctx.fillRect(0, 64, 72, H);
  text(ctx, '场景工作台', 100, 42, { font: '700 24px NS', color: C.teal }); text(ctx, '边界案例 017', 260, 42, { font: '400 24px NS', color: '#fff' });
  for (let i = 0; i < 6; i++) { rr(ctx, 18, 100 + i * 64, 36, 36, 8); ctx.strokeStyle = i === 1 ? C.edge : 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.save(); rr(ctx, 100, 90, 1290, 740, 12); ctx.clip();
  night(7, horizonY()); draw3D();
  // 通用模型：反光误判 + 只框到阀组可见部分
  const [gx, gy] = F.project(FACILITY.glare);
  ctx.save(); ctx.setLineDash([8, 6]); ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.strokeRect(gx - 30, gy - 26, 60, 52);
  const pb = F.projectBox(PARTIAL); ctx.strokeRect(pb[0], pb[1], pb[2] - pb[0], pb[3] - pb[1]); ctx.restore();
  // 现场复核：完整目标（含蒸汽遮挡部分），顶点方块，光标正在拖动右下角
  const b = F.projectBox(TB);
  ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = ACC; ctx.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); ctx.restore();
  ctx.save(); ctx.strokeStyle = ACC; ctx.lineWidth = 2.5; ctx.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
  ctx.fillStyle = ACC; for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) ctx.fillRect(x - 6, y - 6, 12, 12); ctx.restore();
  cursor(ctx, b[2] + 4, b[3] + 4, { press: 0.4 });
  ctx.restore();
  panel(ctx, 1420, 100, 460, 900, { fill: C.ui1, r: 12 });
  text(ctx, '类别', 1450, 150, { font: '400 22px NS', color: C.mutedDark });
  panel(ctx, 1450, 166, 150, 44, { fill: rgba(C.teal, 0.18), r: 22 }); text(ctx, '塔顶阀组', 1475, 196, { font: '700 22px NS', color: C.teal });
  text(ctx, '属性', 1450, 260, { font: '400 22px NS', color: C.mutedDark });
  checkbox(ctx, 1450, 302, '遮挡', false); checkbox(ctx, 1600, 302, '反光', false);
  text(ctx, '图层', 1450, 370, { font: '400 22px NS', color: C.mutedDark });
  ctx.fillStyle = AMBER; ctx.fillRect(1450, 392, 18, 18); text(ctx, '模型输出', 1480, 409, { font: '400 22px NS' });
  ctx.fillStyle = C.teal; ctx.fillRect(1620, 392, 18, 18); text(ctx, '现场复核', 1650, 409, { font: '400 22px NS' });
  ctx.fillStyle = C.ui1; ctx.fillRect(100, 850, 1280, 150);
  thumbs(5).forEach((img, i) => ctx.drawImage(img, 120 + i * 250, 870, 220, 124));
  eyebrowLine('模型输出｜现场复核', 128, 125);
}
function eyebrowLine(str, x, y) {
  ctx.save(); ctx.font = '700 26px NS'; ctx.letterSpacing = '5px'; ctx.fillStyle = '#86D6F2'; ctx.fillText(str, x, y); ctx.restore();
}

// 同类样本：以目标为中心，换角度、高度与蒸汽量
const THUMB = document.createElement('canvas'); THUMB.width = 480; THUMB.height = 270;
function sampleView(i) {
  // 三座精馏塔塔顶都属同类目标，轮流取用，并在四周不同方位、高度取景
  const R = rng(100 + i), col = FACILITY.columns[[2, 0, 1][i % 3]], top = [col.c[0], col.h + 0.2, col.c[2]];
  const a = -2.4 + R() * 4.8, d = 5 + R() * 11, h = -1.5 + R() * 6;
  F.setCamera([top[0] + Math.sin(a) * d, top[1] + h, top[2] + Math.cos(a) * d], [top[0], top[1] - 0.8 - R() * 1.5, top[2]], 28 + R() * 10);
  F.update({ t: 30 + i * 3.7, steamAmount: 0.6 + R() * 2.2 });
}
function thumbs(n) {
  return Array.from({ length: n }, (_, i) => {
    sampleView(i);
    const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 270); sky.addColorStop(0, '#020818'); sky.addColorStop(1, '#0a2160'); g.fillStyle = sky; g.fillRect(0, 0, 480, 270);
    g.globalCompositeOperation = 'lighter'; g.drawImage(F.render(), 0, 0, 480, 270);
    return c;
  });
}

// S07 边界对比：阀组局部近景，蒸汽挡住右侧；判断一（含遮挡部分）与判断二（不含），差异区斜线填充
function s07() {
  setNow(42);
  F.setCamera([0.2, 11.4, 4.6], [5.1, 9.6, -3.9], 24);
  F.update({ t: 41.5, steamAmount: 1.2 });
  night(42, horizonY()); draw3D();
  const b1 = F.projectBox(TB), b2 = F.projectBox(PARTIAL);
  ctx.save(); ctx.beginPath(); ctx.rect(b2[2], b1[1], b1[2] - b2[2], b1[3] - b1[1]); ctx.clip(); hatch(ctx, b2[2], b1[1], b1[2] - b2[2], b1[3] - b1[1], rgba(ACC, 0.5), 14); ctx.restore();
  ctx.save(); ctx.strokeStyle = ACC; ctx.lineWidth = 2.5; ctx.strokeRect(b1[0], b1[1], b1[2] - b1[0], b1[3] - b1[1]); ctx.restore();
  ctx.save(); ctx.setLineDash([10, 7]); ctx.strokeStyle = AMBER; ctx.lineWidth = 2.5; ctx.strokeRect(b2[0] + 6, b2[1] + 6, b2[2] - b2[0] - 12, b2[3] - b2[1] - 12); ctx.restore();
  tag('判断一', b1[0], b1[1] - 10);
  tag('判断二', b2[0] + 6, b2[3] + 44, { amber: true });
  panel(ctx, 1300, 660, 520, 150, { r: 14 });
  text(ctx, '场景规范 1.2 版', 1330, 710, { font: '400 22px NS', color: C.mutedDark });
  text(ctx, '遮挡区域未定义', 1330, 770, { font: '700 34px NS', color: '#fff' });
  eyebrowLine('边界案例｜规则对齐', 128, 110);
  finish();
}

// S08 复核网格：12 张同类样本，9 张符合 1.3 版，3 张按 1.3 版修正
function s08() {
  setNow(47); bgNavy(ctx);
  const imgs = thumbs(12), w = 380, h = 214, gap = 24, x0 = (W - (4 * w + 3 * gap)) / 2, y0 = 190, fixes = [2, 7, 9];
  imgs.forEach((img, i) => {
    const c = i % 4, r = Math.floor(i / 4), x = x0 + c * (w + gap), y = y0 + r * (h + gap);
    ctx.save(); rr(ctx, x, y, w, h, 10); ctx.clip(); ctx.drawImage(img, x, y, w, h); ctx.restore();
    ctx.save(); rr(ctx, x, y, w, h, 10); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
    const fix = fixes.includes(i), cx = x + w - 34, cy = y + 34;
    ctx.fillStyle = fix ? AMBER : C.teal5; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 7); ctx.fill();
    if (fix) { text(ctx, '!', cx, cy + 9, { font: '900 24px NS', align: 'center', color: '#fff' }); panel(ctx, x + 12, y + h - 50, 200, 38, { fill: rgba(AMBER, 0.92), r: 6 }); text(ctx, '按 1.3 版修正', x + 112, y + h - 24, { font: '700 19px NS', color: C.navy900, align: 'center' }); }
    else check(ctx, cx, cy, 20, 1, '#fff');
  });
  ctx.save(); const sy = y0 + 2 * (h + gap) - 12; const lg = ctx.createLinearGradient(0, sy - 30, 0, sy); lg.addColorStop(0, rgba(ACC, 0)); lg.addColorStop(1, rgba(ACC, 0.35));
  ctx.fillStyle = lg; ctx.fillRect(x0 - 20, sy - 30, 4 * w + 3 * gap + 40, 30); ctx.fillStyle = ACC; ctx.fillRect(x0 - 20, sy, 4 * w + 3 * gap + 40, 2); ctx.restore();
}

// S09 三维点云：环绕最高精馏塔，目标点变为琥珀色，三维框与坐标轴
function s09() {
  setNow(53.5);
  const a = -0.62;
  F.setCamera([T[0] + Math.sin(a) * 15, 12.5, T[2] + Math.cos(a) * 15], [4.0, 6.6, -4.2], 34);
  F.update({ t: 53, targetMix: 1, steamAmount: 0.7, units: { 5: 0.25 } });
  night(53, horizonY()); draw3D();
  const q = box3d(TB, F.cam);
  tag('目标框定 · 塔顶阀组', Math.max(...q.map(p => p[0])) + 18, Math.min(...q.map(p => p[1])) + 34);
  const o = [-2.5, 0, 3], L = 2.2, po = F.project(o);
  [[[L, 0, 0], AMBER], [[0, L, 0], ACC], [[0, 0, L], '#ffffff']].forEach(([d, col]) => {
    const pe = F.project([o[0] + d[0], o[1] + d[1], o[2] + d[2]]); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...po); ctx.lineTo(...pe); ctx.stroke();
  });
  eyebrowLine('三维点云｜场景分割｜目标框定', 128, 110);
  finish();
}

// S10 三视图：主视、俯视、三维同时高亮同一目标，以引线相连
function s10() {
  setNow(59); bgNavy(ctx, { dots: false });
  F.update({ t: 59, targetMix: 1, steamAmount: 0.6 });
  const VP = [[75, 300, 580, 390], [670, 300, 580, 390], [1265, 300, 580, 390]], asp = 580 / 390;
  const front = F.ortho([0, 0, 1], [0, 1, 0], [12.5, 12.5 / asp], [1.6, 6.5, -5]);
  const top = F.ortho([0, 1, 0], [0, 0, -1], [13, 13 / asp], [1.6, 0, -5.5]);
  const persp = new F.THREE.PerspectiveCamera(32, asp, 0.1, 400); persp.position.set(-14, 13, 26); persp.lookAt(2.5, 4, -5); persp.updateMatrixWorld();
  const cams = [front, top, persp], pts = [];
  VP.forEach(v => panel(ctx, v[0], v[1], v[2], v[3], { r: 8 }));
  F.clear(); VP.forEach((v, i) => F.render(v, cams[i]));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(F.canvas, 0, 0); ctx.restore();
  VP.forEach((v, i) => {
    const p = F.project(T, cams[i], v); pts.push(p);
    ctx.save(); ctx.strokeStyle = AMBER; ctx.lineWidth = 2.5; ctx.strokeRect(p[0] - 14, p[1] - 14, 28, 28); ctx.restore();
    text(ctx, ['主视', '俯视', '三维'][i], v[0] + 16, v[1] - 14, { font: '700 24px NS', color: C.teal });
  });
  drawLine(ctx, pts, 1, { width: 3, glow: 10, flow: false });
  tag('同一目标 · 三个视图', 960 - 110, 790);
  eyebrowLine('三维场景 → 模型输入（示意）', 128, 110);
}

const FRAMES = {
  S01a: () => s01(1.5),
  S01b: () => s01(2.7),
  S01c: () => s01(4.6),
  S02: s02, S07: s07, S08: s08, S09: s09, S10: s10,
};
window.renderPreview = name => { ctx.clearRect(0, 0, W, H); FRAMES[name](); return true; };
window.PREVIEW_FRAMES = Object.keys(FRAMES);
await document.fonts.load('700 72px NS'); await document.fonts.load('400 13px JB');
window.ready = true;
