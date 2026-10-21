// 一键生成：依赖检查 → 字体 → 分镜校验 → 占位主图 → 逐帧画面 → 临时音轨 → 字幕 → 合成成片。Windows、macOS、Linux 通用。
//
// 用法（在仓库根目录执行）：
//   node render/build.mjs [并行数]           粗剪：带审阅信息条与旁白提示音，输出 1080p 与 720p 预览版
//   node render/build.mjs --clean [并行数]   精修版：去掉审阅与测试信息，只输出高码率 1080p
// 并行数默认 4（每个进程是一个无头浏览器）；也可用环境变量 CLEAN=1 代替 --clean，THEME=classic 切换为原深蓝纯色风格。
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFonts } from './fonts.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const CLEAN = argv.includes('--clean') || !!process.env.CLEAN;
const WORKERS = Number(argv.find(a => /^\d+$/.test(a))) || 4;
const WIN = process.platform === 'win32';
const env = { ...process.env, CLEAN: CLEAN ? '1' : '', VO_GUIDE: CLEAN ? '0' : '1' };

function run(cmd, args, { cwd = ROOT, shell = false } = {}) {
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell });
  if (r.error) throw new Error(`无法运行 ${cmd}：${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败（退出码 ${r.status}）`);
}
const works = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'ignore' }); return !r.error && r.status === 0; };
const fail = msg => { console.error(`\n✗ ${msg}`); process.exit(1); };

// ---------- 依赖检查 ----------
const PY = ['python3', 'python', 'py'].find(p => works(p, ['-c', 'import numpy']));
if (!PY) fail('需要 Python 3 与 numpy：安装 Python 后运行 pip install numpy');
if (!works('ffmpeg', ['-version'])) fail('需要 FFmpeg：请安装并把 ffmpeg 加入 PATH');
const filters = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout || '';
if (!/\bass\b/.test(filters)) fail('当前 FFmpeg 不含 libass，无法烧录字幕：请换用完整版 FFmpeg');
if (!existsSync(join(ROOT, 'render/node_modules/three')) || !existsSync(join(ROOT, 'render/node_modules/playwright'))) {
  console.log('安装 Node 依赖（three.js、Playwright）…');
  run('npm', ['install'], { cwd: join(ROOT, 'render'), shell: WIN });
}

// ---------- 渲染 ----------
const OUT = 'build/roughcut';
const NAME = CLEAN ? 'build/精修版-150秒-1080p' : 'build/粗剪-v4-150秒';
const t0 = Date.now();
console.log(`== ${CLEAN ? '精修版' : '粗剪'}，${WORKERS} 个进程并行 ==`);
try {
  fetchFonts(ROOT);
  run(PY, ['tools/storyboard.py', 'check']);
  run(process.execPath, ['render/render.mjs', 'hero']);
  run(process.execPath, ['render/render.mjs', 'video', String(WORKERS)]);
  run(PY, ['render/audio.py']);
  run(PY, ['tools/storyboard.py', 'srt', `${OUT}/subs.srt`]);
  run(PY, ['render/subs.py', `${OUT}/subs.srt`, `${OUT}/subs.ass`]);
  console.log('合成成片…');
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}/video.mp4`, '-i', `${OUT}/audio.wav`,
    '-vf', `ass=${OUT}/subs.ass:fontsdir=build/fonts`,
    '-c:v', 'libx264', '-preset', CLEAN ? 'slow' : 'medium', '-crf', CLEAN ? '16' : '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', `${NAME}.mp4`]);
  if (!CLEAN) {
    run('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${NAME}.mp4`, '-vf', 'scale=1280:720',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', `${NAME}-720p.mp4`]);
  }
} catch (e) {
  fail(e.message);
}
console.log(`\n✓ 完成（${((Date.now() - t0) / 60000).toFixed(1)} 分钟）→ ${NAME}.mp4${CLEAN ? '' : `、${NAME}-720p.mp4`}`);
