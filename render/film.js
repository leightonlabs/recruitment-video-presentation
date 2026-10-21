// 粗剪主程序：读取分镜数据，按全片时间找到镜头与拍，调用对应场景绘制画面，并按 text 字段排版文字层。
import { makeScenes2D } from './scenes2d.js';
import { makeScenes3D } from './scenes3d.js';
import { seg, easeOut, applyTheme, setNow, THEME } from './draw.js';

const getJSON = async url => (await fetch(url)).json();
const loadImage = url => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });

// 主题：?theme=vibrant（默认，动感科技蓝）或 classic（原深蓝纯色）；?clean=1 去掉审阅信息条
const params = new URLSearchParams(location.search);
applyTheme(params.get('theme') || 'vibrant');
document.body.classList.add(THEME.name);
const story = await getJSON('../docs/03-分镜数据.json');
const heroA = await getJSON('../build/assets/hero_anchors.json');
const hero = await loadImage('../build/assets/hero.png');
await Promise.all(['400 20px NS', '700 20px NS', '900 20px NS', '400 20px JB', '700 20px JB', '400 20px LC'].map(f => document.fonts.load(f, '字A1')));

const FPS = story.format.fps;
const ctx = document.getElementById('stage').getContext('2d');
const env = { story, hero, heroA, anchors: {}, FPS };
const S3 = await makeScenes3D(env);
const SCENES = { ...makeScenes2D(env, S3), ...S3.scenes };

// ---------- 文字层 ----------
// 各镜的版面区域：x、y 为锚点，align / vAlign 决定对齐方式，gap 为同一区域内多条文字的间距
const DEFAULT_ZONES = {
  'top-left': { x: 128, y: 96 },
  title: { x: 128, y: 160 },
  center: { x: 960, y: 540, align: 'center', vAlign: 'middle' },
  'center-left': { x: 128, y: 540, vAlign: 'middle', w: 1600 },
  'bottom-left': { x: 128, y: 1030, vAlign: 'bottom' },
  'lower-third': { x: 128, y: 780 },
  left: { x: 128, y: 540, vAlign: 'middle' },
  right: { x: 1500, y: 700 },
  panel: { x: 128, y: 540, vAlign: 'middle' },
};
const SHOT_ZONES = {
  S01: { 'lower-third': { x: 128, y: 880 } },
  S03: { center: { x: 960, y: 520, align: 'center', vAlign: 'middle', gap: 26 } },
  S04: { title: { x: 128, y: 150 }, fact_1: { x: 1090, y: 448 }, fact_2: { x: 1090, y: 588 }, fact_3: { x: 1090, y: 728 } },
  S05: Object.assign({ center: { x: 960, y: 800, align: 'center' } },
    ...[0, 1, 2, 3, 4].map(i => ({ [`tile_${i + 1}`]: { x: 278 + i * 341, y: 660, align: 'center' } }))),
  S06: { panel_1: { x: 128, y: 246 }, panel_2: { x: 704, y: 246 }, panel_3: { x: 1280, y: 246 } },
  S07: { 'right-panel': { x: 1290, y: 420, w: 520 } },
  S08: { 'lower-third': { x: 960, y: 720, align: 'center' }, _claim: ['doc', 'center'] },
  S10: { center: { x: 960, y: 1000, align: 'center', vAlign: 'bottom' } },
  S11: { _claim: ['editor'] },
  S12: { _claim: ['board', 'card'] },
  S13: { _claim: ['panels'] },
  S14: { _claim: ['sticky'] },
  S15: { _claim: ['board'] },
  S16: { center: { x: 960, y: 870, align: 'center' }, _claim: ['card_1', 'card_2', 'card_3', 'card_4'] },
  S17: { lane_1: { x: 250, y: 398 }, node_1: { x: 1150, y: 318 }, node_2: { x: 1150, y: 458 }, node_3: { x: 1150, y: 598 }, lane_2: { x: 250, y: 740, w: 1400 } },
  S18: { card: { x: 260, y: 232, gap: 300, cls: 'light' }, _claim: ['grid'], _claimStyle: ['stat'] },
  S19: { header: { x: 128, y: 92 }, card_a: { x: 170, y: 640, w: 720, gap: 14 }, card_b: { x: 1032, y: 640, w: 720, gap: 14 } },
  S20: { panel: { x: 110, y: 540, vAlign: 'middle', w: 560, gap: 18 } },
  S21: { panel: { x: 96, y: 540, vAlign: 'middle', w: 664, gap: 16 } },
  S23: { 'center-left': { x: 128, y: 540, vAlign: 'middle', w: 1720 } },
  S22: { 'lower-third': { x: 200, y: 700, gap: 20 }, _claim: ['timeline'] },
  S24: { left: { x: 128, y: 300, gap: 22 }, right: { x: 1300, y: 668, gap: 12 } },
};
const txt = document.getElementById('txt');
let current = null; // { id, items: [{ el, item }], zones: { name: el } }

function zoneConfig(shotId, zone) {
  const z = SHOT_ZONES[shotId] || {};
  return z[zone] || DEFAULT_ZONES[zone] || null;
}
function placeZone(el, cfg) {
  const tx = cfg.align === 'center' ? '-50%' : cfg.align === 'right' ? '-100%' : '0';
  const ty = cfg.vAlign === 'middle' ? '-50%' : cfg.vAlign === 'bottom' ? '-100%' : '0';
  el.style.left = `${cfg.x}px`; el.style.top = `${cfg.y}px`;
  el.style.transform = `translate(${tx},${ty})`;
  el.style.alignItems = cfg.align === 'center' ? 'center' : cfg.align === 'right' ? 'flex-end' : 'flex-start';
  el.style.textAlign = cfg.align || 'left';
  el.style.gap = `${cfg.gap ?? 10}px`;
  if (cfg.w) el.style.maxWidth = `${cfg.w}px`;
}
function buildText(shot) {
  txt.innerHTML = '';
  const conf = SHOT_ZONES[shot.id] || {};
  const claims = new Set(conf._claim || []), claimStyles = new Set([...(conf._claimStyle || []), 'code']);
  const zones = {}, items = [];
  for (const item of shot.text || []) {
    if (claims.has(item.zone) || claimStyles.has(item.style)) continue;
    let z = zones[item.zone];
    if (!z) {
      z = zones[item.zone] = document.createElement('div');
      z.className = 'zone';
      if (item.zone.startsWith('anchor:')) {
        z.style.transform = 'translate(0,-100%)';
        if (['anchor:glare', 'anchor:polygon_b'].includes(item.zone)) z.classList.add('amber');
      } else {
        const cfg = zoneConfig(shot.id, item.zone) || DEFAULT_ZONES['top-left'];
        placeZone(z, cfg);
        if (cfg.cls) z.classList.add(cfg.cls);
      }
      txt.appendChild(z);
    }
    const el = document.createElement('div');
    el.className = `t t-${item.style}`;
    el.textContent = item.content;
    z.appendChild(el);
    items.push({ el, item, zone: item.zone });
  }
  current = { id: shot.id, items, zones };
}
function updateText(shot, t) {
  if (!current || current.id !== shot.id) buildText(shot);
  const sd = shot.end - shot.start;
  for (const { el, item } of current.items) {
    const [a, b] = item.t;
    let k = 0;
    if (t >= a && t <= b) {
      k = easeOut(seg(t, a, a + 0.45));
      if (b < sd - 0.05) k *= 1 - seg(t, b - 0.25, b);
    }
    el.style.opacity = k.toFixed(3);
    el.style.transform = `translateY(${((1 - k) * 14).toFixed(1)}px)`;
  }
  for (const [name, z] of Object.entries(current.zones)) {
    if (!name.startsWith('anchor:')) continue;
    const p = env.anchors[name.slice(7)];
    z.style.display = p ? 'flex' : 'none';
    if (p) { z.style.left = `${p[0]}px`; z.style.top = `${p[1]}px`; }
  }
}

// ---------- 审阅信息条 ----------
const ROUTE = { G: '代码', I: 'AI静帧(占位)', A: 'AI视频(占位)', R: '实拍' };
const rev = document.getElementById('rev');
if (params.get('clean')) rev.style.display = 'none';
const clock = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

// ---------- 逐帧入口 ----------
const shots = story.shots;
window.seekFrame = f => {
  const T = f / FPS;
  const shot = shots.find(s => T >= s.start && T < s.end) || shots[shots.length - 1];
  const t = T - shot.start;
  const bi = Math.max(0, shot.beats.findIndex(b => t >= b.t[0] && t < b.t[1]));
  const beat = shot.beats[bi];
  env.anchors = {};
  setNow(T);
  ctx.save();
  ctx.clearRect(0, 0, 1920, 1080);
  const scene = beat.src === 'A' ? 'plate' : beat.scene;
  (SCENES[scene] || SCENES.missing)(ctx, { shot, beat, bi, t, tb: t - beat.t[0], bd: beat.t[1] - beat.t[0], sd: shot.end - shot.start, scene });
  ctx.restore();
  updateText(shot, t);
  rev.textContent = `粗剪 v4 ｜ ${shot.id} ｜ ${clock(T)} ｜ ${ROUTE[beat.src]}${beat.optional ? '·可选' : ''}`;
  return true;
};
window.seekFrame(0);
window.ready = true;
