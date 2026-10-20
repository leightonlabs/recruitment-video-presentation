// 粗剪渲染器：用无头 Chromium 打开 film.html，按帧调用 seekFrame() 截图，再交给 FFmpeg 编码。
//
// 用法（在仓库根目录执行）：
//   node render/render.mjs hero                          渲染占位主图与坐标 → build/assets/
//   node render/render.mjs stills <秒,秒,...> <输出目录>    渲染指定时刻的审阅静帧
//   node render/render.mjs video [并行数]                 渲染全片画面 → build/roughcut/video.mp4
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, resolve } from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const STORY = JSON.parse(await readFile(join(ROOT, 'docs/03-分镜数据.json'), 'utf8'));
const FPS = STORY.format.fps;
const TOTAL = Math.round(STORY.format.duration_s * FPS);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };

function serve() {
  const server = createServer(async (req, res) => {
    try {
      const path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!path.startsWith(ROOT)) throw new Error('forbidden');
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
      res.end(await readFile(path));
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'];

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('页面错误：', e.message));
  await page.goto(url);
  await page.waitForFunction('window.ready === true', null, { timeout: 120000 });
  return page;
}

async function hero(base) {
  const browser = await chromium.launch({ args: ARGS });
  const page = await openPage(browser, `${base}/render/hero.html`);
  await mkdir(join(ROOT, 'build/assets'), { recursive: true });
  await page.screenshot({ path: join(ROOT, 'build/assets/hero.png') });
  const anchors = await page.evaluate(() => window.HERO_ANCHORS);
  await writeFile(join(ROOT, 'build/assets/hero_anchors.json'), JSON.stringify(anchors, null, 2));
  await browser.close();
  console.log('占位主图 → build/assets/hero.png、hero_anchors.json');
}

async function stills(base, times, outDir) {
  const browser = await chromium.launch({ args: ARGS });
  const page = await openPage(browser, `${base}/render/film.html`);
  await mkdir(outDir, { recursive: true });
  for (const t of times) {
    const f = Math.min(TOTAL - 1, Math.round(t * FPS));
    await page.evaluate(n => window.seekFrame(n), f);
    await page.screenshot({ path: join(outDir, `${String(f).padStart(4, '0')}.png`) });
  }
  await browser.close();
  console.log(`${times.length} 张静帧 → ${outDir}`);
}

async function renderRange(base, from, to, out, tag) {
  const browser = await chromium.launch({ args: ARGS });
  const page = await openPage(browser, `${base}/render/film.html`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), out]);
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    await page.evaluate(n => window.seekFrame(n), f);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise(ok => ff.stdin.once('drain', ok));
    if ((f - from) % 250 === 0) console.log(`[${tag}] 帧 ${f}/${to - 1}`);
  }
  ff.stdin.end();
  await new Promise(ok => ff.on('close', ok));
  await browser.close();
  console.log(`[${tag}] 完成 ${to - from} 帧，${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
}

async function video(base, workers) {
  const dir = join(ROOT, 'build/roughcut');
  await mkdir(dir, { recursive: true });
  const step = Math.ceil(TOTAL / workers);
  const parts = [];
  for (let i = 0; i < workers; i++) {
    const from = i * step, to = Math.min(TOTAL, from + step);
    if (from < to) parts.push({ from, to, out: join(dir, `part${i}.mp4`), tag: `进程${i + 1}` });
  }
  await Promise.all(parts.map(p => renderRange(base, p.from, p.to, p.out, p.tag)));
  const list = join(dir, 'parts.txt');
  await writeFile(list, parts.map(p => `file '${p.out}'`).join('\n'));
  await new Promise((ok, fail) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', join(dir, 'video.mp4')])
    .on('close', c => (c ? fail(new Error('拼接失败')) : ok())));
  for (const p of parts) await rm(p.out);
  await rm(list);
  console.log(`画面 → build/roughcut/video.mp4（${TOTAL} 帧）`);
}

const [mode, a, b] = process.argv.slice(2);
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
try {
  if (mode === 'hero') await hero(base);
  else if (mode === 'stills') await stills(base, a.split(',').map(Number), resolve(b));
  else if (mode === 'video') await video(base, Number(a) || 4);
  else console.log('用法：node render/render.mjs hero | stills <秒,...> <目录> | video [并行数]');
} finally {
  server.close();
}
