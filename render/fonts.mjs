// 下载渲染所需字体（均为 SIL OFL 1.1），保存到 build/fonts。先试 Google Fonts，连不上时改用国内镜像 fonts.loli.net。
// 用系统自带的 curl 下载（Windows 10 及以上、macOS、Linux 都有），会沿用 HTTPS_PROXY 等代理设置。
// 已存在的字体文件不会重复下载；无法联网时，可手动把同名 .ttf 文件放进 build/fonts。
//
// 单独运行：node render/fonts.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FAMILIES = [ // 查询参数、文件名前缀、字重（与样式表中字体文件的顺序一致）
  ['Noto+Sans+SC:wght@400;700;900', 'NotoSansSC', [400, 700, 900]],
  ['JetBrains+Mono:wght@400;700', 'JetBrainsMono', [400, 700]],
  ['Long+Cang', 'LongCang', [400]],
];
const HOSTS = ['https://fonts.googleapis.com', 'https://fonts.loli.net'];
const curl = args => spawnSync('curl', ['-fsSL', '--connect-timeout', '15', '--retry', '2', ...args], { encoding: 'utf8', maxBuffer: 4 << 20 });
const ready = f => existsSync(f) && statSync(f).size > 0;

export function fetchFonts(root) {
  const out = join(root, 'build', 'fonts');
  mkdirSync(out, { recursive: true });
  for (const [query, prefix, weights] of FAMILIES) {
    const files = weights.map(w => join(out, `${prefix}-${w}.ttf`));
    if (files.every(ready)) continue;
    let ok = false;
    for (const host of HOSTS) {
      // 以 curl 作为 User-Agent 请求时，样式表给出的是完整的 TTF 文件
      const css = curl(['-A', 'curl', `${host}/css2?family=${query}`]);
      const urls = css.status === 0 ? css.stdout.match(/https:\/\/[^)]+\.ttf/g) || [] : [];
      if (urls.length < weights.length) continue;
      ok = files.every((f, i) => {
        if (ready(f)) return true;
        const part = `${f}.part`;
        if (curl(['-o', part, urls[i]]).status !== 0) { rmSync(part, { force: true }); return false; }
        renameSync(part, f);
        return true;
      });
      if (ok) break;
    }
    if (!ok) throw new Error(`字体 ${prefix} 下载失败：请检查网络，或手动把 ${weights.map(w => `${prefix}-${w}.ttf`).join('、')} 放进 build/fonts`);
  }
  console.log('字体就绪 → build/fonts');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  fetchFonts(resolve(fileURLToPath(new URL('..', import.meta.url))));
}
