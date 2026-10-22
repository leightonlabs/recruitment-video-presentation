# 粗剪渲染

按 [分镜数据](../docs/03-分镜数据.json) 逐帧渲染 150 秒粗剪，用于审节奏、版式与文字。所有画面、文字和时间都从分镜数据读取：改了 JSON 后重新运行即可，不需要改代码。

## 在自己的电脑上渲染

Windows、macOS、Linux 都可以运行。

### 1. 安装依赖（只需一次）

| 软件 | 版本 | 安装方式 |
|---|---|---|
| Node.js | 18 或更高（推荐 22） | 从 nodejs.org 下载安装 |
| Python | 3.9 或更高，带 numpy | 从 python.org 下载安装后运行 `pip install numpy` |
| FFmpeg | 需含 libass（用于烧录字幕） | Windows：从 gyan.dev 下载 full 版并把 `bin` 目录加入 PATH；macOS：`brew install ffmpeg`；Ubuntu：`sudo apt install ffmpeg` |
| Git | 任意 | 用于下载仓库 |

### 2. 下载代码并安装 Node 依赖

```bash
git clone https://github.com/leightonlabs/recruitment-video-presentation.git
cd recruitment-video-presentation
git checkout ccr-05214547-mww7wc        # 合并到 main 之后可省略
cd render
npm install                             # 安装 three.js 与 Playwright
npx playwright install chromium         # 下载渲染用的浏览器（约 150MB）；已装 Chrome 或 Edge 可跳过
cd ..
```

### 3. 渲染

```bash
node render/build.mjs --clean           # 精修版：去掉审阅与测试信息，输出 build/精修版-150秒-1080p.mp4
node render/build.mjs                   # 粗剪：带审阅信息条与旁白提示音，另出 720p 预览版
node render/build.mjs --clean 8         # 末尾数字为并行进程数，默认 4；CPU 核数多可以调大
node render/build.mjs --clean --no-music   # 不放配乐，音轨只保留音效
```

4 个进程约需 40 分钟（视 CPU 而定），渲染过程中会打印各进程进度。macOS、Linux 也可以用 `./render/build.sh`、`CLEAN=1 ./render/build.sh`，效果相同。

### 在 GitHub 上渲染并发布到 Releases

不想在本机安装软件时，可以让 GitHub 的服务器渲染：仓库页面 → Actions → “渲染视频并发布” → Run workflow（流程定义见 `.github/workflows/render-video.yml`，需先合并到默认分支）。约 45–90 分钟后，成片会作为附件出现在 Releases 的 `video-150s` 标签下；再次运行会覆盖原附件。

### 在国内网络下

- **字体：** 脚本先从 Google Fonts 下载，连不上时自动改用国内镜像 fonts.loli.net。两处都连不上时，可以手动下载 Noto Sans SC（400、700、900）、JetBrains Mono（400、700）、Long Cang，按 `NotoSansSC-400.ttf` 这样的文件名放进 `build/fonts`。
- **npm：** 安装慢时先运行 `npm config set registry https://registry.npmmirror.com`。
- **numpy：** `pip install numpy -i https://pypi.tuna.tsinghua.edu.cn/simple`。
- **浏览器：** `npx playwright install chromium` 下载失败时可以跳过；脚本会自动改用电脑上已安装的 Chrome 或 Edge（Windows 自带 Edge）。也可以用环境变量 `BROWSER=chrome` 或 `BROWSER=msedge` 指定。

输出（`build/` 目录不入库）：

| 文件 | 说明 |
|---|---|
| `build/粗剪-v4-150秒.mp4` | 1920×1080、25 帧/秒，带临时音轨与字幕 |
| `build/粗剪-v4-150秒-720p.mp4` | 1280×720 预览版，便于转发 |
| `build/精修版-150秒-1080p.mp4` | `--clean` 时输出：1920×1080、CRF 16；无审阅信息条，视频占位卡只保留“视频占位”与画面内容说明（不显示资产编号、时长、运镜与进度条），音轨为配乐与音效（不含旁白提示音） |
| `build/roughcut/` | 中间文件：无声画面、配乐、音效、旁白提示音、字幕 |

单独渲染审阅静帧或样片：

```bash
node render/render.mjs stills 2.4,30,61 build/review   # 参数为全片秒数
node render/render.mjs sample "15-24,104-110" build/样片.mp4   # 截取若干时间段拼成样片，带音轨与字幕（需先完整渲染过一次）
SUBS=0 CLEAN=1 node render/render.mjs sample "138-150" build/片尾.mp4   # 不烧字幕、无审阅信息条
node render/render.mjs preview all build/preview   # 改版预览画面（数字孪生能源场站，preview.html），待确认后接入正片
```

## 画面风格

环境变量 `THEME` 切换两套风格，`CLEAN=1` 去掉审阅信息条：

| 取值 | 风格 | 背景 | 其他元素 |
|---|---|---|---|
| `vibrant`（默认） | 动感科技蓝：深蓝到宝蓝渐变 | 缓慢漂移的极光光团、每 7 秒一次的斜向扫光、向远处流动的透视网格、上下边带的流光线、带景深视差的发光粒子 | 玻璃质感面板，描边为中性白渐变；强调色为柔和的天青（不用高饱和荧光青，发光减弱），只用于线条、图标与文字，不用作边框；连线上有流动光点，节点轻微呼吸发光；数字为实色白 |
| `classic` | 原深蓝纯色 | 纯色加点阵 | 实色面板，青色线条与文字 |

背景动画按全片时间计算，跨镜头连续不跳变；有文字的画面，流光线只出现在上下边带，不从文字后面穿过。点云、主图等内容较多的画面，背景自动减弱（光斑减半、无网格、流光线减少）。

```bash
THEME=classic node render/build.mjs             # 按原风格出全片
THEME=vibrant CLEAN=1 node render/render.mjs sample "15-24,143-150" build/样片.mp4
```

## 粗剪里的占位

| 内容 | 粗剪中的处理 | 正式版替换为 |
|---|---|---|
| AI 视频底板（A 路线） | 带资产编号、画面描述与取用时长的占位卡，背景按运镜方式缓动 | 按 [提示词表](../docs/07-AI生成提示词.md) 生成的视频 |
| 同类样本图 | 由数字孪生场站从不同方位、远近与蒸汽量取景 | 公司可公开的样本图（可选） |
| 旁白 | 与每句旁白音节数一致的提示音，标出位置与语速 | 正式配音 |
| 配乐与音效 | 按 `music` 与 `audio` 字段合成的临时声音 | 授权配乐与音效 |
| 投递二维码 | 已使用公司提供的二维码：按原链接重新生成模块矩阵（`render/qr.json`），逐格绘制保证清晰；文件缺失时显示虚线占位框 | — |

右上角的审阅信息条显示粗剪版本、镜号、时间码和当前画面的制作路线，便于按时间点提修改意见；`--clean` 时去掉。

字幕由 `tools/storyboard.py srt` 按标点切分：每行不超过 16 字，句号、问号、叹号处必须断行，不跨句合并，行尾不留逗号和句号。

## 文件

| 文件 | 作用 |
|---|---|
| `film.html`、`film.js` | 时间轴、文字层（读取各镜 `text` 字段排版）与审阅信息条 |
| `scenes2d.js` | 二维场景：AI 占位卡、场景工作台、信息图、岗位卡、片尾 |
| `scenes3d.js` | 三维场景：片头扫描显现与设备识别、主图化为三维、环绕框定、场景生长、三视图 |
| `draw.js` | 两套主题色、动态背景、缓动、描线、面板、文字等通用绘图工具 |
| `facility.js` | 数字孪生能源场站：程序生成的装置区光点模型、扫描显现、设备点亮、蒸汽、压平与由近及远显现、屏幕投影 |
| `plant.js` | 夜空背景、片头镜头路线、两倍分辨率场站主图（标注区域由投影得到）与同类样本图 |
| `preview.html`、`preview.js` | 改版预览：渲染新方案的关键画面（`render.mjs preview`） |
| `render.mjs` | 无头浏览器逐帧截图与并行编码；也可单独渲染静帧与样片 |
| `audio.py`、`subs.py` | 临时音轨合成与字幕转换 |
| `build.mjs` | 一键生成（跨平台）：依赖检查、字体、校验、渲染、音轨、字幕、合成 |
| `fonts.mjs` | 下载字体，Google Fonts 连不上时改用国内镜像 |
| `build.sh` | 转给 `build.mjs`，兼容旧用法 |

## 已知简化

- 镜头之间以硬切为主，S01→S02 缩入工作台、S23 放大回到主图等关键转场已做，其余转场待正式剪辑细化。
- 9:16 竖版与 30 秒精简版尚未渲染。
- 三维粒子转场的飞行轨迹需在 AI 主图定稿后按实际画面精调。
