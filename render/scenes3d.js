// 三维场景：占位主图粒子化、设备点云、点云场景生长、三视图。WebGL 画面先渲染到离屏画布，再合成到主画布。
import * as THREE from './node_modules/three/build/three.module.js';
import { HERO_CAMERA, HERO_GEOMETRY as G } from './geometry.js';
import { C, THEME, seg, clamp, lerp, easeOut, easeInOut, rng, bgNavy, panel, text, drawLine, rgba } from './draw.js';

export async function makeScenes3D(env) {
  const W = 1920, H = 1080;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
  const cam = new THREE.PerspectiveCamera(HERO_CAMERA.fov, W / H, 0.1, 200);
  const target3 = new THREE.Vector3(...HERO_CAMERA.target);
  const scene = new THREE.Scene();

  // ---------- 设备点云（与占位主图同一几何） ----------
  const N = 200000, R = rng(11);
  const base = new THREE.Color(C.cloud), hit = new THREE.Color(C.amber);
  const pts = new Float32Array(N * 3), isTarget = new Uint8Array(N);
  const cyl = (cx, cy, cz, r, axis, a0, a1) => { const a = R() * Math.PI * 2, h = lerp(a0, a1, R());
    return axis === 'x' ? [cx + h, cy + Math.cos(a) * r, cz + Math.sin(a) * r] : [cx + Math.cos(a) * r, cy + h, cz + Math.sin(a) * r]; };
  for (let i = 0; i < N; i++) {
    const u = R(); let p;
    if (u < 0.42) p = cyl(0, 0, 0, G.pipeR, 'x', -6, 6);
    else if (u < 0.58) { const a = R() * Math.PI * 2, rr = lerp(G.pipeR, G.flangeR, Math.sqrt(R())); const x = G.flangeX[R() < 0.5 ? 0 : 1] + (R() - 0.5) * G.flangeT; p = [x, Math.cos(a) * rr, Math.sin(a) * rr]; }
    else if (u < 0.63) { const b = Math.floor(R() * 8), a = (b / 8) * Math.PI * 2 + Math.PI / 8; p = [(R() - 0.5) * 0.46, Math.cos(a) * G.boltR + (R() - 0.5) * 0.09, Math.sin(a) * G.boltR + (R() - 0.5) * 0.09]; }
    else if (u < 0.67) p = cyl(G.gauge[0], 0.45, 0, 0.08, 'y', 0, 0.75);
    else if (u < 0.73) { const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * G.gaugeR; p = [G.gauge[0] + Math.cos(a) * rr, G.gauge[1] + Math.sin(a) * rr, G.gauge[2] + (R() - 0.5) * 0.14]; }
    else if (u < 0.81) p = cyl(G.wheel[0], 0.48, G.wheel[2], 0.2, 'y', 0, 1.15);
    else if (u < 0.87) { const a = R() * Math.PI * 2, tube = (R() - 0.5) * 0.1; p = [G.wheel[0] + Math.cos(a) * (0.55 + tube), G.wheel[1] + (R() - 0.5) * 0.1, G.wheel[2] + Math.sin(a) * (0.55 + tube)]; }
    else { const a = R() * Math.PI * 2, d = Math.sqrt(R()); p = [G.stain[0] + Math.cos(a) * 0.2 * d, G.stain[1] + Math.sin(a) * 0.26 * d, G.stain[2] + (R() - 0.5) * 0.05]; }
    pts.set(p, i * 3);
    isTarget[i] = Math.hypot(p[0] - G.stain[0], (p[1] - G.stain[1]) * 0.8, p[2] - G.stain[2]) < 0.27 ? 1 : 0;
  }
  // 起点：从占位主图采样像素，反投影到法兰前方的平面上
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const octx = off.getContext('2d'); octx.drawImage(env.hero, 0, 0, W, H);
  const pix = octx.getImageData(0, 0, W, H).data;
  cam.position.set(...HERO_CAMERA.position); cam.lookAt(target3); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const start = new Float32Array(N * 3), scol = new Float32Array(N * 3), delay = new Float32Array(N);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.3), hitP = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const sx = Math.floor(R() * W), sy = Math.floor(R() * H), k = (sy * W + sx) * 4;
    ray.setFromCamera(new THREE.Vector2(sx / W * 2 - 1, 1 - sy / H * 2), cam); ray.ray.intersectPlane(plane, hitP);
    start.set([hitP.x, hitP.y, hitP.z], i * 3);
    scol.set([pix[k] / 255, pix[k + 1] / 255, pix[k + 2] / 255], i * 3);
    delay[i] = sx / W;
  }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const cloud = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.014, vertexColors: true, transparent: true, opacity: 0.95 }));
  cloud.frustumCulled = false; scene.add(cloud);

  // 场景扩展：管廊立柱、横梁、上层管道、储罐、楼梯、地面
  const EX = [], R2 = rng(29);
  const addLine = (a, b, n, jitter = 0.05) => { for (let i = 0; i < n; i++) { const k = R2(); EX.push([lerp(a[0], b[0], k) + (R2() - .5) * jitter, lerp(a[1], b[1], k) + (R2() - .5) * jitter, lerp(a[2], b[2], k) + (R2() - .5) * jitter]); } };
  for (let x = -7.2; x <= 7.3; x += 2.4) { addLine([x, -2.2, -2.6], [x, 4, -2.6], 2500, 0.18); addLine([x, -2.2, 1.6], [x, 4, 1.6], 1500, 0.18); }
  for (const y of [3.0, -0.9]) addLine([-7.5, y, -2.6], [7.5, y, -2.6], 6000, 0.12);
  for (const z of [-1.1, -1.8]) for (let i = 0; i < 9000; i++) { const a = R2() * Math.PI * 2; EX.push([lerp(-7.5, 7.5, R2()), 2.2 + Math.cos(a) * 0.32, z + Math.sin(a) * 0.32]); }
  for (let i = 0; i < 22000; i++) { const a = R2() * Math.PI * 2; EX.push([-6 + Math.cos(a) * 1.5, lerp(-2.2, 3, R2()), -5 + Math.sin(a) * 1.5]); }
  for (let s = 0; s < 10; s++) addLine([4.5 + s * 0.3, -2.2 + s * 0.42, 2.6], [4.5 + s * 0.3, -2.2 + s * 0.42, 3.6], 400, 0.04);
  for (let i = 0; i < 26000; i++) EX.push([lerp(-8, 8, R2()), -2.2, lerp(-6, 4, R2())]);
  const NE = EX.length, exPos = new Float32Array(NE * 3), exHome = new Float32Array(NE * 3), exDist = new Float32Array(NE);
  EX.forEach((p, i) => { exHome.set(p, i * 3); exDist[i] = Math.hypot(p[0], p[1] + 0.3, p[2]); });
  const exGeo = new THREE.BufferGeometry(); exGeo.setAttribute('position', new THREE.BufferAttribute(exPos, 3));
  const exCloud = new THREE.Points(exGeo, new THREE.PointsMaterial({ size: 0.03, color: new THREE.Color(C.cloudFar), transparent: true, opacity: 0.8 }));
  exCloud.frustumCulled = false; scene.add(exCloud);

  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.62, 0.36)), new THREE.LineBasicMaterial({ color: C.edge }));
  box.position.set(G.stain[0], G.stain[1], G.stain[2]); scene.add(box);
  const axes = new THREE.AxesHelper(0.7); axes.position.set(-3.1, -1.25, 0.2);
  axes.setColors(new THREE.Color(C.amber), new THREE.Color(C.teal), new THREE.Color(0xffffff)); scene.add(axes);

  const baseArr = base.toArray(), hitArr = hit.toArray();
  function setCloud(k, recol, { fromImage = false, wipe = 2 } = {}) {
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      const ki = fromImage ? easeInOut(clamp((wipe - delay[i]) / 0.55)) : k;
      if (fromImage && ki <= 0) { pos[j] = pos[j + 1] = 0; pos[j + 2] = 999; continue; }
      const swirl = Math.sin(ki * Math.PI) * 0.3;
      for (let a = 0; a < 3; a++) pos[j + a] = start[j + a] + (pts[j + a] - start[j + a]) * ki + Math.sin((j + a) * 12.9898) * swirl;
      const tc = isTarget[i] ? hitArr : baseArr;
      for (let a = 0; a < 3; a++) { const c0 = lerp(scol[j + a], baseArr[a], ki); col[j + a] = lerp(c0, tc[a], recol); }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  function setExtras(radius) {
    for (let i = 0; i < NE; i++) {
      const j = i * 3, on = exDist[i] < radius;
      exPos[j] = on ? exHome[j] : 0; exPos[j + 1] = on ? exHome[j + 1] : 0; exPos[j + 2] = on ? exHome[j + 2] : 999;
    }
    exGeo.attributes.position.needsUpdate = true;
  }
  function orbit(a, dist = 7, y = 0.35) {
    cam.position.set(Math.sin(a) * dist, y, Math.cos(a) * dist); cam.lookAt(target3); cam.updateMatrixWorld();
  }
  const project = (v, camera = cam, vp = [0, 0, W, H]) => {
    const p = new THREE.Vector3(...v).project(camera);
    return [vp[0] + (p.x + 1) / 2 * vp[2], H - (vp[1] + (p.y + 1) / 2 * vp[3])];
  };
  function render() { renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear(); renderer.render(scene, cam); return canvas; }

  // ---------- 场景函数 ----------
  function pointcloudFrame(tb) { // 0–3.2：环绕 20°，0.2–0.8 目标变色，0.8–1.4 三维框
    setCloud(1, easeOut(seg(tb, 0.2, 0.8))); setExtras(0);
    orbit(easeInOut(seg(tb, 0, 3.2)) * 0.35);
    box.visible = tb > 0.8; box.scale.setScalar(Math.max(0.001, easeOut(seg(tb, 0.8, 1.3)))); axes.visible = true;
    return render();
  }
  function sceneFrame(tb) { // 0–3：后拉并让场景由近及远生长
    setCloud(1, 1); const k = easeInOut(seg(tb, 0, 3));
    setExtras(lerp(1.5, 15, easeOut(seg(tb, 0.1, 2.6))));
    orbit(0.35 + k * 0.3, lerp(7, 17, k), lerp(0.35, 3.4, k));
    box.visible = true; box.scale.setScalar(1); axes.visible = false;
    return render();
  }
  const ortho = (dir, up) => {
    const c = new THREE.OrthographicCamera(-9, 9, 6, -6, 0.1, 100);
    c.position.set(...dir.map(v => v * 30)); c.up.set(...up); c.lookAt(0, 0, 0); c.updateMatrixWorld(); return c;
  };
  const front = ortho([0, 0, 1], [0, 1, 0]), top = ortho([0, 1, 0], [0, 0, -1]);
  const VP = [[75, 300, 580, 390], [670, 300, 580, 390], [1265, 300, 580, 390]]; // 屏幕坐标 x, y(顶), w, h
  function multiFrame(tb) {
    setCloud(1, 1); setExtras(99); box.visible = true; axes.visible = false;
    orbit(0.65 + tb * 0.05, 17, 3.4);
    renderer.setClearColor(0x000000, 0); renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
    const cams = [front, top, cam], out = [];
    VP.forEach((v, i) => {
      const glv = [v[0], H - v[1] - v[3], v[2], v[3]];
      renderer.setViewport(...glv); renderer.setScissor(...glv);
      if (cams[i] === cam) { cam.aspect = v[2] / v[3]; cam.updateProjectionMatrix(); }
      renderer.render(scene, cams[i]); out.push(project(G.stain, cams[i], glv));
      if (cams[i] === cam) { cam.aspect = W / H; cam.updateProjectionMatrix(); }
    });
    renderer.setScissorTest(false);
    return out;
  }

  const scenes = {
    image_to_particles(ctx, P) { // 主图从左到右碎成粒子并飞向点云
      bgNavy(ctx, { dots: false });
      const wipe = P.tb / 0.5;
      ctx.save(); ctx.beginPath(); ctx.rect(clamp(wipe) * W, 0, W, H); ctx.clip(); ctx.drawImage(env.hero, 0, 0); ctx.restore();
      setCloud(0, 0, { fromImage: true, wipe }); setExtras(0); orbit(0); box.visible = false; axes.visible = false;
      ctx.drawImage(render(), 0, 0);
    },
    pointcloud(ctx, P) {
      bgNavy(ctx, { dots: false });
      ctx.drawImage(pointcloudFrame(P.tb), 0, 0);
      if (P.tb > 1.0) { const c = project([G.stain[0] + 0.25, G.stain[1] - 0.2, G.stain[2] + 0.18]); env.anchors.box3d = [c[0] + 14, c[1] + 40]; }
    },
    pointcloud_scene(ctx, P) {
      bgNavy(ctx, { dots: false });
      ctx.drawImage(sceneFrame(P.tb), 0, 0);
    },
    multi_view(ctx, P) {
      bgNavy(ctx, { dots: false });
      const k = easeOut(seg(P.tb, 0, 0.5));
      const targets = multiFrame(P.tb);
      // 动感主题：三个视窗垫玻璃面板（中性白描边），不用强调色线框
      if (THEME.vibrant) VP.forEach(v => panel(ctx, v[0], v[1], v[2], v[3], { r: 8, alpha: k }));
      ctx.save(); ctx.globalAlpha = k; ctx.drawImage(canvas, 0, 0); ctx.restore();
      ['主视', '俯视', '三维'].forEach((name, i) => {
        const v = VP[i];
        if (!THEME.vibrant) { ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = rgba(C.teal, 0.5); ctx.lineWidth = 2; ctx.strokeRect(v[0], v[1], v[2], v[3]); ctx.restore(); }
        text(ctx, name, v[0] + 16, v[1] - 14, { font: '700 24px NS', color: C.teal, alpha: k });
        ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = C.amber; ctx.lineWidth = 3; ctx.strokeRect(targets[i][0] - 18, targets[i][1] - 18, 36, 36); ctx.restore();
      });
      drawLine(ctx, targets, easeOut(seg(P.tb, 0.5, 1.4)), { width: 3 });
    },
  };
  return {
    scenes,
    thumb: { pointcloud: tb => pointcloudFrame(tb), scene: tb => sceneFrame(tb), multi: tb => { multiFrame(tb); return canvas; }, views: VP },
  };
}
