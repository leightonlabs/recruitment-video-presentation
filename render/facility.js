// 数字孪生能源场站：程序生成的装置区光点模型，取代原“边界案例 017”水管主图。
// 冷却塔（双曲面直纹格构）、精馏塔、球罐、烟囱、钢结构框架、输煤栈桥、输电塔与地面点阵，
// 柔光圆点按距离雾化，扫描光面从左到右显现场站，冷却塔与塔顶阀组旁有蒸汽粒子。
// 所有状态都是时间的纯函数，便于逐帧渲染；project() 把世界坐标换算为屏幕像素，供二维标注层对位。
import * as THREE from './node_modules/three/build/three.module.js';
import { rng } from './draw.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// 场站布局（世界单位约 10 米）：目标为最高精馏塔 C3 塔顶平台上的阀组，反光点在球罐 T1 表面
export const FACILITY = {
  towers: [{ c: [-7.5, 0, -7], s: 1 }, { c: [-2.6, 0, -9.6], s: 0.88 }],
  columns: [{ c: [2.2, 0, -4.2], r: 0.42, h: 8.5 }, { c: [3.4, 0, -5.1], r: 0.34, h: 6.8 }, { c: [4.6, 0, -3.9], r: 0.55, h: 10.4 }],
  spheres: [{ c: [8.6, 2.0, -1.8], r: 1.35 }, { c: [11.3, 1.75, -2.8], r: 1.15 }, { c: [9.9, 2.15, -5.6], r: 1.5 }],
  stack: { c: [0.2, 0, -12.5], r0: 0.55, r1: 0.32, h: 14 },
  frame: { x: [0.6, 2.2, 3.8, 5.4], z: [-2.4, -1.0], y: [0, 1.6, 3.2, 4.6] },
  conveyor: { a: [-12.5, 0.3, 1.8], b: [-5.8, 4.8, -4.4], w: 0.7, h: 0.6 },
  pylon: { c: [21, 0, -16], h: 8.5 },
  target: [4.6, 9.75, -3.9],          // 塔顶阀组中心
  targetBox: [[3.95, 9.35, -4.4], [5.25, 10.25, -3.4]],
  glare: [8.15, 2.55, -0.65],         // 球罐 T1 表面的反光点
  vent: [5.0, 9.5, -3.8],             // 右侧阀体处的蒸汽源，向右上飘散，遮住阀组右侧
};

export function makeFacility({ W = 1920, H = 1080 } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 400);
  const R = rng(2027);

  // ---------- 生成光点 ----------
  const P = [], Cl = [], S = [], K = [], U = []; // 位置、颜色、尺寸、类别（0 结构 1 灯 2 目标 3 反光 4 地面）、设备编号
  const ICE = [0.62, 0.74, 1.0], DIM = [0.2, 0.32, 0.62], WARM = [1.0, 0.72, 0.4], RED = [1.0, 0.25, 0.2];
  let unit = 0;
  const add = (x, y, z, col = ICE, size = 0.05, kind = 0, k = 1) => { P.push(x, y, z); Cl.push(col[0] * k, col[1] * k, col[2] * k); S.push(size); K.push(kind); U.push(unit); };
  const line = (a, b, step = 0.06, col = ICE, size = 0.045, kind = 0, k = 0.8) => {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step));
    for (let i = 0; i <= n; i++) { const t = i / n; add(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, col, size, kind, k); }
  };
  const ring = (cx, y, cz, r, n, col = ICE, size = 0.045, kind = 0, k = 0.8) => {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; add(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, col, size, kind, k); }
  };

  // 地面点阵与道路
  unit = 0;
  for (let x = -34; x <= 34; x += 0.6) for (let z = -32; z <= 14; z += 0.6) add(x, 0, z, DIM, 0.035, 4, 0.55);
  for (let x = -34; x <= 34; x += 0.12) { add(x, 0.01, 4.2, DIM, 0.04, 4, 1.2); add(x, 0.01, 6.0, DIM, 0.04, 4, 1.2); }

  // 冷却塔：双曲面上两族直纹线（细密的斜向格构）、顶口与底圈
  FACILITY.towers.forEach(({ c, s }, ti) => {
    unit = 1 + ti;
    const rt = 1.7 * s, yt = 5.6 * s, rb = 2.8 * s, top = 7.6 * s, cc = yt / Math.sqrt((rb / rt) ** 2 - 1);
    const rTop = rt * Math.sqrt(1 + ((top - yt) / cc) ** 2);
    // 直纹线：喉部圆上一点沿 (−sinφ, c/rt, cosφ) 方向延伸，两族方向相反
    for (const dir of [1, -1]) for (let i = 0; i < 56; i++) {
      const ph = (i / 56) * Math.PI * 2, off = R();
      for (let j = 0; j < 150; j++) {
        const y = ((j + off) / 150) * top, u = (y - yt) / cc;
        add(c[0] + rt * (Math.cos(ph) - dir * u * Math.sin(ph)), y, c[2] + rt * (Math.sin(ph) + dir * u * Math.cos(ph)), ICE, 0.032, 0, 0.52);
      }
    }
    ring(c[0], top, c[2], rTop, 320, ICE, 0.036, 0, 0.9); ring(c[0], 0.05, c[2], rb, 340, ICE, 0.036, 0, 0.75);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; add(c[0] + Math.cos(a) * rb * 1.08, 0.4, c[2] + Math.sin(a) * rb * 1.08, WARM, 0.09, 1, 1); }
  });

  // 精馏塔：12 条母线、稀疏环线、平台与栏杆、爬梯、塔顶封头
  FACILITY.columns.forEach(({ c, r, h }, ci) => {
    unit = 3 + ci;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; line([c[0] + Math.cos(a) * r, 0, c[2] + Math.sin(a) * r], [c[0] + Math.cos(a) * r, h, c[2] + Math.sin(a) * r], 0.035, ICE, 0.032, 0, 0.68); }
    for (let y = 0.6; y <= h; y += 0.6) ring(c[0], y, c[2], r, Math.round(r * 90), ICE, 0.03, 0, 0.48);
    for (let y = 1.8; y < h; y += 1.8) {
      ring(c[0], y, c[2], r + 0.38, 150, ICE, 0.034, 0, 0.85); ring(c[0], y + 0.28, c[2], r + 0.38, 150, ICE, 0.03, 0, 0.5);
      add(c[0] + r + 0.38, y + 0.3, c[2], WARM, 0.08, 1, 1);
    }
    line([c[0] - r - 0.12, 0, c[2] + 0.1], [c[0] - r - 0.12, h, c[2] + 0.1], 0.04, ICE, 0.03, 0, 0.6);
    for (let k = 0; k < 6; k++) { const ph = (k / 6) * Math.PI / 2; ring(c[0], h + Math.sin(ph) * r * 0.6, c[2], Math.cos(ph) * r, Math.round(r * 70), ICE, 0.03, 0, 0.6); }
  });
  // 塔顶阀组（目标）：最高塔顶部平台上的三只阀体与短管
  {
    unit = 5;
    const [tx, ty, tz] = FACILITY.target;
    ring(tx, ty - 0.35, tz, 0.95, 160, ICE, 0.045, 0, 0.9);
    for (const [dx, dz] of [[-0.35, 0.2], [0.05, 0.35], [0.4, 0.05]]) {
      for (let y = 0; y < 0.42; y += 0.04) ring(tx + dx, ty - 0.3 + y, tz + dz, 0.11, 18, ICE, 0.038, 2, 0.9);
      ring(tx + dx, ty + 0.14, tz + dz, 0.2, 26, ICE, 0.04, 2, 1);
    }
    line([tx - 0.6, ty - 0.1, tz + 0.3], [tx + 0.6, ty - 0.1, tz + 0.3], 0.04, ICE, 0.035, 2, 0.8);
  }

  // 球罐：经纬线、赤道环与支腿；T1 上的一点强反光
  FACILITY.spheres.forEach(({ c, r }, si) => {
    unit = 6 + si;
    for (let m = 0; m < 18; m++) { const a = (m / 18) * Math.PI * 2; for (let k = 0; k <= 90; k++) { const th = (k / 90) * Math.PI; add(c[0] + Math.sin(th) * Math.cos(a) * r, c[1] + Math.cos(th) * r, c[2] + Math.sin(th) * Math.sin(a) * r, ICE, 0.03, 0, 0.45); } }
    for (let k = 1; k < 9; k++) { const th = (k / 9) * Math.PI; ring(c[0], c[1] + Math.cos(th) * r, c[2], Math.sin(th) * r, Math.round(Math.sin(th) * r * 110), ICE, 0.03, 0, 0.4); }
    ring(c[0], c[1], c[2], r * 1.01, 240, ICE, 0.036, 0, 0.9);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r], [c[0] + Math.cos(a) * r * 1.02, 0, c[2] + Math.sin(a) * r * 1.02], 0.05, ICE, 0.032, 0, 0.7); }
  });
  unit = 6;
  for (let i = 0; i < 90; i++) { const a = R() * Math.PI * 2, d = Math.pow(R(), 2) * 0.22; add(FACILITY.glare[0] + Math.cos(a) * d, FACILITY.glare[1] + Math.sin(a) * d, FACILITY.glare[2], [1, 0.97, 0.9], 0.06, 3, 1); }
  add(...FACILITY.glare, [1, 0.95, 0.85], 0.9, 3, 0.8);

  // 烟囱与航空障碍灯
  {
    unit = 9;
    const { c, r0, r1, h } = FACILITY.stack;
    for (let y = 0; y <= h; y += 0.12) ring(c[0], y, c[2], r0 + (r1 - r0) * (y / h), 36, ICE, 0.04, 0, 0.6);
    for (const y of [h * 0.5, h]) for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; add(c[0] + Math.cos(a) * (r1 + 0.05), y, c[2] + Math.sin(a) * (r1 + 0.05), RED, 0.16, 1, 1); }
  }
  // 钢结构框架
  {
    unit = 10;
    const { x, z, y } = FACILITY.frame;
    for (const xi of x) for (const zi of z) line([xi, 0, zi], [xi, y[y.length - 1], zi], 0.05, ICE, 0.045, 0, 0.9);
    for (const yi of y.slice(1)) {
      for (const zi of z) line([x[0], yi, zi], [x[x.length - 1], yi, zi], 0.05, ICE, 0.045, 0, 0.9);
      for (const xi of x) line([xi, yi, z[0]], [xi, yi, z[1]], 0.05, ICE, 0.045, 0, 0.9);
      add(x[1], yi - 0.1, z[1], WARM, 0.1, 1, 1); add(x[3], yi - 0.1, z[1], WARM, 0.1, 1, 1);
    }
    for (let i = 0; i < x.length - 1; i++) for (let j = 0; j < y.length - 1; j++) line([x[i], y[j], z[1]], [x[i + 1], y[j + 1], z[1]], 0.07, ICE, 0.035, 0, 0.5);
  }
  // 输煤栈桥：倾斜的桁架廊道
  {
    unit = 11;
    const { a, b, w, h } = FACILITY.conveyor;
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), ux = (b[0] - a[0]) / L, uz = (b[2] - a[2]) / L, nx = -uz * w / 2, nz = ux * w / 2;
    const corners = [[nx, 0, nz], [-nx, 0, -nz], [nx, h, nz], [-nx, h, -nz]];
    for (const [ox, oy, oz] of corners) line([a[0] + ox, a[1] + oy, a[2] + oz], [b[0] + ox, b[1] + oy, b[2] + oz], 0.05, ICE, 0.045, 0, 0.9);
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      line([p[0] + nx, p[1], p[2] + nz], [p[0] + nx, p[1] + h, p[2] + nz], 0.05, ICE, 0.035, 0, 0.6);
      line([p[0] - nx, p[1], p[2] - nz], [p[0] - nx, p[1] + h, p[2] - nz], 0.05, ICE, 0.035, 0, 0.6);
      if (i % 3 === 1) line([p[0], 0, p[2]], [p[0], p[1], p[2]], 0.06, ICE, 0.04, 0, 0.7);
    }
  }
  // 远处输电塔
  {
    unit = 12;
    const { c, h } = FACILITY.pylon, wb = 1.4, wt = 0.35;
    const leg = (sx, sz) => line([c[0] + sx * wb, 0, c[2] + sz * wb], [c[0] + sx * wt, h, c[2] + sz * wt], 0.06, ICE, 0.04, 0, 0.7);
    leg(1, 1); leg(-1, 1); leg(1, -1); leg(-1, -1);
    for (const y of [h * 0.55, h * 0.8]) line([c[0] - 2.4, y, c[2]], [c[0] + 2.4, y, c[2]], 0.06, ICE, 0.04, 0, 0.7);
    add(c[0], h + 0.2, c[2], RED, 0.16, 1, 1);
  }

  const N = S.length;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(Cl, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(S, 1));
  geo.setAttribute('kind', new THREE.Float32BufferAttribute(K, 1));
  geo.setAttribute('unit', new THREE.Float32BufferAttribute(U, 1));

  const uniforms = {
    uPix: { value: H / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) },
    uScan: { value: 99 }, uScanW: { value: 2.5 }, uTime: { value: 0 },
    uTargetMix: { value: 0 }, uTargetCol: { value: new THREE.Color(1.0, 0.69, 0.13) },
    uGlare: { value: 1 }, uFogNear: { value: 20 }, uFogFar: { value: 70 }, uBright: { value: 1 },
    uUnit: { value: new Array(16).fill(0) },
    // 压平：把光点沿“镜头→光点”的射线挪到过 uFlatP、法线 uFlatN 的平面上，从拍摄机位看投影不变（用于“二维图像→三维场景”）
    uFlat: { value: 0 }, uFlatC: { value: new THREE.Vector3() }, uFlatP: { value: new THREE.Vector3() }, uFlatN: { value: new THREE.Vector3(0, 0, 1) },
    // 由近及远显现：只显示与 uRevC 距离小于 uRevR 的光点
    uRevC: { value: new THREE.Vector3() }, uRevR: { value: 999 },
  };
  const VERT = `
    attribute vec3 color; attribute float size; attribute float kind; attribute float unit;
    uniform float uPix, uScan, uScanW, uTime, uTargetMix, uGlare, uFogNear, uFogFar, uBright; uniform vec3 uTargetCol;
    uniform float uUnit[16];
    uniform float uFlat, uRevR; uniform vec3 uFlatC, uFlatP, uFlatN, uRevC;
    varying vec3 vCol; varying float vA;
    void main() {
      vec3 p = position;
      if (uFlat > 0.0) {
        float dn = max(dot(p - uFlatC, uFlatN), 0.1);
        p = mix(p, uFlatC + (p - uFlatC) * (dot(uFlatP - uFlatC, uFlatN) / dn), uFlat);
      }
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float d = max(0.1, -mv.z);
      float front = position.x - uScan;
      float vis = (1.0 - smoothstep(-0.05, 0.25, front)) * (1.0 - smoothstep(uRevR - 1.5, uRevR, distance(position, uRevC)));
      float band = exp(-pow(front / uScanW, 2.0)) * step(front, 0.6) * step(kind, 4.5); // 蒸汽不受扫描光带提亮
      float fog = clamp(1.0 - (d - uFogNear) / (uFogFar - uFogNear), 0.12, 1.0);
      vec3 col = color;
      if (kind > 1.5 && kind < 2.5) col = mix(col, uTargetCol, uTargetMix);
      float a = vis * fog * uBright;
      if (kind > 0.5 && kind < 1.5) a *= 0.75 + 0.25 * sin(uTime * 2.6 + position.x * 5.0 + position.y * 3.0);
      if (kind > 2.5 && kind < 3.5) a *= uGlare;
      if (kind > 4.5) a *= smoothstep(2.5, 7.0, d); // 蒸汽贴近镜头时淡出，避免糊成一团
      float hl = uUnit[int(unit + 0.5)];
      vCol = col + vec3(0.45, 0.75, 1.0) * (band * 0.9 + hl * 0.8);
      vA = a * (1.0 + band * 1.5 + hl * 1.2);
      gl_PointSize = clamp(size * uPix / d * (1.0 + band * 0.6), 1.0, kind > 4.5 ? 220.0 : 600.0);
      gl_Position = projectionMatrix * mv;
    }`;
  const FRAG = `
    varying vec3 vCol; varying float vA;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      float a = exp(-r * r * 4.0) * (1.0 - smoothstep(0.85, 1.0, r));
      gl_FragColor = vec4(vCol * a * vA, 1.0);
    }`;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const cloud = new THREE.Points(geo, mat); cloud.frustumCulled = false; scene.add(cloud);

  // ---------- 蒸汽：冷却塔顶与塔顶阀组旁的粒子，随时间上升、扩散、变淡 ----------
  const SOURCES = [
    ...FACILITY.towers.map(({ c, s }) => ({ p: [c[0], 7.6 * s, c[2]], r: 1.5 * s, spread: 0.8, rise: 1.6, drift: [0.8, 0, 0.2], n: 1400, size: [0.6, 2.2], k: 0.016 })),
    { p: FACILITY.vent, r: 0.22, spread: 5, rise: 0.45, drift: [0.4, 0, 0.05], n: 1400, size: [0.4, 1.6], k: 0.007 },
  ];
  const SN = SOURCES.reduce((a, s) => a + s.n, 0), SR = rng(77);
  const seeds = []; SOURCES.forEach((s, si) => { for (let i = 0; i < s.n; i++) seeds.push([si, SR(), SR() * Math.PI * 2, SR(), SR()]); });
  const sPos = new Float32Array(SN * 3), sCol = new Float32Array(SN * 3), sSize = new Float32Array(SN), sKind = new Float32Array(SN).fill(5), sUnit = new Float32Array(SN).fill(15);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  sGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1)); sGeo.setAttribute('kind', new THREE.BufferAttribute(sKind, 1));
  sGeo.setAttribute('unit', new THREE.BufferAttribute(sUnit, 1));
  const steam = new THREE.Points(sGeo, mat); steam.frustumCulled = false; scene.add(steam);
  function updateSteam(t, amount = 1) {
    seeds.forEach(([si, ph, ang, rr, w], i) => {
      const s = SOURCES[si], life = 6, age = ((t / life + ph) % 1), e = age * life;
      // 越飘越散：半径随时间扩大，每个粒子的漂移速度略有不同
      const r = s.r * Math.sqrt(rr) * (1 + age * s.spread), dv = 0.6 + w * 0.8;
      const x = s.p[0] + Math.cos(ang) * r + s.drift[0] * e * dv + Math.sin(e * 0.9 + w * 6) * 0.25 * age;
      const y = s.p[1] + s.rise * e * (1 - age * 0.35) * (0.7 + rr * 0.6) + Math.sin(e * 0.7 + w * 4) * 0.12 * (1 + age * 2);
      const z = s.p[2] + Math.sin(ang) * r + s.drift[2] * e * dv;
      sPos.set([x, y, z], i * 3);
      const fade = Math.sin(Math.PI * Math.min(1, age * 1.15)) * s.k * amount;
      sCol.set([0.75 * fade, 0.85 * fade, 1.0 * fade], i * 3);
      sSize[i] = s.size[0] + (s.size[1] - s.size[0]) * age;
    });
    sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true; sGeo.attributes.size.needsUpdate = true;
  }

  // ---------- 扫描光面 ----------
  const planeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    // 垂直于 x 轴的光面：上下与前后边缘渐隐，贴地处一条亮线
    fragmentShader: `varying vec2 vUv; uniform float uA;
      void main(){ float zf = smoothstep(0.0, 0.2, vUv.x) * (1.0 - smoothstep(0.8, 1.0, vUv.x));
        float v = 1.0 - smoothstep(0.0, 0.9, vUv.y);
        float floorLine = exp(-pow(vUv.y * 70.0, 2.0));
        gl_FragColor = vec4(vec3(0.45, 0.8, 1.0) * (0.09 * v + floorLine * 0.9) * zf * uA, 1.0); }`,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), planeMat);
  plane.rotation.y = Math.PI / 2; plane.position.set(0, 8, -8);
  const planeGroup = new THREE.Group(); planeGroup.add(plane); scene.add(planeGroup);

  // ---------- 对外接口 ----------
  function setCamera(pos, look, fov = 30) {
    cam.fov = fov; cam.aspect = W / H; cam.updateProjectionMatrix();
    cam.position.set(...pos); cam.lookAt(...look); cam.updateMatrixWorld();
    uniforms.uPix.value = H / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  }
  // units：各设备的点亮程度（下标见上方 unit 编号：1–2 冷却塔，3–5 精馏塔，6–8 球罐，9 烟囱，10 钢结构，11 栈桥，12 输电塔）
  function update({ t = 0, scan = 99, scanGlow = 0, steamAmount = 1, targetMix = 0, glare = 1, bright = 1, fog = [20, 70], units = [],
    flat = 0, flatCam = null, flatAt = FACILITY.target, reveal = null } = {}) {
    const u = uniforms.uUnit.value; for (let i = 0; i < 16; i++) u[i] = units[i] || 0;
    uniforms.uFlat.value = flat;
    if (flat > 0 && flatCam) {
      uniforms.uFlatC.value.copy(flatCam.position);
      uniforms.uFlatN.value.set(0, 0, -1).applyQuaternion(flatCam.quaternion);
      uniforms.uFlatP.value.set(...flatAt);
    }
    uniforms.uRevR.value = reveal ? reveal.r : 999;
    if (reveal) uniforms.uRevC.value.set(...reveal.c);
    uniforms.uTime.value = t; uniforms.uScan.value = scan; uniforms.uTargetMix.value = targetMix; uniforms.uGlare.value = glare;
    uniforms.uBright.value = bright; uniforms.uFogNear.value = fog[0]; uniforms.uFogFar.value = fog[1];
    planeGroup.position.x = scan; planeMat.uniforms.uA.value = scanGlow; planeGroup.visible = scanGlow > 0.001;
    updateSteam(t, steamAmount);
  }
  function render(viewport = null, camera = cam) {
    renderer.setScissorTest(!!viewport); renderer.setClearColor(0, 0);
    if (!viewport) { renderer.setViewport(0, 0, W, H); renderer.clear(); }
    else {
      const glv = [viewport[0], H - viewport[1] - viewport[3], viewport[2], viewport[3]];
      renderer.setViewport(...glv); renderer.setScissor(...glv); renderer.clear();
    }
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    return canvas;
  }
  const project = (v, camera = cam, vp = [0, 0, W, H]) => {
    const p = V3(...v).project(camera);
    return [vp[0] + (p.x + 1) / 2 * vp[2], vp[1] + (1 - p.y) / 2 * vp[3]];
  };
  // 立方体八个角投影后的屏幕包围框 [x0, y0, x1, y1]
  const projectBox = ([a, b], camera = cam, vp) => {
    const pts = [];
    for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) pts.push(project([x, y, z], camera, vp));
    return [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
  };
  const ortho = (dir, up, half = [16, 9], look = [2, 4, -5]) => {
    const c = new THREE.OrthographicCamera(-half[0], half[0], half[1], -half[1], 0.1, 200);
    c.position.set(look[0] + dir[0] * 60, look[1] + dir[1] * 60, look[2] + dir[2] * 60); c.up.set(...up); c.lookAt(...look); c.updateMatrixWorld(); return c;
  };
  const setPix = () => { uniforms.uPix.value = H / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))); };
  const clear = () => { renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.setClearColor(0, 0); renderer.clear(); };
  const dispose = () => { geo.dispose(); sGeo.dispose(); mat.dispose(); renderer.dispose(); renderer.forceContextLoss(); };
  return { canvas, cam, setCamera, setPix, update, render, clear, dispose, project, projectBox, ortho, count: N + SN, THREE };
}
