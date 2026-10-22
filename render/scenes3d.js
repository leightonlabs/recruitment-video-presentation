// 三维场景：数字孪生能源场站。片头扫描显现与设备识别、主图化为三维、环绕框定、场景由近及远生长、三视图。
// 场站画面由 env.plant（facility.js）渲染到离屏画布，再以“加亮”方式合成到主画布。
import { FACILITY } from './facility.js';
import { C, THEME, seg, clamp, lerp, easeOut, easeInOut, panel, text, drawLine, nodes, dashRect, bgNavy, rgba } from './draw.js';
import { night, vignette, drawPlant, horizonOf, heroCamera, targetPolygon, HERO_T, HERO_STEAM_T } from './plant.js';

export async function makeScenes3D(env) {
  const W = 1920, H = 1080, F = env.plant, THREE = F.THREE;
  const TB = FACILITY.targetBox, TC3 = FACILITY.target;
  const ACC = C.teal, AMBER = C.amber;
  const corners = ([a, b]) => { const p = []; for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) p.push([x, y, z]); return p; };
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const backdrop = (ctx, t) => { night(ctx, t, horizonOf(F)); };

  // ---------- S01 片头 ----------
  // 识别光波：各设备按从左到右的顺序依次点亮再回落
  const UNIT_ORDER = [11, 1, 2, 9, 10, 3, 4, 5, 12, 6, 8, 7];
  const unitWave = tb => { const u = []; UNIT_ORDER.forEach((id, i) => { const p = seg(tb, i * 0.05, i * 0.05 + 0.5); u[id] = Math.sin(Math.PI * p) * 0.9; }); return u; };
  function plant_reveal(ctx, P) { // 0–3 秒：扫描光面从左到右扫过，场站由光点显现，镜头缓推
    const t = P.t;
    heroCamera(F, t);
    F.update({ t: HERO_STEAM_T + t, scan: lerp(-17, 19, easeInOut(seg(t, 0.15, 2.8))), scanGlow: seg(t, 0.1, 0.4) * (1 - seg(t, 2.6, 3.0)) });
    backdrop(ctx, t); drawPlant(ctx, F.render()); vignette(ctx, 0.35);
  }
  function plant_perceive(ctx, P) { // 3–5 秒：设备逐台点亮；反光处出现通用模型的误判框；塔顶阀组的真实边界描出
    const t = P.t, tb = P.tb;
    heroCamera(F, t);
    F.update({ t: HERO_STEAM_T + t, units: unitWave(tb) });
    backdrop(ctx, t); drawPlant(ctx, F.render()); vignette(ctx, 0.35);
    const [gx, gy] = F.project(FACILITY.glare);
    dashRect(ctx, gx - 34, gy - 30, 68, 60, { alpha: easeOut(seg(tb, 0.25, 0.55)), width: 2.5 });
    const poly = targetPolygon(F), k = easeInOut(seg(tb, 0.45, 0.95));
    if (k > 0) {
      ctx.save(); ctx.globalAlpha = 0.14 * k; ctx.fillStyle = ACC; ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill(); ctx.restore();
      drawLine(ctx, poly, k, { close: true, width: 3, glow: 12 });
    }
    if (tb > 0.95) nodes(ctx, poly, 9, ACC, easeOut(seg(tb, 0.95, 1.15)));
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    env.anchors.glare = [gx - 34, gy - 40];
    env.anchors.target = [Math.max(...xs) + 18, Math.min(...ys) + 44];
  }

  // ---------- S09 主图化为三维、环绕框定 ----------
  const heroCam = (() => { heroCamera(F, HERO_T); return F.cam.clone(); })();
  const orbitCam = a => { const d = 15; F.setCamera([TC3[0] + Math.sin(a) * d, 12.5, TC3[2] + Math.cos(a) * d], [4.0, 6.6, -4.2], 34); };
  const A0 = -0.95, A1 = -0.55;
  function camBetween(k, setB) { // 在主图机位与另一机位之间插值（位置、朝向点、视角）
    setB(); const bp = F.cam.position.clone(), bf = F.cam.fov, bq = F.cam.quaternion.clone();
    const p = heroCam.position.clone().lerp(bp, k), q = heroCam.quaternion.clone().slerp(bq, k);
    F.cam.position.copy(p); F.cam.quaternion.copy(q); F.cam.fov = lerp(heroCam.fov, bf, k); F.cam.updateProjectionMatrix(); F.cam.updateMatrixWorld();
    F.setPix?.();
  }
  function image_to_particles(ctx, P) { // 1.2 秒：主图沿扫描线化为光点；光点从“贴在画面上的平面”恢复真实深度，镜头开始环绕
    const tb = P.tb, wipe = clamp(tb / 0.5);
    camBetween(easeInOut(seg(tb, 0.25, 1.2)), () => orbitCam(A0));
    F.update({ t: HERO_STEAM_T + HERO_T, flat: 1 - easeInOut(seg(tb, 0.2, 1.15)), flatCam: heroCam, steamAmount: 0.8 });
    backdrop(ctx, 52.6 + tb); drawPlant(ctx, F.render());
    if (wipe < 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(wipe * W, 0, W, H); ctx.clip(); ctx.drawImage(env.hero, 0, 0, W, H); ctx.restore();
      const lg = ctx.createLinearGradient(wipe * W - 40, 0, wipe * W + 4, 0); lg.addColorStop(0, rgba(ACC, 0)); lg.addColorStop(1, rgba(ACC, 0.55));
      ctx.fillStyle = lg; ctx.fillRect(wipe * W - 40, 0, 44, H); ctx.fillStyle = 'rgba(220,245,255,.9)'; ctx.fillRect(wipe * W, 0, 2, H);
    }
    vignette(ctx, 0.35);
  }
  function box3d(ctx, k, cam = F.cam, vp) {
    const q = corners(TB).map(v => F.project(v, cam, vp));
    EDGES.forEach(([i, j]) => drawLine(ctx, [q[i], q[j]], k, { width: 2, glow: 8, flow: false }));
    return q;
  }
  function axes(ctx, a = 1) {
    const o = [-2.5, 0, 3], L = 2.2, po = F.project(o);
    ctx.save(); ctx.globalAlpha = a;
    [[[L, 0, 0], AMBER], [[0, L, 0], ACC], [[0, 0, L], '#ffffff']].forEach(([d, col]) => {
      const pe = F.project([o[0] + d[0], o[1] + d[1], o[2] + d[2]]); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...po); ctx.lineTo(...pe); ctx.stroke();
    });
    ctx.restore();
  }
  function pointcloudFrame(tb) { // 0–3.2：环绕最高精馏塔 20°；0.2–0.8 目标点变为琥珀色
    orbitCam(lerp(A0, A1, easeInOut(seg(tb, 0, 3.2))));
    F.update({ t: HERO_STEAM_T + HERO_T + 1.2 + tb, targetMix: easeOut(seg(tb, 0.2, 0.8)), steamAmount: 0.8, units: { 5: 0.2 * easeOut(seg(tb, 0.2, 0.8)) } });
    return F.render();
  }
  function pointcloud(ctx, P) {
    const tb = P.tb, cv = pointcloudFrame(tb);
    backdrop(ctx, 53.8 + tb); drawPlant(ctx, cv); vignette(ctx, 0.35);
    if (tb > 0.8) {
      const q = box3d(ctx, easeOut(seg(tb, 0.8, 1.3)));
      env.anchors.box3d = [Math.max(...q.map(p => p[0])) + 18, Math.min(...q.map(p => p[1])) + 40];
    }
    axes(ctx);
  }

  // ---------- S10 场景生长、三视图 ----------
  const wideCam = () => F.setCamera([-22, 15, 40], [2.4, 4.2, -5], 30);
  function sceneFrame(tb) { // 0–3：从精馏塔后拉到全景，场站以目标为中心由近及远显现
    const k = easeInOut(seg(tb, 0, 3));
    camBetweenCams(k);
    F.update({ t: HERO_STEAM_T + HERO_T + 4.4 + tb, targetMix: 1, reveal: { c: TC3, r: lerp(4, 46, easeOut(seg(tb, 0.05, 2.7))) }, units: { 5: 0.2 } });
    return F.render();
  }
  function camBetweenCams(k) {
    orbitCam(A1); const ap = F.cam.position.clone(), aq = F.cam.quaternion.clone(), af = F.cam.fov;
    wideCam(); const bp = F.cam.position.clone(), bq = F.cam.quaternion.clone(), bf = F.cam.fov;
    F.cam.position.copy(ap.lerp(bp, k)); F.cam.quaternion.copy(aq.slerp(bq, k)); F.cam.fov = lerp(af, bf, k);
    F.cam.updateProjectionMatrix(); F.cam.updateMatrixWorld(); F.setPix?.();
  }
  function pointcloud_scene(ctx, P) {
    const tb = P.tb, cv = sceneFrame(tb);
    backdrop(ctx, 55 + tb); drawPlant(ctx, cv); vignette(ctx, 0.35);
    box3d(ctx, 1);
  }
  const VP = [[75, 300, 580, 390], [670, 300, 580, 390], [1265, 300, 580, 390]], ASP = 580 / 390; // 屏幕坐标 x, y(顶), w, h
  const front = F.ortho([0, 0, 1], [0, 1, 0], [12.5, 12.5 / ASP], [1.6, 6.5, -5]);
  const top = F.ortho([0, 1, 0], [0, 0, -1], [13, 13 / ASP], [1.6, 0, -5.5]);
  const persp = new THREE.PerspectiveCamera(32, ASP, 0.1, 400); persp.position.set(-14, 13, 26); persp.lookAt(2.5, 4, -5); persp.updateMatrixWorld();
  const VIEW_CAMS = [front, top, persp];
  function multiFrame(tb) {
    persp.position.set(-14 + tb * 0.6, 13, 26); persp.lookAt(2.5, 4, -5); persp.updateMatrixWorld();
    F.update({ t: HERO_STEAM_T + HERO_T + 7.4 + tb, targetMix: 1, steamAmount: 0.6 });
    F.clear(); VP.forEach((v, i) => F.render(v, VIEW_CAMS[i]));
    return VP.map((v, i) => F.project(TC3, VIEW_CAMS[i], v));
  }
  function multi_view(ctx, P) {
    bgNavy(ctx, { dots: false });
    const k = easeOut(seg(P.tb, 0, 0.5));
    const targets = multiFrame(P.tb);
    VP.forEach(v => panel(ctx, v[0], v[1], v[2], v[3], { r: 8, alpha: k }));
    ctx.save(); ctx.globalAlpha = k; drawPlant(ctx, F.canvas); ctx.restore();
    ['主视', '俯视', '三维'].forEach((name, i) => {
      const v = VP[i];
      text(ctx, name, v[0] + 16, v[1] - 14, { font: '700 24px NS', color: C.teal, alpha: k });
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = AMBER; ctx.lineWidth = 3; ctx.strokeRect(targets[i][0] - 16, targets[i][1] - 16, 32, 32); ctx.restore();
    });
    drawLine(ctx, targets, easeOut(seg(P.tb, 0.5, 1.4)), { width: 3 });
  }

  // ---------- 供岗位卡、宫格复用的缩略画面（以“加亮”方式叠加） ----------
  const scenes = { plant_reveal, plant_perceive, image_to_particles, pointcloud, pointcloud_scene, multi_view };
  return {
    scenes,
    thumb: { pointcloud: tb => pointcloudFrame(tb), scene: tb => sceneFrame(tb), multi: tb => { multiFrame(tb); return F.canvas; }, views: VP },
  };
}
