// 二维场景：AI 画面占位、场景工作台、信息图、岗位卡与片尾。主图为程序渲染的场站画面（plant.js）。场景签名 fn(ctx, P)，
// P = { shot, beat, bi, t（镜头内秒）, tb（拍内秒）, bd（拍长）, sd（镜头长） }。
import {
  C, clamp, lerp, seg, easeOut, easeInOut, rgba, rng, rr, panel, polyPath, drawLine, nodes, dashRect, text, wrap,
  check, cursor, checkbox, hatch, bgNavy, placeImage, imageInRect, centroid, bbox, THEME,
} from './draw.js';
import { renderSample, renderSample023, drawPlant } from './plant.js';

export function makeScenes2D(env, S3) {
  const { hero, heroA, story } = env;
  const W = 1920, H = 1080;
  // 主图为两倍分辨率：HS 为主图像素与屏幕像素之比，HC 为主图中心（主图像素）
  const HS = hero.width / W, HC = [hero.width / 2, hero.height / 2];
  const shotById = Object.fromEntries(story.shots.map(s => [s.id, s]));
  const textOf = (sid, zone) => (shotById[sid].text.find(x => x.zone === zone) || {}).content || '';
  const scratch = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const cache = {};
  const cached = (key, fn) => cache[key] || (cache[key] = fn());

  // ---------- 主图上的几何 ----------
  const T = heroA.target, TC = centroid(T);
  const [sx0, sy0, sx1, sy1] = heroA.steam, SC = [(sx0 + sx1) / 2, (sy0 + sy1) / 2];
  const [gx0, gy0, gx1, gy1] = heroA.glare, GC = [(gx0 + gx1) / 2, (gy0 + gy1) / 2];
  const inSteam = p => p[0] > sx0 - 30 * HS && p[1] > sy0 - 40 * HS;
  const PARTIAL = T.map(p => (inSteam(p) ? [lerp(p[0], TC[0], 0.55), lerp(p[1], TC[1], 0.55)] : p)); // 通用模型 / 判断二：漏掉遮挡处
  const EXPANDED = T.map(p => (inSteam(p) ? [TC[0] + (p[0] - TC[0]) * 1.25, TC[1] + (p[1] - TC[1]) * 1.25] : p)); // 判断一：含遮挡区
  const DRAG = T.map((p, i) => [i, Math.hypot(p[0] - PARTIAL[i][0], p[1] - PARTIAL[i][1])]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
  const mapPts = (m, pts) => pts.map(m);
  const glareRect = m => { const a = m([gx0, gy0]), b = m([gx1, gy1]); return [a[0], a[1], b[0] - a[0], b[1] - a[1]]; };

  // ---------- 同类样本：从场站模型的不同方位、远近与蒸汽量取景 ----------
  const samples = Array.from({ length: 12 }, (_, i) => renderSample(env.plant, i));
  const S023 = renderSample023(env.plant), sample023 = S023.canvas;
  const plantMini = cached('plant-mini', () => {
    const F = env.plant, c = scratch(480, 270), g = c.getContext('2d');
    F.setCamera([-18, 12, 32], [2.4, 4.6, -5], 30); F.update({ t: 26, targetMix: 1, steamAmount: 0.5, bright: 2.6 });
    g.fillStyle = C.term; g.fillRect(0, 0, 480, 270); drawPlant(g, F.render(), 480, 270); return c;
  });

  // ---------- AI 视频占位 ----------
  const PALETTE = {
    V_EYE: ['#050d18', '#123349'], V_OFFICE_PULLBACK: ['#161f2e', '#3d3224'], V_PLANT_DUSK: ['#0b1d33', '#3b2a1f'],
    V_PAIR_DISCUSS: ['#231f1b', '#46382a'], V_MENTOR: ['#26211b', '#4a3b2b'], V_TEAM_TABLE: ['#1f2228', '#44392d'],
    V_3D_OVER_SHOULDER: ['#060e19', '#10263a'], V_CODER_HANDS: ['#060e19', '#13283b'], V_WHITEBOARD: ['#384453', '#7d8ea0'],
    V_STAIRS: ['#3c3d45', '#8a7a62'],
  };
  function plate(ctx, P) {
    const id = P.beat.asset, asset = story.assets[id] || {}, pal = PALETTE[id] || [C.navy900, C.navy700];
    const k = P.tb / Math.max(P.bd, 0.01), cam = asset.camera || '';
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    let s = 1, dx = 0;
    if (cam.includes('后拉')) s = lerp(1.1, 1, k); else if (cam.includes('推')) s = lerp(1, 1.07, k);
    if (cam.includes('摇')) dx = lerp(0, -60, k);
    const R = rng(id.length * 97 + 13);
    ctx.save(); ctx.translate(W / 2 + dx, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
    for (let i = 0; i < 16; i++) {
      const x = R() * W, y = R() * H, r = 60 + R() * 220, warm = R() > 0.5;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, warm ? 'rgba(255,190,120,.16)' : 'rgba(120,200,230,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (P.noCard) return;
    // 去掉审阅信息时（clean）只保留“视频占位”与画面内容说明，不显示资产编号、时长、运镜与进度条
    if (env.clean) {
      const x = 440, y = 660, w = 1040, h = 180;
      panel(ctx, x, y, w, h, { fill: 'rgba(6,32,69,.72)', r: 16 });
      dashRect(ctx, x, y, w, h, { color: rgba(C.edge, 0.7), width: 2, dash: [10, 8] });
      text(ctx, '视频占位', x + 40, y + 56, { font: '700 26px NS', color: C.teal });
      wrap(ctx, P.beat.do || '', x + 40, y + 112, w - 80, 42, { font: '400 30px NS', color: '#fff', maxLines: 2 });
      return;
    }
    const x = 440, y = 640, w = 1040, h = 230;
    panel(ctx, x, y, w, h, { fill: 'rgba(6,32,69,.72)', r: 16 });
    dashRect(ctx, x, y, w, h, { color: rgba(C.edge, 0.7), width: 2, dash: [10, 8] });
    text(ctx, `AI 视频占位${P.beat.optional ? '（可选）' : ''}`, x + 40, y + 56, { font: '700 26px NS', color: C.teal });
    text(ctx, `${id}　·　生成 ${asset.gen_seconds || 5} 秒，取用 ${P.bd.toFixed(1)} 秒　·　${cam}`, x + 40, y + 96, { font: '400 22px NS', color: C.mutedDark });
    wrap(ctx, P.beat.do || '', x + 40, y + 148, w - 80, 42, { font: '400 30px NS', color: '#fff', maxLines: 2 });
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x + 40, y + h - 22, w - 80, 4);
    ctx.fillStyle = C.teal; ctx.fillRect(x + 40, y + h - 22, (w - 80) * clamp(k), 4);
  }
  const frozenPlate = (sid, blur = 18, dark = 0.72) => cached(`frozen-${sid}`, () => {
    const shot = shotById[sid], beat = shot.beats.find(b => b.src === 'A');
    const a = scratch(), b = scratch();
    plate(a.getContext('2d'), { shot, beat, tb: beat.t[1] - beat.t[0], bd: beat.t[1] - beat.t[0], noCard: true });
    const g = b.getContext('2d'); g.filter = `blur(${blur}px)`; g.drawImage(a, -40, -40, W + 80, H + 80); g.filter = 'none';
    g.fillStyle = rgba(C.navy900, dark); g.fillRect(0, 0, W, H); return b;
  });

  // ---------- 主图：压暗、手电光斑、推拉 ----------
  // S13：三块汇合为完整主图，暖色，目标多边形发光，由 1.06 缓拉至 1.00，与片头构图呼应
  function still_reveal(ctx, P) {
    const k = easeOut(seg(P.tb, 0, 2.4)), z = lerp(1.06, 1, k);
    bgNavy(ctx, { dots: false });
    ctx.save(); ctx.globalAlpha = easeOut(seg(P.tb, 0, 0.35));
    const m = imageInRect(ctx, hero, { x: 0, y: 0, w: W, h: H, r: 0 }, { zoom: z, focus: [lerp(TC[0], HC[0], k), lerp(TC[1], HC[1], k)] });
    ctx.fillStyle = 'rgba(255,170,80,.06)'; ctx.fillRect(0, 0, W, H);
    drawLine(ctx, mapPts(m, T), 1, { close: true, glow: 18 }); nodes(ctx, mapPts(m, T), 9);
    ctx.restore();
  }

  // ---------- 场景工作台 ----------
  const CR = { x: 100, y: 100, w: 1280, h: 720, r: 8 };
  function chrome(ctx, alpha, title, { checks = [false, false], layers = true, list = null, button = null, badge = null } = {}) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = C.ui0; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.ui1; ctx.fillRect(0, 0, W, 64); ctx.fillRect(0, 64, 72, H);
    text(ctx, '场景工作台', 100, 42, { font: '700 24px NS', color: C.teal });
    text(ctx, title, 260, 42, { font: '400 24px NS', color: '#fff' });
    for (let i = 0; i < 6; i++) { rr(ctx, 18, 100 + i * 64, 36, 36, 8); ctx.strokeStyle = i === 1 ? C.edge : 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke(); }
    panel(ctx, 1420, 100, 460, 900, { fill: C.ui1, r: 12 });
    text(ctx, '类别', 1450, 150, { font: '400 22px NS', color: C.mutedDark });
    panel(ctx, 1450, 166, 150, 44, { fill: rgba(C.teal, 0.18), r: 22 }); text(ctx, '塔顶阀组', 1475, 196, { font: '700 22px NS', color: C.teal });
    text(ctx, '属性', 1450, 260, { font: '400 22px NS', color: C.mutedDark });
    checkbox(ctx, 1450, 302, '遮挡', checks[0]); checkbox(ctx, 1600, 302, '反光', checks[1]);
    if (layers) {
      text(ctx, '图层', 1450, 370, { font: '400 22px NS', color: C.mutedDark });
      ctx.fillStyle = C.amber; ctx.fillRect(1450, 392, 18, 18); text(ctx, '模型输出', 1480, 409, { font: '400 22px NS' });
      ctx.fillStyle = C.teal; ctx.fillRect(1620, 392, 18, 18); text(ctx, '现场复核', 1650, 409, { font: '400 22px NS' });
    }
    if (button) { panel(ctx, 1450, 450, 400, 56, { fill: button.press ? C.teal5 : rgba(C.teal, 0.2), r: 10 }); text(ctx, button.label, 1650, 486, { font: '700 24px NS', color: button.press ? C.navy900 : C.teal, align: 'center' }); }
    if (list) {
      text(ctx, list.title, 1450, 570, { font: '400 22px NS', color: C.mutedDark });
      list.items.forEach((it, i) => {
        const y = 590 + i * 72, a = it.alpha ?? 1, dy = it.dy || 0;
        panel(ctx, 1450 + dy, y, 400, 60, { fill: it.hi ? rgba(C.teal, 0.22) : 'rgba(255,255,255,.05)', r: 8, alpha: a });
        text(ctx, it.label, 1470 + dy, y + 39, { font: `${it.hi ? 700 : 400} 22px NS`, color: it.hi ? C.teal : '#fff', alpha: a });
      });
    }
    if (badge) { panel(ctx, 1450, 860, 400, 56, { fill: rgba(C.teal, 0.2), r: 28, alpha: badge.alpha }); text(ctx, badge.label, 1650, 896, { font: '700 22px NS', color: C.teal, align: 'center', alpha: badge.alpha }); }
    ctx.fillStyle = C.ui1; ctx.fillRect(100, 850, 1280, 150);
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.globalAlpha = alpha * 0.85; ctx.drawImage(samples[i], 120 + i * 250, 870, 220, 124); ctx.restore(); }
    ctx.restore();
  }
  function scene_workbench(ctx, P) {
    const key = `${P.shot.id}:${P.bi}`, tb = P.tb;
    if (key === 'S02:0') {
      const k = easeInOut(seg(tb, 0, 0.48));
      chrome(ctx, k, '边界案例 017');
      const rect = { x: lerp(0, CR.x, k), y: lerp(0, CR.y, k), w: lerp(W, CR.w, k), h: lerp(H, CR.h, k), r: 8 * k };
      // 起点与片头最后一帧完全一致（主图即片头第 5 秒的构图），随后缩入工作台画布
      const m = imageInRect(ctx, hero, rect, { zoom: 1, focus: HC });
      const [x, y, w, h] = glareRect(m); dashRect(ctx, x, y, w, h, { width: 2.5 });
      drawLine(ctx, mapPts(m, T), 1, { close: true, width: 3, glow: 12 }); nodes(ctx, mapPts(m, T), 9);
      return;
    }
    if (key === 'S02:1') {
      chrome(ctx, 1, '边界案例 017');
      // 推近到目标与反光之间，两处都留在画布内
      const zk = easeInOut(seg(tb, 0, 0.45)), z = lerp(1, 1.45, zk), MID = [lerp(TC[0], GC[0], 0.45), lerp(TC[1], GC[1], 0.45)];
      const focus = [lerp(HC[0], MID[0], zk), lerp(HC[1], MID[1], zk)];
      const m = imageInRect(ctx, hero, CR, { zoom: z, focus });
      ctx.save(); rr(ctx, CR.x, CR.y, CR.w, CR.h, 8); ctx.clip();
      const [x, y, w, h] = glareRect(m); dashRect(ctx, x, y, w, h);
      ctx.save(); polyPath(ctx, mapPts(m, PARTIAL)); ctx.fillStyle = rgba(C.amber, 0.14); ctx.fill(); ctx.setLineDash([10, 7]); ctx.strokeStyle = C.amber; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      const k0 = easeInOut(seg(tb, 0.3, 0.9)), k1 = easeInOut(seg(tb, 1.1, 1.7));
      const live = T.map((p, i) => (i === DRAG[0] ? [lerp(PARTIAL[i][0], p[0], k0), lerp(PARTIAL[i][1], p[1], k0)] : i === DRAG[1] ? [lerp(PARTIAL[i][0], p[0], k1), lerp(PARTIAL[i][1], p[1], k1)] : p));
      const lp = mapPts(m, live);
      drawLine(ctx, lp, 1, { close: true, glow: 12 }); nodes(ctx, lp, 12);
      const di = tb < 1.0 ? DRAG[0] : DRAG[1];
      cursor(ctx, lp[di][0] + 4, lp[di][1] + 4, { press: (tb > 0.3 && tb < 0.9) || (tb > 1.1 && tb < 1.7) ? 0.3 : 0 });
      ctx.restore();
      return;
    }
    if (key === 'S07:0') {
      const press = seg(tb, 1.2, 1.45);
      chrome(ctx, 1, '边界案例 017', { button: { label: '加入边界案例', press: tb > 1.2 && tb < 1.5 },
        list: { title: '边界案例', items: [{ label: '案例 015 · 粉尘遮挡' }, { label: '案例 016 · 雨雾' }, { label: '案例 017 · 遮挡与反光', hi: true, alpha: easeOut(seg(tb, 1.3, 1.8)), dy: (1 - easeOut(seg(tb, 1.3, 1.8))) * 60 }] } });
      const m = imageInRect(ctx, hero, CR, { zoom: 1.15, focus: [(GC[0] + TC[0]) / 2 + 60 * HS, (GC[1] + TC[1]) / 2 + 40 * HS] });
      ctx.save(); rr(ctx, CR.x, CR.y, CR.w, CR.h, 8); ctx.clip();
      const a = easeOut(seg(tb, 0.2, 0.6));
      const q = (bx, by, bw, bh) => { dashRect(ctx, bx, by, bw, bh, { alpha: a }); text(ctx, '?', bx + bw + 10, by + 36, { font: '900 40px NS', color: C.amber, alpha: a }); };
      const [x, y, w, h] = glareRect(m); q(x, y, w, h);
      const s0 = m([sx0, sy0]), s1 = m([sx1, sy1]); q(s0[0], s0[1], s1[0] - s0[0], s1[1] - s0[1]);
      drawLine(ctx, mapPts(m, T), 1, { close: true, glow: 10 });
      ctx.restore();
      const from = m(TC), to = [1650, 478], kc = easeInOut(seg(tb, 0.6, 1.2));
      cursor(ctx, lerp(from[0], to[0], kc), lerp(from[1], to[1], kc), { press: press > 0 && press < 1 ? press : 0 });
      return;
    }
    if (key === 'S11:2') {
      const on = tb > 0.6;
      chrome(ctx, 1, '样本 023', { checks: [on, false], badge: { label: '已加入下一版行业数据集', alpha: easeOut(seg(tb, 0.9, 1.2)) } });
      const k = easeOut(seg(tb, 0, 0.35));
      imageInRect(ctx, sample023, { x: lerp(560, CR.x, k), y: lerp(330, CR.y, k), w: lerp(800, CR.w, k), h: lerp(450, CR.h, k), r: 8 }, { zoom: 1.4, focus: S023.focus });
      const kc = easeInOut(seg(tb, 0.15, 0.55));
      cursor(ctx, lerp(900, 1462, kc), lerp(600, 292, kc), { press: tb > 0.55 && tb < 0.75 ? seg(tb, 0.55, 0.75) : 0 });
      return;
    }
    if (key === 'S23:0') {
      const exp = easeInOut(seg(tb, 1.5, 2.4));
      chrome(ctx, 1 - exp, '场景应用规范 1.3 版 › 案例 017', { layers: false,
        list: { title: '场景应用规范 1.3 版', items: [{ label: '案例 015 · 粉尘遮挡' }, { label: '案例 016 · 雨雾' }, { label: '案例 017 · 遮挡与反光', hi: tb > 0.6 }] } });
      const show = easeOut(seg(tb, 0.7, 1.1));
      const rect = { x: lerp(CR.x, 0, exp), y: lerp(CR.y, 0, exp), w: lerp(CR.w, W, exp), h: lerp(CR.h, H, exp), r: 8 * (1 - exp) };
      ctx.save(); ctx.globalAlpha = Math.max(show, exp);
      const m = imageInRect(ctx, hero, rect, { zoom: lerp(1, 1.06, exp), focus: [lerp(HC[0], TC[0], exp), lerp(HC[1], TC[1], exp)] });
      drawLine(ctx, mapPts(m, T), 1, { close: true, glow: 14 }); nodes(ctx, mapPts(m, T), 9);
      ctx.restore();
      const kc = easeInOut(seg(tb, 0.1, 0.55)), cx = lerp(1100, 1620, kc), cy = lerp(700, 772, kc);
      if (exp < 0.5) { cursor(ctx, cx, cy, { press: tb > 0.55 && tb < 0.75 ? seg(tb, 0.55, 0.75) : 0, alpha: 1 - exp * 2 }); env.anchors.cursor = [cx + 26, cy - 4]; }
      return;
    }
    chrome(ctx, 1, P.shot.id);
  }

  function brand_card(ctx, P) {
    ctx.drawImage(frozenPlate('S03'), 0, 0);
    if (THEME.vibrant) { ctx.save(); ctx.globalAlpha = 0.85; bgNavy(ctx); ctx.restore(); }
    drawLine(ctx, [[912, 628], [1008, 628]], easeOut(seg(P.tb, 0.4, 0.8)), { width: 4 });
  }

  // ---------- S04 试点 ----------
  const DOTS = cached('dots', () => { const R = rng(32); return Array.from({ length: 32 }, (_, i) => [860 + (i % 8) * 118 + (R() - 0.5) * 70, 340 + Math.floor(i / 8) * 135 + (R() - 0.5) * 60]); });
  const HI = 21;
  function pilot_cities(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb;
    ctx.save(); ctx.strokeStyle = rgba(C.teal, 0.14); ctx.lineWidth = 1.5;
    DOTS.forEach((a, i) => DOTS.forEach((b, j) => { if (j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < 170) { ctx.globalAlpha = easeOut(seg(tb, 0.3, 1)); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); } }));
    ctx.restore();
    DOTS.forEach((p, i) => {
      const a = easeOut(seg(tb, i * 0.02, i * 0.02 + 0.35));
      const hi = i === HI ? easeOut(seg(tb, 1.0, 1.6)) : 0;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = hi ? C.teal : C.dot;
      ctx.beginPath(); ctx.arc(p[0], p[1], 7 + hi * 9, 0, 7); ctx.fill();
      if (hi) { const ph = ((tb - 1.0) % 1) / 1; ctx.strokeStyle = rgba(C.teal, 0.6 * (1 - ph)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], p[1], 16 + ph * 40, 0, 7); ctx.stroke(); }
      ctx.restore();
    });
    env.anchors.dot = [DOTS[HI][0] + 28, DOTS[HI][1] - 10];
  }
  function pilot_facts(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb, cx = 520, cy = 640, r0 = 140, r1 = 205, sc = easeOut(seg(tb, 0, 0.4));
    for (let i = 0; i < 9; i++) {
      const a0 = (i / 9) * Math.PI * 2 - Math.PI / 2 + 0.035, a1 = ((i + 1) / 9) * Math.PI * 2 - Math.PI / 2 - 0.035;
      const hi = i === 2 && tb > 0.2, pop = hi ? 12 * easeOut(seg(tb, 0.2, 0.5)) : 0, am = (a0 + a1) / 2;
      const ox = Math.cos(am) * pop, oy = Math.sin(am) * pop, R0 = r0 * sc, R1 = r1 * sc;
      ctx.beginPath(); ctx.arc(cx + ox, cy + oy, R1, a0, a1); ctx.arc(cx + ox, cy + oy, R0, a1, a0, true); ctx.closePath();
      ctx.fillStyle = hi ? C.teal5 : 'rgba(203,213,225,.18)'; ctx.fill();
    }
    text(ctx, '九大试点领域', cx, cy + 10, { font: '700 30px NS', align: 'center', alpha: sc });
    text(ctx, '智慧能源', cx + 236, cy - 168, { font: '700 24px NS', color: C.teal, alpha: easeOut(seg(tb, 0.3, 0.6)) });
    drawLine(ctx, [[cx + 120, cy + 175], [cx + 40, cy + 250]], easeOut(seg(tb, 0.25, 0.6)), { width: 2, glow: 0 });
    env.anchors.ring = [cx - 180, cy + 300];
    [0.4, 1.6, 2.8].forEach((t0, i) => {
      const a = easeOut(seg(tb, t0, t0 + 0.4)), y = [448, 588, 728][i];
      text(ctx, String(i + 1), 1000, y + 58, { font: '900 72px NS', color: C.teal, alpha: a });
      if (i) { ctx.save(); ctx.globalAlpha = a * 0.4; ctx.fillStyle = '#ACB6C0'; ctx.fillRect(1000, y - 20, 760, 1); ctx.restore(); }
    });
  }

  // ---------- S05 行业场景 ----------
  function icon(ctx, kind, x, y, s, color, alpha) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (kind === 0) { ctx.arc(x, y + s * 0.15, s * 0.5, Math.PI, 0); ctx.moveTo(x - s * 0.7, y + s * 0.15); ctx.lineTo(x + s * 0.7, y + s * 0.15); ctx.moveTo(x, y - s * 0.35); ctx.lineTo(x, y + s * 0.15); }
    if (kind === 1) { ctx.rect(x - s * 0.45, y - s * 0.55, s * 0.9, s * 1.1); for (let i = 0; i < 3; i++) { const yy = y - s * 0.25 + i * s * 0.3; ctx.moveTo(x - s * 0.28, yy); ctx.lineTo(x - s * 0.18, yy + s * 0.1); ctx.lineTo(x - s * 0.02, yy - s * 0.1); ctx.moveTo(x + s * 0.08, yy); ctx.lineTo(x + s * 0.32, yy); } }
    if (kind === 2) { ctx.arc(x, y - s * 0.1, s * 0.32, 0, 7); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.moveTo(x + Math.cos(a) * s * 0.32, y - s * 0.1 + Math.sin(a) * s * 0.32); ctx.lineTo(x + Math.cos(a) * s * 0.46, y - s * 0.1 + Math.sin(a) * s * 0.46); } ctx.moveTo(x - s * 0.6, y + s * 0.6); for (let i = 0; i <= 12; i++) ctx.lineTo(x - s * 0.6 + i * s * 0.1, y + s * 0.6 + Math.sin(i * 1.6) * s * 0.1); }
    if (kind === 3) { const q = s * 0.55, l = s * 0.22; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { ctx.moveTo(x + a * q, y + b * q - b * l); ctx.lineTo(x + a * q, y + b * q); ctx.lineTo(x + a * q - a * l, y + b * q); }); ctx.moveTo(x - q * 0.8, y); ctx.lineTo(x + q * 0.8, y); }
    if (kind === 4) { ctx.rect(x - s * 0.55, y - s * 0.55, s * 0.5, s * 1.1); ctx.moveTo(x - s * 0.05, y); ctx.lineTo(x + s * 0.6, y); ctx.moveTo(x + s * 0.4, y - s * 0.2); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x + s * 0.4, y + s * 0.2); }
    ctx.stroke(); ctx.restore();
  }
  function scenario_tiles(ctx, P) {
    ctx.drawImage(frozenPlate('S05', 16, 0.62), 0, 0);
    if (THEME.vibrant) { ctx.save(); ctx.globalAlpha = 0.7; bgNavy(ctx); ctx.restore(); }
    const tb = P.tb;
    for (let i = 0; i < 5; i++) {
      const x = 128 + i * 341, y = 320, a = easeOut(seg(tb, 0.1 + 0.4 * i, 0.45 + 0.4 * i)), dy = (1 - a) * 24;
      const pass = easeOut(seg(tb, 3.2 + 0.2 * i, 3.45 + 0.2 * i));
      panel(ctx, x, y + dy, 300, 300, { fill: C.tile, r: 16, alpha: a, glass: THEME.vibrant });
      ctx.save(); ctx.globalAlpha = a; rr(ctx, x, y + dy, 300, 300, 16); ctx.strokeStyle = rgba(C.edge, (THEME.vibrant ? 0.5 : 0.85) * pass); ctx.lineWidth = THEME.vibrant ? 2 : 3; ctx.stroke(); ctx.restore();
      dashRect(ctx, x - 8, y - 8 + dy, 316, 316, { alpha: a * easeOut(seg(tb, 2.0, 2.3)) * (1 - pass) });
      icon(ctx, i, x + 150, y + 150 + dy, 96, pass > 0.5 ? C.teal : 'rgba(255,255,255,.9)', a);
    }
    drawLine(ctx, [[40, 470], [1880, 470]], easeInOut(seg(tb, 3.2, 4.3)), { width: 4, glow: 14 });
  }

  // ---------- S06 三类数据 ----------
  const SLOTS = [128, 704, 1280].map(x => ({ x, y: 300, w: 512, h: 420, r: 14 }));
  const WAVE = cached('wave', () => { const R = rng(7); return Array.from({ length: 64 }, (_, i) => (0.25 + R() * 0.75) * Math.pow(Math.sin((i / 64) * Math.PI), 0.6)); });
  function modality_triptych(ctx, P) {
    bgNavy(ctx);
    const t = P.t;
    SLOTS.forEach((s, i) => {
      const act = t >= i * 2;
      panel(ctx, s.x, s.y, s.w, s.h, { fill: act ? C.navy800 : C.slotOff, r: 14 });
      ctx.save(); rr(ctx, s.x, s.y, s.w, s.h, 14); ctx.strokeStyle = act ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    });
    const s0 = SLOTS[0], s1 = SLOTS[1], s2 = SLOTS[2];
    { // 图像：场站局部，塔顶阀组被矩形框出
      const tbx = bbox(T), fs = 190 / (tbx[2] - tbx[0]), z = fs / (s0.w / hero.width);
      const m = imageInRect(ctx, hero, s0, { zoom: z, focus: [TC[0], TC[1] + (tbx[3] - tbx[1]) * 0.55] });
      const a = m([tbx[0], tbx[1]]), b = m([tbx[2], tbx[3]]), [x, y, w, h] = [a[0] - 12, a[1] - 12, b[0] - a[0] + 24, b[1] - a[1] + 24];
      drawLine(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], easeInOut(seg(t, 0.3, 0.9)), { close: true, width: 3 });
      if (t > 0.9) { panel(ctx, x, y - 40, 120, 34, { fill: C.teal5, r: 4, alpha: easeOut(seg(t, 0.9, 1.1)) }); text(ctx, '塔顶阀组', x + 60, y - 15, { font: '700 20px NS', color: C.navy900, align: 'center', alpha: easeOut(seg(t, 0.9, 1.1)) }); }
      check(ctx, s0.x + s0.w - 50, s0.y + s0.h - 46, 40, easeOut(seg(t, 1.4, 1.7)));
    }
    if (t >= 2) { // 语音
      const ph = seg(t, 2.2, 3.6), x0 = s1.x + 36, wd = s1.w - 72, cy = s1.y + 150;
      WAVE.forEach((v, i) => { const x = x0 + (i / WAVE.length) * wd, hh = v * 110; ctx.fillStyle = i / WAVE.length < ph ? C.teal : 'rgba(255,255,255,.28)'; ctx.fillRect(x, cy - hh / 2, wd / WAVE.length - 3, hh); });
      ctx.fillStyle = '#fff'; ctx.fillRect(x0 + wd * ph, cy - 70, 2, 140);
      const fix = seg(t, 2.8, 3.2), y = s1.y + 320, f = '400 34px NS';
      ctx.save(); ctx.font = f; const w1 = ctx.measureText('二号皮带机 托').width, wc = ctx.measureText('棍').width; ctx.restore();
      const tx = s1.x + 40;
      text(ctx, '二号皮带机 托', tx, y, { font: f });
      if (fix < 0.5) { text(ctx, '棍', tx + w1, y, { font: f, color: C.amber }); if (fix > 0) { ctx.fillStyle = C.amber; ctx.fillRect(tx + w1, y - 12, wc * (fix * 2), 3); } }
      else text(ctx, '辊', tx + w1, y, { font: '700 34px NS', color: C.teal });
      text(ctx, '温度偏高', tx + w1 + wc, y, { font: f });
      text(ctx, '转写校对', tx, s1.y + 380, { font: '400 22px NS', color: C.mutedDark });
      check(ctx, s1.x + s1.w - 50, s1.y + s1.h - 46, 40, easeOut(seg(t, 3.5, 3.8)));
    }
    if (t >= 4) { // 文本
      const f = '400 34px NS', tx = s2.x + 40, l1 = s2.y + 170, l2 = s2.y + 240;
      ctx.save(); ctx.font = f;
      const mw = str => ctx.measureText(str).width;
      const hl = (line, pre, word, y, color, label, t0) => {
        const a = easeOut(seg(t, t0, t0 + 0.3)); if (a <= 0) return;
        const x = tx + mw(pre), w = mw(word);
        ctx.fillStyle = rgba(color, 0.25 * a); ctx.fillRect(x - 4, y - 36, w + 8, 48);
        ctx.fillStyle = rgba(color, a); ctx.fillRect(x - 4, y + 12, w + 8, 3);
        text(ctx, label, x, y - 46, { font: '700 18px NS', color, alpha: a });
      };
      hl(1, '巡检记录：', '2号皮带机托辊', l1, C.teal, '设备', 4.3);
      hl(2, '', '温度偏高', l2, C.amber, '异常', 4.6);
      hl(2, '温度偏高，建议', '停机检查', l2, '#7dd3fc', '处置', 4.9);
      ctx.restore();
      text(ctx, '巡检记录：2号皮带机托辊', tx, l1, { font: f });
      text(ctx, '温度偏高，建议停机检查。', tx, l2, { font: f });
      check(ctx, s2.x + s2.w - 50, s2.y + s2.h - 46, 40, easeOut(seg(t, 5.0, 5.3)));
    }
    const k = easeOut(seg(t, 5.0, 5.6));
    drawLine(ctx, [[s0.x + s0.w, 510], [s1.x, 510]], k); drawLine(ctx, [[s1.x + s1.w, 510], [s2.x, 510]], k);
  }

  // ---------- S07 两种判断 ----------
  function boundary_compare(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb, rect = { x: 128, y: 210, w: 1080, h: 680, r: 14 };
    const fs = 420 / (bbox(EXPANDED)[2] - bbox(EXPANDED)[0]), z = fs / (rect.w / hero.width);
    const m = imageInRect(ctx, hero, rect, { zoom: z, focus: [TC[0] + 20 * HS, TC[1] + 10 * HS] });
    const A = mapPts(m, EXPANDED), B = mapPts(m, PARTIAL);
    ctx.save(); rr(ctx, rect.x, rect.y, rect.w, rect.h, 14); ctx.clip();
    const ha = easeOut(seg(tb, 0.7, 1.0));
    if (ha > 0) { ctx.save(); ctx.beginPath(); A.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); B.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.clip('evenodd'); hatch(ctx, rect.x, rect.y, rect.w, rect.h, '#fff', 14, 0.55 * ha); ctx.restore(); }
    drawLine(ctx, A, easeInOut(seg(tb, 0, 0.45)), { close: true, width: 4 });
    ctx.save(); polyPath(ctx, B); ctx.fillStyle = rgba(C.amber, 0.12 * easeOut(seg(tb, 0.3, 0.7))); ctx.fill(); ctx.restore();
    drawLine(ctx, B, easeInOut(seg(tb, 0.3, 0.75)), { close: true, width: 4, color: C.amber, glow: 6 });
    ctx.restore();
    const ba = bbox(A), bb = bbox(B);
    env.anchors.polygon_a = [ba[2] + 24, ba[1] + 10];
    env.anchors.polygon_b = [bb[0] - 150, bb[3] + 70];
    panel(ctx, 1266, 360, 560, 130, { fill: C.navy800, r: 12, alpha: easeOut(seg(tb, 0, 0.3)) });
    text(ctx, '场景规范片段', 1290, 400, { font: '400 20px NS', color: C.mutedDark, alpha: easeOut(seg(tb, 0, 0.3)) });
  }

  // ---------- S08 规范、复核、流程 ----------
  const docLines = textOf('S08', 'doc').split('｜');
  const typed = (str, k) => str.slice(0, Math.round(str.length * clamp(k)));
  const caseThumb = cached('case', () => {
    const c = scratch(360, 202), g = c.getContext('2d');
    const m = imageInRect(g, hero, { x: 0, y: 0, w: 360, h: 202, r: 0 }, { zoom: 9, focus: TC });
    drawLine(g, mapPts(m, T), 1, { close: true, width: 3, glow: 6 }); return c;
  });
  function paperPage(ctx, x, y, w, h, title) {
    panel(ctx, x, y, w, h, { fill: C.paper, r: 10, shadow: true });
    text(ctx, title, x + 60, y + 80, { font: '700 36px NS', color: C.ink });
    text(ctx, '智数科技 · 场景应用规范', x + 60, y + 120, { font: '400 20px NS', color: C.muted });
    ctx.fillStyle = '#d5dde5'; ctx.fillRect(x + 60, y + 145, w - 120, 2);
    ['3.1 目标类别与命名', '3.2 框定精度要求', '3.3 多目标与重叠'].forEach((s, i) => {
      const yy = y + 200 + i * 125;
      text(ctx, s, x + 60, yy, { font: '700 26px NS', color: C.ink });
      ctx.fillStyle = '#e2e8f0'; rr(ctx, x + 60, yy + 22, w - 160, 14, 7); ctx.fill(); rr(ctx, x + 60, yy + 50, w - 300, 14, 7); ctx.fill();
    });
  }
  function spec_doc(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb, x = 560, y = 70;
    paperPage(ctx, x, y, 800, 940, '场景应用规范 1.3 版');
    const by = y + 590;
    ctx.fillStyle = C.teal5; ctx.fillRect(x + 40, by - 40, 6, 200 * easeOut(seg(tb, 0.1, 0.4)));
    text(ctx, typed(docLines[0] || '', seg(tb, 0.2, 0.6)), x + 60, by, { font: '700 32px NS', color: C.ink });
    text(ctx, typed(docLines[1] || '', seg(tb, 0.7, 1.2)), x + 60, by + 60, { font: '400 30px NS', color: C.ink });
    text(ctx, typed(docLines[2] || '', seg(tb, 1.3, 1.8)), x + 60, by + 110, { font: '400 30px NS', color: C.ink });
    const a = easeOut(seg(tb, 1.6, 2.1));
    ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 16;
    ctx.drawImage(caseThumb, x + 470, by + 150 - (1 - a) * 80, 270, 152); ctx.restore();
    text(ctx, '案例 017', x + 470, by + 330, { font: '700 20px NS', color: C.teal5, alpha: a });
  }
  function recheck_grid(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb, w = 380, h = 214, gap = 24, x0 = (W - (4 * w + 3 * gap)) / 2, y0 = 190, scan = seg(tb, 0.1, 1.3);
    const fixes = [2, 7, 9];
    for (let i = 0; i < 12; i++) {
      const c = i % 4, r = Math.floor(i / 4), x = x0 + c * (w + gap), y = y0 + r * (h + gap);
      ctx.save(); rr(ctx, x, y, w, h, 10); ctx.clip(); ctx.drawImage(samples[i], x, y, w, h); ctx.restore();
      const done = scan > (r + 0.5) / 3;
      if (done) {
        const tDone = 0.1 + 1.2 * ((r + 0.5) / 3), fix = fixes.includes(i), ok = !fix || tb > tDone + 0.3;
        const cx = x + w - 34, cy = y + 34;
        ctx.fillStyle = ok ? C.teal5 : C.amber; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 7); ctx.fill();
        if (ok) check(ctx, cx, cy, 22, 1, '#fff'); else text(ctx, '!', cx, cy + 9, { font: '900 26px NS', align: 'center', color: '#fff' });
        if (fix && !ok) { panel(ctx, x + 12, y + h - 52, 210, 40, { fill: rgba(C.amber, 0.9), r: 6 }); text(ctx, '按 1.3 版修正', x + 117, y + h - 24, { font: '700 20px NS', color: C.navy900, align: 'center' }); }
        if (fix && ok) dashRect(ctx, x + 2, y + 2, w - 4, h - 4, { color: C.edge, dash: [1, 0], width: 3 });
      }
    }
    const sy = y0 + scan * (3 * h + 2 * gap);
    drawLine(ctx, [[x0 - 30, sy], [x0 + 4 * w + 3 * gap + 30, sy]], 1, { width: 3, glow: 16, alpha: scan > 0 && scan < 1 ? 1 : 0 });
  }
  function flow_nodes(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb, words = textOf('S08', 'center').split('→').map(s => s.trim());
    const xs = [520, 960, 1400], y = 430;
    words.forEach((w, i) => {
      const a = easeOut(seg(tb, i * 0.15, i * 0.15 + 0.35));
      panel(ctx, xs[i] - 160, y, 320, 120, { fill: C.navy800, r: 60, alpha: a });
      ctx.save(); ctx.globalAlpha = a; rr(ctx, xs[i] - 160, y, 320, 120, 60); ctx.strokeStyle = rgba(C.edge, THEME.vibrant ? 0.4 : 0.7); ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      text(ctx, w, xs[i], y + 74, { font: '700 40px NS', align: 'center', alpha: a });
    });
    const k = easeOut(seg(tb, 0.2, 0.6));
    drawLine(ctx, [[xs[0] + 160, y + 60], [xs[1] - 160, y + 60]], k); drawLine(ctx, [[xs[1] + 160, y + 60], [xs[2] - 160, y + 60]], k);
    const loop = []; for (let i = 0; i <= 30; i++) { const u = i / 30; loop.push([lerp(xs[2], xs[0], u), y + 120 + Math.sin(u * Math.PI) * 110]); }
    const kl = easeInOut(seg(tb, 0.6, 1.1)); drawLine(ctx, loop, kl);
    if (kl >= 1) drawLine(ctx, [[xs[0] - 14, y + 150], [xs[0], y + 122], [xs[0] + 20, y + 146]], 1, { width: 4 });
  }

  // ---------- S11 场景校验 ----------
  function validate_terminal(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb, x = 180, y = 130, w = 1560, h = 840;
    panel(ctx, x, y, w, h, { fill: C.term, r: 16, shadow: true });
    ['#ef4444', '#f59e0b', '#22c55e'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 34 + i * 26, y + 30, 8, 0, 7); ctx.fill(); });
    text(ctx, '场景校验.py', x + 130, y + 38, { font: '400 22px NS', color: C.mutedDark });
    const code = (shotById.S11.text.find(t => t.style === 'code') || {}).content || '';
    const lines = code.split('\n'), total = code.replace(/\n/g, '').length;
    let budget = Math.round(total * seg(tb, 0, 0.9));
    lines.forEach((ln, i) => {
      const shown = ln.slice(0, Math.max(0, budget)); budget -= ln.length;
      const yy = y + 110 + i * 46; let cx = x + 50;
      const parts = shown.startsWith('#') ? [[shown, C.muted]] : shown.split(/("[^"]*"?|validate|report)/).filter(Boolean).map(p => [p, p.startsWith('"') ? C.amber : /^(validate|report)$/.test(p) ? C.teal : '#cbd5e1']);
      ctx.save(); ctx.font = '400 28px JB, NS';
      parts.forEach(([s, c]) => { ctx.fillStyle = c; ctx.fillText(s, cx, yy); cx += ctx.measureText(s).width; });
      ctx.restore();
    });
    if (tb > 1.0) {
      text(ctx, '▶ 运行场景校验', x + 50, y + 290, { font: '700 26px NS', color: C.teal });
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x + 50, y + 320, w - 100, 10);
      ctx.fillStyle = C.teal; ctx.fillRect(x + 50, y + 320, (w - 100) * seg(tb, 1.0, 1.8), 10);
      text(ctx, `校验中　${Math.round(12 * seg(tb, 1.0, 1.8))} / 12 个场景`, x + w - 50, y + 290, { font: '400 22px NS', color: C.mutedDark, align: 'right' });
    }
    const rows = [['反光', '通过'], ['夜间弱光', '通过'], ['雨雾', '通过'], ['积尘', '通过'], ['蒸汽遮挡', null]];
    rows.forEach(([name, res], i) => {
      const a = easeOut(seg(tb, 1.2 + i * 0.12, 1.4 + i * 0.12)), yy = y + 400 + i * 78;
      if (a <= 0) return;
      if (!res) panel(ctx, x + 40, yy - 44, w - 80, 66, { fill: rgba(C.amber, 0.14), r: 8, alpha: a });
      text(ctx, name, x + 70, yy, { font: '400 28px NS', color: res ? '#94a3b8' : C.amber, alpha: a });
      if (res) text(ctx, res, x + 420, yy, { font: '400 28px NS', color: '#64748b', alpha: a });
      else {
        text(ctx, (shotById.S11.text.find(t => t.zone === 'editor' && t.style !== 'code') || {}).content || '', x + 420, yy, { font: '700 30px NS', color: C.amber, alpha: a });
        panel(ctx, x + w - 220, yy - 34, 150, 44, { fill: C.amber, r: 22, alpha: a }); text(ctx, '待复核', x + w - 145, yy - 3, { font: '700 22px NS', color: C.navy900, align: 'center', alpha: a });
      }
    });
  }

  // ---------- S12 白板与实验记录 ----------
  const wob = (pts, seed) => { const R = rng(seed); return pts.map(p => [p[0] + (R() - 0.5) * 5, p[1] + (R() - 0.5) * 5]); };
  function board(ctx) {
    ctx.fillStyle = '#eef1f3'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(0,0,0,.06)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const R = rng(5); ctx.fillStyle = 'rgba(15,43,70,.035)'; for (let i = 0; i < 900; i++) ctx.fillRect(R() * W, R() * H, 2, 2);
  }
  function whiteboard_flow(ctx, P, final = false) {
    board(ctx);
    const tb = final ? 9 : P.tb, words = textOf('S12', 'board').split('→').map(s => s.trim());
    const bx = i => 230 + i * 390, by = 360, bw = 250, bh = 140;
    words.forEach((w, i) => {
      const k = easeOut(seg(tb, i * 0.42, i * 0.42 + 0.3)), x = bx(i), color = i === 3 ? '#14B8A6' : C.ink;
      drawLine(ctx, wob([[x, by], [x + bw, by], [x + bw, by + bh], [x, by + bh], [x, by + 3]], i + 1), k, { color, width: 6, glow: 0 });
      text(ctx, w, x + bw / 2, by + 92, { font: '64px LC', color: C.ink, align: 'center', alpha: easeOut(seg(tb, i * 0.42 + 0.2, i * 0.42 + 0.4)) });
      if (i < 3) { const ka = easeOut(seg(tb, i * 0.42 + 0.3, i * 0.42 + 0.42)), ax = x + bw + 20; drawLine(ctx, wob([[ax, by + 70], [ax + 100, by + 70]], 9 + i), ka, { color: C.ink, width: 6, glow: 0 }); if (ka >= 1) drawLine(ctx, [[ax + 82, by + 54], [ax + 100, by + 70], [ax + 82, by + 86]], 1, { color: C.ink, width: 6, glow: 0 }); }
    });
    const loop = []; for (let i = 0; i <= 30; i++) { const u = i / 30; loop.push([lerp(bx(3) + bw / 2, bx(0) + bw / 2, u), by + bh + 20 + Math.sin(u * Math.PI) * 150]); }
    const kl = easeInOut(seg(tb, 1.6, 2.15)); drawLine(ctx, wob(loop, 31), kl, { color: '#14B8A6', width: 6, glow: 0 });
    if (kl >= 1) drawLine(ctx, [[bx(0) + bw / 2 - 18, by + bh + 46], [bx(0) + bw / 2, by + bh + 22], [bx(0) + bw / 2 + 22, by + bh + 42]], 1, { color: '#14B8A6', width: 6, glow: 0 });
  }
  function experiment_log(ctx, P) {
    whiteboard_flow(ctx, P, true);
    ctx.fillStyle = 'rgba(238,241,243,.55)'; ctx.fillRect(0, 0, W, H);
    const k = easeOut(seg(P.tb, 0, 0.5)), x = lerp(1960, 1020, k), y = 600;
    panel(ctx, x, y, 780, 330, { fill: '#fff', r: 16, shadow: true });
    text(ctx, '实验记录', x + 44, y + 64, { font: '700 30px NS', color: C.ink });
    text(ctx, textOf('S12', 'card'), x + 44, y + 130, { font: '400 32px NS', color: C.ink });
    ['通用模型', '适配后模型'].forEach((s, i) => {
      const bx = x + 44 + i * 350; rr(ctx, bx, y + 170, 320, 110, 10); ctx.strokeStyle = i && !THEME.vibrant ? C.teal5 : '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, s, bx + 24, y + 214, { font: '700 24px NS', color: i ? C.teal5 : C.muted });
      text(ctx, '同一组对照场景', bx + 24, y + 254, { font: '400 20px NS', color: C.muted });
    });
  }

  // ---------- S13 三联对比 ----------
  function layer_compare(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb, labels = textOf('S13', 'panels').split('｜'), fade = 1 - easeOut(seg(tb, 3.2, 3.6));
    const z = 0.62 / (512 / W), focus = [(GC[0] + TC[0]) / 2, (GC[1] + TC[1]) / 2];
    SLOTS.forEach((s, i) => {
      const a = easeOut(seg(tb, i * 0.2, i * 0.2 + 0.4)) * fade;
      ctx.save(); ctx.globalAlpha = a;
      const m = imageInRect(ctx, hero, s, { zoom: z, focus });
      ctx.save(); rr(ctx, s.x, s.y, s.w, s.h, 14); ctx.clip();
      if (i === 0) { const [x, y, w, h] = glareRect(m); dashRect(ctx, x, y, w, h, { width: 3 }); text(ctx, '异常？', x, y - 10, { font: '700 20px NS', color: C.amber }); }
      else drawLine(ctx, mapPts(m, T), 1, { close: true, width: 3, glow: 8 });
      ctx.restore();
      if (i === 2) check(ctx, s.x + s.w - 54, s.y + s.h - 50, 46, easeOut(seg(tb, 1.6, 1.9)));
      ctx.restore();
      text(ctx, labels[i] || '', s.x, s.y - 26, { font: '700 26px NS', color: i === 0 ? C.amber : C.teal, alpha: a });
    });
    drawLine(ctx, [[128, 780], [1792, 780]], easeInOut(seg(tb, 0.6, 2.4)) , { alpha: fade });
  }

  // ---------- S14 打印规范与便签 ----------
  function paper_spec_insert(ctx, P) {
    ctx.fillStyle = '#cfc6b8'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(960, 540); ctx.rotate(-0.025); ctx.translate(-960, -540);
    panel(ctx, 170, 40, 1580, 1000, { fill: '#fbfaf7', r: 6, shadow: true });
    text(ctx, '场景应用规范 1.3 版 · 第 3 章', 260, 230, { font: '400 28px NS', color: C.muted });
    for (let i = 0; i < 2; i++) { ctx.fillStyle = '#e7e2d8'; rr(ctx, 260, 280 + i * 56, 1200 - i * 160, 18, 9); ctx.fill(); }
    const hk = easeOut(seg(P.tb, 0.2, 0.9));
    ctx.fillStyle = 'rgba(250,204,21,.38)'; ctx.fillRect(250, 520, 720 * hk, 64);
    text(ctx, docLines[0] || '', 260, 470, { font: '700 56px NS', color: C.ink });
    text(ctx, docLines[1] || '', 260, 570, { font: '400 46px NS', color: C.ink });
    text(ctx, docLines[2] || '', 260, 650, { font: '400 46px NS', color: C.ink });
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#e7e2d8'; rr(ctx, 260, 760 + i * 56, 1100 - i * 220, 18, 9); ctx.fill(); }
    ctx.restore();
    const a = easeOut(seg(P.tb, 0.8, 1.15)), x = 1180, y = 520 - (1 - a) * 60;
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x + 210, y + 150); ctx.rotate(0.05); ctx.translate(-(x + 210), -(y + 150));
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12; ctx.fillStyle = '#fde68a'; ctx.fillRect(x, y, 420, 300); ctx.shadowColor = 'transparent';
      wrap(ctx, textOf('S14', 'sticky'), x + 36, y + 110, 350, 76, { font: '60px LC', color: '#3b2f0b' });
      ctx.restore();
    }
  }

  // ---------- S15 任务板 ----------
  function task_board(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb, cols = ['待办', '进行中', '验证'], xs = [200, 760, 1320], tasks = textOf('S15', 'board').split('｜');
    xs.forEach((x, i) => { panel(ctx, x, 300, 400, 640, { fill: 'rgba(255,255,255,.035)', r: 14 }); text(ctx, cols[i], x + 30, 350, { font: '700 28px NS', color: C.mutedDark }); ctx.fillStyle = rgba(C.teal, 0.4); ctx.fillRect(x + 30, 368, 60, 3); });
    const pa = easeOut(seg(tb, 0, 0.3));
    panel(ctx, 660, 120, 600, 120, { fill: C.navy800, r: 14, alpha: pa });
    ctx.save(); ctx.globalAlpha = pa; rr(ctx, 660, 120, 600, 120, 14); ctx.strokeStyle = rgba(C.edge, THEME.vibrant ? 0.4 : 1); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    text(ctx, '研究问题', 690, 160, { font: '400 20px NS', color: C.teal, alpha: pa });
    text(ctx, '薄蒸汽遮挡下为何漏检', 690, 210, { font: '700 34px NS', alpha: pa });
    tasks.forEach((s, i) => {
      const k = easeInOut(seg(tb, 0.4 + 0.35 * i, 1.0 + 0.35 * i)), a = easeOut(seg(tb, 0.35 + 0.35 * i, 0.55 + 0.35 * i));
      const x = lerp(780, xs[i] + 20, k), y = lerp(150, 410, k);
      drawLine(ctx, [[960, 240], [x + 180, y]], 1, { width: 2, glow: 0, alpha: a * 0.6 });
      panel(ctx, x, y, 360, 110, { fill: C.card2, r: 12, alpha: a });
      text(ctx, s, x + 28, y + 66, { font: '700 30px NS', alpha: a });
      if (i === 2 && k >= 1) check(ctx, x + 320, y + 55, 28, easeOut(seg(tb, 1.9, 2.2)));
    });
  }

  // ---------- S16 交付物 ----------
  const CARDS = [128, 558, 988, 1418];
  function cardVisual(ctx, i, x, y, w, h) {
    if (i === 0) for (let k = 0; k < 6; k++) ctx.drawImage(samples[k], x + (k % 3) * (w / 3), y + Math.floor(k / 3) * (h / 2), w / 3 - 6, h / 2 - 6);
    if (i === 1) ctx.drawImage(plantMini, x, y, w, h);
    if (i === 2) { ctx.fillStyle = C.term; ctx.fillRect(x, y, w, h); [[C.muted, 0.6], [C.teal, 0.8], ['#cbd5e1', 0.5], [C.amber, 0.4], ['#cbd5e1', 0.7]].forEach(([c, l], k) => { ctx.fillStyle = c; ctx.fillRect(x + 16, y + 20 + k * 34, (w - 32) * l, 12); }); }
    if (i === 3) { ctx.fillStyle = C.paper; ctx.fillRect(x + 40, y, w - 80, h); ctx.fillStyle = '#e2e8f0'; for (let k = 0; k < 4; k++) ctx.fillRect(x + 60, y + 20 + k * 22, w - 140 - k * 20, 8); ctx.drawImage(caseThumb, x + 70, y + 110, 170, 80); }
  }
  function deliverables(ctx, P) {
    bgNavy(ctx);
    const t = P.t, fly = easeInOut(seg(t, 4.2, 5.0));
    const titles = [1, 2, 3, 4].map(i => textOf('S16', `card_${i}`));
    if (fly > 0) {
      const fa = easeOut(seg(t, 4.2, 4.6));
      panel(ctx, 620, 210, 680, 520, { fill: C.navy800, r: 16, alpha: fa });
      ctx.save(); ctx.globalAlpha = fa; ctx.fillStyle = C.teal; rr(ctx, 662, 248, 22, 12, 3); ctx.fill(); rr(ctx, 660, 254, 44, 32, 4); ctx.fill(); ctx.restore(); text(ctx, '项目归档', 720, 280, { font: '700 32px NS', alpha: fa });
      titles.forEach((s, i) => { const a = easeOut(seg(t, 4.6 + i * 0.1, 4.9 + i * 0.1)); text(ctx, `├─ ${s}`, 680, 360 + i * 82, { font: '400 28px NS', color: '#E2E8F0', alpha: a }); check(ctx, 1240, 350 + i * 82, 24, a); });
    }
    CARDS.forEach((x0, i) => {
      const a = easeOut(seg(t, 0.2 + 0.8 * i, 0.55 + 0.8 * i)), y0 = 300 + (1 - a) * 30;
      const x = lerp(x0, 680, fly), y = lerp(y0, 350 + i * 82, fly), s = lerp(1, 0.12, fly);
      ctx.save(); ctx.globalAlpha = a * (1 - fly); ctx.translate(x, y); ctx.scale(s, s);
      panel(ctx, 0, 0, 380, 330, { fill: C.navy800, r: 14 }); ctx.fillStyle = rgba(C.edge, THEME.vibrant ? 0.5 : 1); ctx.fillRect(0, 0, 380, 4);
      text(ctx, titles[i], 24, 52, { font: '700 26px NS' });
      ctx.save(); rr(ctx, 20, 80, 340, 220, 8); ctx.clip(); cardVisual(ctx, i, 20, 80, 340, 220); ctx.restore();
      ctx.restore();
    });
  }

  // ---------- S17 成长通道 ----------
  function growth_path(ctx, P) {
    bgNavy(ctx);
    const tb = P.tb, ys = [330, 470, 610];
    ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(200, 470, 12 * easeOut(seg(tb, 0, 0.2)), 0, 7); ctx.fill();
    text(ctx, '项目组上手', 160, 530, { font: '400 22px NS', color: C.mutedDark, alpha: easeOut(seg(tb, 0, 0.3)) });
    drawLine(ctx, [[200, 470], [900, 470]], easeInOut(seg(tb, 0.1, 0.6)));
    ys.forEach((y, i) => {
      const k = easeInOut(seg(tb, 0.5 + 0.3 * i, 1.0 + 0.3 * i));
      drawLine(ctx, [[900, 470], [1010, y], [1120, y]], k);
      if (k >= 1) { ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(1120, y, 10, 0, 7); ctx.fill(); }
    });
    ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(200, 800, 12 * easeOut(seg(tb, 2.3, 2.5)), 0, 7); ctx.fill();
    drawLine(ctx, [[200, 800], [1700, 800]], easeInOut(seg(tb, 2.4, 3.2)));
    if (tb > 3.2) { ctx.strokeStyle = C.teal; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(1700, 800, 16, 0, 7); ctx.stroke(); ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(1700, 800, 8, 0, 7); ctx.fill(); }
  }

  // ---------- S18 招聘总数 ----------
  const thumbs = {
    triptych: () => cached('th-tri', () => { const c = scratch(); modality_triptych(c.getContext('2d'), { t: 5.9, tb: 1.9 }); return c; }),
    terminal: () => cached('th-term', () => { const c = scratch(); validate_terminal(c.getContext('2d'), { tb: 2.6 }); return c; }),
    board: () => cached('th-board', () => { const c = scratch(); whiteboard_flow(c.getContext('2d'), { tb: 2.2 }); return c; }),
    task: () => cached('th-task', () => { const c = scratch(); task_board(c.getContext('2d'), { tb: 3 }); return c; }),
    cloud: tb => { const c = cached('th-cloud', () => scratch()), g = c.getContext('2d'); bgNavy(g, { dots: false }); drawPlant(g, S3.thumb.pointcloud(tb)); return c; },
    multi: tb => { const c = cached('th-multi', () => scratch()), g = c.getContext('2d'); bgNavy(g, { dots: false }); if (THEME.vibrant) S3.thumb.views.forEach(v => panel(g, v[0], v[1], v[2], v[3], { r: 8 })); drawPlant(g, S3.thumb.multi(tb)); return c; },
  };
  const TILES = [[80, 70], [980, 70], [80, 560], [980, 560]];
  function drawGrid(ctx, a = 1, labels = null) {
    const imgs = [thumbs.triptych(), cached('th-cloud-static', () => { const c = scratch(); c.getContext('2d').drawImage(thumbs.cloud(1.6), 0, 0); return c; }), thumbs.terminal(), thumbs.board()];
    TILES.forEach(([x, y], i) => {
      ctx.save(); ctx.globalAlpha = a; rr(ctx, x, y, 860, 450, 14); ctx.clip(); ctx.drawImage(imgs[i], x, y - 9, 860, 484);
      if (labels) { const g = ctx.createLinearGradient(0, y + 330, 0, y + 450); g.addColorStop(0, 'rgba(6,32,69,0)'); g.addColorStop(1, 'rgba(6,32,69,.9)'); ctx.fillStyle = g; ctx.fillRect(x, y + 330, 860, 120); }
      ctx.restore();
      if (labels) text(ctx, labels[i], x + 30, y + 420, { font: '700 30px NS', color: C.teal, alpha: a });
    });
  }
  function role_grid(ctx, P) {
    bgNavy(ctx, { dots: false });
    drawGrid(ctx, easeOut(seg(P.tb, 0, 0.5)), textOf('S18', 'grid').split('｜'));
  }
  function recruit_total(ctx, P) {
    const tb = P.tb, k = easeOut(seg(tb, 0, 0.35)), y = lerp(1100, 140, k);
    // 动感主题：上一镜的缩略图随卡片升起淡出，再叠一层半透明动态背景压到后面，避免浅色流程卡从玻璃卡边缘透出
    bgNavy(ctx, { dots: false }); drawGrid(ctx, THEME.vibrant ? 0.35 * (1 - k) : 0.35);
    if (THEME.vibrant) { ctx.save(); ctx.globalAlpha = 0.65; bgNavy(ctx, { dots: false }); ctx.restore(); }
    const V = THEME.vibrant, ink = V ? '#fff' : C.ink, sub = V ? C.mutedDark : C.muted;
    if (V) { rr(ctx, 160, y, 1600, 800, 24); ctx.fillStyle = 'rgba(4,22,86,.82)'; ctx.fill(); }
    panel(ctx, 160, y, 1600, 800, V ? { r: 24 } : { fill: C.paper, r: 24, shadow: true });
    if (k < 1) return;
    const n = Math.round(58 * easeOut(seg(tb, 0.2, 1.4)));
    ctx.save(); ctx.font = '900 220px NS'; const nw = ctx.measureText(String(n)).width; ctx.restore();
    text(ctx, String(n), 250, 520, { font: '900 220px NS', color: ink });
    text(ctx, '人', 262 + nw, 520, { font: '700 72px NS', color: sub });
    const ba = easeOut(seg(tb, 1.5, 2.0));
    text(ctx, '学历结构', 1000, 330, { font: '400 24px NS', color: sub, alpha: ba });
    [['本科', 50, V ? '#6E9BFF' : C.ink], ['硕士', 5, V ? C.teal : C.teal5], ['博士', 3, V ? C.amber : C.amber7]].forEach(([s, v, c], i) => {
      const yy = 390 + i * 90;
      text(ctx, s, 1000, yy + 30, { font: '700 28px NS', color: ink, alpha: ba });
      ctx.save(); ctx.globalAlpha = ba; ctx.fillStyle = c; rr(ctx, 1090, yy + 4, Math.max(24, 560 * (v / 50)) * ba, 34, 6); ctx.fill(); ctx.restore();
      text(ctx, String(v), 1090 + Math.max(24, 560 * (v / 50)) + 18, yy + 32, { font: '900 30px NS', color: c, alpha: ba });
    });
  }

  // ---------- S19–S21 岗位卡 ----------
  function job_card_pair(ctx, P) {
    bgNavy(ctx);
    const t = P.t, k = easeOut(seg(t, 0, 0.8));
    [[128, thumbs.triptych(), true], [992, thumbs.cloud(1.2 + t * 0.28), false]].forEach(([x, img, pan], i) => {
      const y = 170 + (1 - k) * 60;
      ctx.save(); ctx.globalAlpha = k;
      panel(ctx, x, y, 800, 860, { fill: C.navy800, r: 18 });
      rr(ctx, x + 20, y + 20, 760, 420, 12); ctx.clip();
      const sw = 760 * 1.25, sh = sw * 9 / 16, ox = pan ? -lerp(0, sw - 760, t / 7) : (760 - sw) / 2;
      ctx.drawImage(img, x + 20 + ox, y + 20 + (420 - sh) / 2, sw, sh);
      ctx.fillStyle = 'rgba(6,32,69,.35)'; ctx.fillRect(x + 20, y + 20, 760, 420);
      ctx.restore();
    });
  }
  function job_card(ctx, P) {
    bgNavy(ctx);
    const t = P.t, k = easeOut(seg(t, 0, 0.8));
    const pair = P.shot.id === 'S20' ? [thumbs.terminal(), thumbs.board()] : [thumbs.task(), thumbs.multi(2)];
    const s = lerp(1, 1.05, t / 7), mix = easeInOut(seg(t, 3.3, 3.8));
    [[pair[0], 1 - mix], [pair[1], mix]].forEach(([img, a]) => {
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(1344, 540); ctx.scale(s, s); ctx.drawImage(img, -576 - 96, -324 - 54, 1344, 756); ctx.restore();
    });
    ctx.fillStyle = 'rgba(6,32,69,.25)'; ctx.fillRect(768, 0, 1152, H);
    ctx.save(); ctx.translate(-(1 - k) * 200, 0);
    ctx.fillStyle = C.side; ctx.fillRect(0, 0, 768, H); ctx.fillStyle = rgba(C.edge, THEME.vibrant ? 0.25 : 0.6); ctx.fillRect(766, 0, 3, H);
    ctx.restore();
  }

  // ---------- S22 招聘流程 ----------
  function apply_flow(ctx, P) {
    bgNavy(ctx);
    const t = P.t, steps = textOf('S22', 'timeline').split('→').map(s => s.trim()), xs = steps.map((_, i) => 200 + i * 380);
    drawLine(ctx, [[200, 470], [1720, 470]], easeInOut(seg(t, 0, 1.0)), { width: 4 });
    steps.forEach((s, i) => {
      const a = easeOut(seg(t, 1.0 + 0.25 * i, 1.25 + 0.25 * i)), last = i === steps.length - 1;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = last ? C.teal : C.navy800; ctx.strokeStyle = rgba(C.edge, THEME.vibrant ? 0.6 : 1); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(xs[i], 470, 20, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
      text(ctx, String(i + 1).padStart(2, '0'), xs[i], 425, { font: '700 22px JB', color: C.mutedDark, align: 'center', alpha: a });
      text(ctx, s, xs[i], 548, { font: '700 32px NS', color: last ? C.teal : '#fff', align: 'center', alpha: a });
    });
  }

  // ---------- S23 结尾标语 ----------
  // 年份数字滚动落定并扩散光环，标语逐字浮现；光点从四周汇聚成关键词下方的光线，最后光线向右延伸，带入片尾同一高度的线
  const SPARKS = cached('sparks', () => { const R = rng(23); return Array.from({ length: 140 }, () => ({ a: R() * 6.283, r: 650 + R() * 650, u: R(), d: R(), s: 1.4 + R() * 2.2, bend: (R() - 0.5) * 160 })); });
  const ROLL = cached('roll', () => { const R = rng(2027); return Array.from({ length: 4 }, () => Array.from({ length: 9 }, () => Math.floor(R() * 10))); });
  function slogan_finale(ctx, P) {
    const tb = P.tb, X0 = 128, Y1 = 446, Y2 = 572, LY = 610, NF = 250;
    const full = textOf('S23', 'center-left').replace(/[。！]$/, ''), cut = full.indexOf('，');
    const head = cut < 0 ? '' : full.slice(0, cut), rest = cut < 0 ? full : full.slice(cut + 1);
    const [, num = '', suffix = head] = head.match(/^(\d+)(.*)$/) || [];
    bgNavy(ctx);
    // 标题背后缓慢呼吸的柔光，与入场时从左侧扩散的闪光
    const glow = ctx.createRadialGradient(560, 480, 0, 560, 480, 950);
    glow.addColorStop(0, rgba(C.electric, 0.22 + 0.05 * Math.sin(tb * 2.4))); glow.addColorStop(1, rgba(C.electric, 0));
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    const fl = 1 - easeOut(seg(tb, 0, 0.45));
    if (fl > 0) {
      const g = ctx.createRadialGradient(360, 470, 0, 360, 470, 1150);
      g.addColorStop(0, `rgba(220,240,255,${(0.55 * fl).toFixed(3)})`); g.addColorStop(1, 'rgba(220,240,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // 文字与光线整体极慢推近
    ctx.save(); const z = lerp(1, 1.03, easeInOut(seg(tb, 0, P.bd))); ctx.translate(X0, 520); ctx.scale(z, z); ctx.translate(-X0, -520);

    // 年份：每位数字从一列随机数字滚动落定，依次停下
    ctx.font = `900 ${NF}px NS`;
    const widths = [...num].map(d => ctx.measureText(d).width), numW = widths.reduce((a, b) => a + b, 0), LH = NF * 1.1;
    // 数字先画在离屏画布上，再用上下渐隐的遮罩裁出计数器窗口，滚动中的数字在窗口边缘柔和消失
    const top = Y1 - NF, wh = Math.ceil(NF * 1.18), win = cached('roll-win', () => { const c = document.createElement('canvas'); c.width = W; c.height = wh; return c; });
    const g2 = win.getContext('2d'); g2.clearRect(0, 0, win.width, win.height);
    let x = X0;
    [...num].forEach((d, i) => {
      const seq = [...ROLL[i].slice(0, 8), Number(d)], n = seq.length - 1, p = easeOut(seg(tb, 0.02, 0.38 + i * 0.12));
      seq.forEach((v, j) => {
        const y = Y1 + (j - n) * LH + (1 - p) * n * LH;
        if (Math.abs(y - Y1) < LH) text(g2, String(v), x + widths[i] / 2, y - top, { font: `900 ${NF}px NS`, align: 'center' });
      });
      x += widths[i];
    });
    g2.save(); g2.globalCompositeOperation = 'destination-in';
    const mask = g2.createLinearGradient(0, 0, 0, wh);
    mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(0.2, '#000'); mask.addColorStop(0.86, '#000'); mask.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = mask; g2.fillRect(0, 0, win.width, wh); g2.restore();
    ctx.save(); ctx.globalAlpha = easeOut(seg(tb, 0, 0.2)); ctx.drawImage(win, 0, top); ctx.restore();
    const ka = easeOut(seg(tb, 0.72, 1.02));
    text(ctx, suffix, X0 + numW + 20, Y1 + (1 - ka) * 20, { font: '700 112px NS', alpha: ka });
    // 数字落定时扩散的两圈光环
    [0.2, 0.8].forEach(t0 => {
      const ph = seg(tb, t0, t0 + 1.2);
      if (ph <= 0 || ph >= 1) return;
      ctx.save(); ctx.strokeStyle = rgba(C.teal, 0.4 * (1 - ph)); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X0 + numW / 2, Y1 - NF * 0.36, 80 + easeOut(ph) * 600, 0, 7); ctx.stroke(); ctx.restore();
    });

    // 标语：逐字上浮，由虚到实
    ctx.font = '700 84px NS';
    const chars = [...rest], xs = [];
    let acc = 0;
    chars.forEach(ch => { xs.push(X0 + acc); acc += ctx.measureText(ch).width; });
    chars.forEach((ch, j) => {
      const s = 0.55 + j * 0.03, k = easeOut(seg(tb, s, s + 0.35));
      if (k <= 0) return;
      ctx.save(); ctx.filter = k < 1 ? `blur(${((1 - k) * 8).toFixed(1)}px)` : 'none';
      text(ctx, ch, xs[j], Y2 + (1 - k) * 26, { font: '700 84px NS', alpha: k });
      ctx.restore();
    });

    // 关键词“定义……标准”下方的光线：光点从四周汇聚，按从左到右的顺序落到线上
    const i0 = rest.indexOf('定义'), i1 = rest.lastIndexOf('标准');
    const kx0 = i0 < 0 ? X0 : xs[i0], kx1 = i1 < 0 ? X0 + acc : (xs[i1 + 2] ?? X0 + acc);
    const cx = (kx0 + kx1) / 2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    SPARKS.forEach(s => {
      const tx = lerp(kx0, kx1, s.u), arrive = 1.15 + s.u * 0.55, start = arrive - 0.75 - s.d * 0.35;
      const p = seg(tb, start, arrive);
      if (p <= 0) return;
      if (p >= 1) { // 落到线上后的一闪
        const f = 1 - seg(tb, arrive, arrive + 0.18);
        if (f > 0) { ctx.fillStyle = `rgba(230,245,255,${(0.7 * f).toFixed(3)})`; ctx.beginPath(); ctx.arc(tx, LY, s.s * 1.6, 0, 7); ctx.fill(); }
        return;
      }
      const pos = q => { const e = easeInOut(q), sx = cx + Math.cos(s.a) * s.r, sy = LY + Math.sin(s.a) * s.r * 0.6;
        return [lerp(sx, tx, e) + Math.sin(e * Math.PI) * s.bend, lerp(sy, LY, e) - Math.sin(e * Math.PI) * s.bend * 0.4]; };
      const [px, py] = pos(p), [qx, qy] = pos(Math.max(0, p - 0.08)), a = Math.min(1, p * 3);
      ctx.strokeStyle = `rgba(160,220,255,${(0.35 * a).toFixed(3)})`; ctx.lineWidth = s.s * 0.8;
      ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = `rgba(235,248,255,${(0.9 * a).toFixed(3)})`; ctx.beginPath(); ctx.arc(px, py, s.s, 0, 7); ctx.fill();
    });
    ctx.restore();
    drawLine(ctx, [[kx0, LY], [kx1, LY]], easeInOut(seg(tb, 1.15, 1.7)), { width: 4, glow: 12 });
    // 结尾：光线向右延伸出画，接片尾同一高度的线
    drawLine(ctx, [[kx1, LY], [W + 40, LY]], easeInOut(seg(tb, 2.0, 2.55)), { width: 4, glow: 12, flow: false });
    ctx.restore();
  }

  // ---------- S24 片尾 ----------
  const NET = cached('net', () => { const R = rng(77); return Array.from({ length: 70 }, () => [1100 + R() * 820, 600 + R() * 480, R() * 6.28]); });
  function end_card(ctx, P) {
    bgNavy(ctx, { top: C.navy900, bottom: '#04182f', dots: false });
    const t = P.t, pts = NET.map(([x, y, ph]) => [x + Math.sin(t * 0.4 + ph) * 8, y + Math.cos(t * 0.35 + ph) * 6]);
    ctx.save(); ctx.strokeStyle = rgba(C.teal, 0.12); ctx.lineWidth = 1;
    pts.forEach((a, i) => pts.forEach((b, j) => { if (j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < 120) { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); } }));
    ctx.fillStyle = rgba(C.teal, 0.45); pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fill(); });
    ctx.restore();
    drawLine(ctx, [[0, 610], [1060, 610]], easeInOut(seg(t, 0, 0.8)), { width: 4, glow: 12 });
    drawLine(ctx, [[1200, 320], [1200, 780]], easeInOut(seg(t, 0.4, 0.8)), { width: 2, glow: 0, color: rgba(C.teal, 0.5) });
    const a = easeOut(seg(t, 0.5, 0.9));
    if (env.qr) qrCard(ctx, env.qr, 1300, 330, 300, t);
    else {
      dashRect(ctx, 1300, 330, 300, 300, { color: rgba(C.edge, THEME.vibrant ? 0.6 : 1), width: 2, alpha: a, dash: [10, 8] });
      text(ctx, '投递二维码', 1450, 488, { font: '700 28px NS', color: C.mutedDark, align: 'center', alpha: a });
    }
  }
  // 投递二维码：白色圆角卡片升起，模块按对角线逐格显现；模块按整数像素绘制，静止后边缘清晰、便于扫码
  function qrCard(ctx, qr, x, y, size, t) {
    const k = easeOut(seg(t, 0.5, 0.9)), n = qr.size, m = Math.floor((size - 56) / n), x0 = Math.round(x + (size - n * m) / 2), y0 = Math.round(y + (size - n * m) / 2);
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = k;
    const s = lerp(0.94, 1, k); ctx.translate(x + size / 2, y + size / 2 + (1 - k) * 16); ctx.scale(s, s); ctx.translate(-(x + size / 2), -(y + size / 2));
    ctx.shadowColor = 'rgba(0,4,30,.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    rr(ctx, x, y, size, size, 16); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.shadowColor = 'transparent';
    const wave = seg(t, 0.6, 1.2) * 1.15;
    ctx.fillStyle = '#0A1A40';
    qr.modules.forEach((row, r) => {
      for (let c = 0; c < n; c++) {
        if (row[c] !== '1') continue;
        const d = (r + c) / (2 * n - 2), va = clamp((wave - d) / 0.15);
        if (va <= 0) continue;
        ctx.globalAlpha = k * va; ctx.fillRect(x0 + c * m, y0 + r * m, m, m);
      }
    });
    ctx.restore();
  }

  function missing(ctx, P) { bgNavy(ctx); text(ctx, `缺少场景：${P.scene}`, 960, 540, { font: '700 48px NS', color: C.amber, align: 'center' }); }

  return {
    plate, still_reveal, scene_workbench, brand_card, pilot_cities, pilot_facts, scenario_tiles,
    modality_triptych, boundary_compare, spec_doc, recheck_grid, flow_nodes, validate_terminal,
    whiteboard_flow: (ctx, P) => whiteboard_flow(ctx, P), experiment_log, layer_compare, paper_spec_insert, task_board,
    deliverables, growth_path, role_grid, recruit_total, job_card_pair, job_card, apply_flow, slogan_finale, end_card, missing,
  };
}
