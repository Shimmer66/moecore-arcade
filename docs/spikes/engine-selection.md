# 渲染引擎选型实测

日期：2026-09-20  
工作区：`C:/home/yuki/projects/moecore-arcade-spike`  
分支：`feat/engine-spike`  
base：`281027b29a347a7f542146b54d60ea15a64c7b89`

## 结论

建议选 **PixiJS 8.21.0**，判据是本 PoC 的主要目标：发布包体积、安装增量和最小交互响应。

- PixiJS JS 总体积 `511,217 B`，Phaser `1,382,029 B`，少 `870,812 B`。
- PixiJS 按 `gzip -9 -c` 的 JS 总和 `150,948 B`，Phaser `354,967 B`，少 `204,019 B`。
- PixiJS `node_modules` 已分配空间增量 `89,207,808 B`，Phaser `122,013,696 B`。
- PixiJS dev server ready 三次中位数 `0.7464774 s`，Phaser `0.7541418 s`，两者基本相当。
- PixiJS 点击到重绘完成为 `0.6 / 0.6 / 0.7 ms`，Phaser 为 `13.5 / 8.7 / 3.3 ms`。

不选 Phaser 的主要原因是包体和安装成本明显更高，不是因为 Phaser 无法完成 PoC。Phaser 的场景、游戏循环和输入对象模型更完整，接入时少写约 8 行适配代码；如果后续需求优先是大量内置游戏能力、场景编排或物理集成，这个取舍需要重新评估。

这是固定 8×8 纯色棋盘的 PoC 结论，不代表复杂场景、动画、音频、物理或真实移动设备上的性能结论。

## 可复跑命令

所有命令从工作根执行。首次安装按任务要求使用普通 `pnpm install`：

```powershell
pnpm install
pnpm run build
node apps/web/spike-tools/measure.mjs baseline
node apps/web/spike-tools/measure.mjs phaser 4.2.1
```

每轮脚本会执行并记录：

```text
pnpm --filter @moecore/web add --save-exact <engine>@<version>
pnpm run build
pnpm run dev --port <free-port> --strictPort --force   # 3 次
pnpm run preview --port <free-port> --strictPort
pnpm --filter @moecore/web remove <engine>
```

为了让第二轮的 `node_modules` 安装增量从无引擎基线开始，第一轮结束后删除当前工作区生成的 `node_modules`，再执行普通安装：

```powershell
node --input-type=module -e "import { rm } from 'node:fs/promises'; import { isAbsolute, relative, resolve, sep } from 'node:path'; const root = resolve('.'); const target = resolve(root, 'node_modules'); const rel = relative(root, target); if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep) || target === root) throw new Error('Refusing target: ' + target); await rm(target, { recursive: true, force: true });"
pnpm install
node apps/web/spike-tools/measure.mjs pixi 8.21.0
node apps/web/spike-tools/measure.mjs cost
```

测量脚本同时保存 JSON 和命令原始输出：

- `docs/spikes/results/baseline.json`
- `docs/spikes/results/phaser.json`
- `docs/spikes/results/pixi.json`
- `docs/spikes/results/*-add.txt`
- `docs/spikes/results/*-build.txt`
- `docs/spikes/results/*-dev-*.txt`
- `docs/spikes/results/*-preview-0.txt`
- `docs/spikes/results/*-remove.txt`

`phaser.json` 和 `pixi.json` 中还保存了安装前后文件系统数据、锁文件行数、浏览器版本、导航计时、GPU renderer、棋盘哈希和 QA 结果。

## 测量协议

- 规则直接复用 `@moecore/game-match3/rules` 的 `createBoard` 和 `createRandomSource`，未复制规则代码。
- 固定 seed：`engine-selection-2026-09-20`。
- 固定配置：`prototypeConfig` 的 8×8 棋盘，384×384 backing canvas，48px 格子，纯色块，选中颜色 `0xffffff`。
- Phaser 和 PixiJS 都明确使用 WebGL 1、DPR 1、关闭抗锯齿、`high-performance` power preference。
- 两轮执行同一条根目录构建命令：`pnpm run build`。
- 包体积是 `apps/web/dist/assets/*.js` 每个文件的原始字节数，以及：
  `gzip -9 -c <file> | wc -c`。
- 同时记录 `gzip -9 -n -c` 和 Vite 内置 gzip 值。报告主表只采用用户指定的 `gzip -9 -c` 口径。
- 安装增量使用 `du -sh node_modules`、`du -s -B1 node_modules`、`du -sb node_modules`
  和 `wc -l pnpm-lock.yaml`。`du -sh` 是人类可读的四舍五入值，精确差值同时给出。
- dev server ready 从启动 `pnpm` 子进程前计时，到终端输出该次本地 URL 为止；每轮 3 次，使用不同空闲端口。
- 未清除操作系统文件缓存，dev server ready 不等同于物理冷启动或网络冷启动。
- Playwright 使用本机 Chrome channel，版本 `153.0.8010.48`，headless，DPR 1；
  每个桌面样本使用独立 BrowserContext，禁用 HTTP cache。
- `window.__spikeFirstPaint` 从导航 time origin 的 `performance.now()` 开始，
  在引擎完成绘制后调用 `gl.finish()` 记录。该值是 GPU fence 完成时间，不是浏览器合成器或显示器光子时间。
- `window.__spikeClickLatency` 从 capture 阶段真实 `pointerdown` 开始，经过状态更新、
  重绘和同一 `gl.finish()` 后记录。
- 每轮 3 个桌面鼠标样本用于原始计时；另有 1 个移动触摸 context 做功能 QA。
- 每轮自动检查 64 个格子的像素、全选、取消选中、无横向溢出和无浏览器错误。
- 两轮生成的棋盘哈希均为：
  `20d546b13133bd385b596bfae286d1c2fe490a37ac623b55962d0ddcb8469941`。

## 基线

命令：

```text
pnpm run build
node apps/web/spike-tools/measure.mjs baseline
```

原始 JS 结果：

| 文件                |      字节 | `gzip -9 -c` 字节 | `gzip -9 -n -c` 字节 | Vite gzip |
| ------------------- | --------: | ----------------: | -------------------: | --------: |
| `index-ChCkZAjo.js` |     2,761 |             1,420 |                1,402 |     1,412 |
| **合计**            | **2,761** |         **1,420** |            **1,402** | **1,412** |

这与任务给定的 `2.76 kB / 1.41 kB gzip` 基线一致。`gzip -9 -c` 的文件名头使其比 Vite 展示值多 8 B；两轮均按同一命令测量。

## 轮次 A：Phaser

版本：`phaser@4.2.1`

命令原文：

```text
pnpm --filter @moecore/web add --save-exact phaser@4.2.1
pnpm run build
pnpm run dev --port 57992 --strictPort --force
pnpm run dev --port 55524 --strictPort --force
pnpm run dev --port 55526 --strictPort --force
pnpm run preview --port 55535 --strictPort
pnpm --filter @moecore/web remove phaser
```

### 包体积

| 文件                |          字节 | `gzip -9 -c` 字节 |
| ------------------- | ------------: | ----------------: |
| `index-OQgvHKxS.js` |     1,382,029 |           354,967 |
| **合计**            | **1,382,029** |       **354,967** |

相对基线：`+1,379,268 B` 原始，`+353,547 B` 按指定 gzip 命令。

### 安装增量

| 项目                     |          安装前 |          安装后 |                增量 |
| ------------------------ | --------------: | --------------: | ------------------: |
| `du -sh node_modules`    |          `114M` |          `230M` | `+116M`（人类可读） |
| `du -s -B1 node_modules` | `118,876,160 B` | `240,889,856 B` |    `+122,013,696 B` |
| `du -sb node_modules`    | `109,660,401 B` | `222,265,407 B` |    `+112,605,006 B` |
| `wc -l pnpm-lock.yaml`   |         `1,570` |         `1,585` |               `+15` |

### dev server ready，原始墙钟秒数

```text
run 1: 0.7769705 s
run 2: 0.7541418 s
run 3: 0.7422544 s
```

中位数：`0.7541418 s`。平均值：`0.7577889 s`。

### 首次绘制与点击响应，Playwright 原始值

| 桌面样本 | `window.__spikeFirstPaint` ms | `window.__spikeClickLatency` ms |
| -------: | ----------------------------: | ------------------------------: |
|        1 |          `224.79999999701977` |                          `13.5` |
|        2 |           `92.10000000149012` |             `8.699999995529652` |
|        3 |           `92.39999999850988` |            `3.3000000044703484` |

首绘中位数：`92.39999999850988 ms`。点击中位数：`8.699999995529652 ms`。

### 接入成本与缺失能力

`node apps/web/spike-tools/measure.mjs cost` 的 `wc -l` 原始输出见下节。按 PoC 文件归属：

- Phaser 适配器：`33` 行。
- 共享棋盘入口、规则调用、页面入口、Vite 条件配置：`150` 行。
- Phaser PoC 实现面：`183` 行，不含一次性测量脚本 `423` 行。
- Phaser 已提供：游戏循环、Scene 生命周期、显示对象、输入命中和事件分发。
- 本 PoC 仍自己补：规则数据到显示对象的映射、颜色表、选中状态、宿主挂载和测量仪器。
- 正式接入仍需项目自己定义：游戏宿主生命周期、暂停/恢复、尺寸变化和销毁调用。

## 轮次 B：PixiJS

版本：`pixi.js@8.21.0`

命令原文：

```text
pnpm --filter @moecore/web add --save-exact pixi.js@8.21.0
pnpm run build
pnpm run dev --port 58079 --strictPort --force
pnpm run dev --port 51835 --strictPort --force
pnpm run dev --port 51838 --strictPort --force
pnpm run preview --port 51842 --strictPort
pnpm --filter @moecore/web remove pixi.js
```

### 包体积

| 文件                                   |        字节 | `gzip -9 -c` 字节 |
| -------------------------------------- | ----------: | ----------------: |
| `BufferResource-C37dXpu3.js`           |      11,028 |             2,843 |
| `CanvasPool-BqlnJ8fZ.js`               |     110,191 |            33,067 |
| `CanvasRenderer-CbVUnw5P.js`           |          77 |               107 |
| `CanvasRenderer-DAWkz-DB.js`           |      88,511 |            27,458 |
| `RenderTargetSystem-C1TdrTqk.js`       |      78,088 |            21,857 |
| `WebGLRenderer-CQx2wC1E.js`            |      71,664 |            19,347 |
| `WebGLRenderer-Dq_Dx1Um.js`            |          75 |               105 |
| `WebGPURenderer-B4urfYRD.js`           |          77 |               107 |
| `WebGPURenderer-BKcrlR9l.js`           |      47,896 |            13,648 |
| `browserAll-BgOyVNtM.js`               |      42,650 |            11,066 |
| `canvasUtils-VDRHI1Sg.js`              |       6,055 |             2,076 |
| `getTextureBatchBindGroup-Ddzz0M-K.js` |         344 |               305 |
| `index-D8wUFmxc.js`                    |      14,099 |             5,524 |
| `init-B4y5jvQ3.js`                     |      24,681 |             8,403 |
| `init-DmapiEjX.js`                     |      15,727 |             4,950 |
| `webworkerAll-Ca8cat8K.js`             |          54 |                85 |
| **合计**                               | **511,217** |       **150,948** |

相对基线：`+508,456 B` 原始，`+149,528 B` 按指定 gzip 命令。相对 Phaser 少 `870,812 B` 原始和 `204,019 B` gzip。

### 安装增量

| 项目                     |          安装前 |          安装后 |               增量 |
| ------------------------ | --------------: | --------------: | -----------------: |
| `du -sh node_modules`    |          `114M` |          `199M` | `+85M`（人类可读） |
| `du -s -B1 node_modules` | `118,892,544 B` | `208,100,352 B` |    `+89,207,808 B` |
| `du -sb node_modules`    | `109,660,401 B` | `189,540,377 B` |    `+79,879,976 B` |
| `wc -l pnpm-lock.yaml`   |         `1,570` |         `1,648` |              `+78` |

### dev server ready，原始墙钟秒数

```text
run 1: 0.7464774 s
run 2: 0.7583030 s
run 3: 0.7426726 s
```

中位数：`0.7464774 s`。平均值：`0.7491510 s`。

### 首次绘制与点击响应，Playwright 原始值

| 桌面样本 | `window.__spikeFirstPaint` ms | `window.__spikeClickLatency` ms |
| -------: | ----------------------------: | ------------------------------: |
|        1 |           `293.6000000014901` |            `1.6000000014901161` |
|        2 |           `81.39999999850988` |            `0.6000000014901161` |
|        3 |           `76.30000000447035` |            `0.6999999955296516` |

首绘中位数：`81.39999999850988 ms`。点击中位数：`0.6999999955296516 ms`。

Pixi 适配器关闭自动 ticker，在点击回调中显式 `app.render()`，所以点击值表示同步状态更新到重绘完成。Phaser 使用正常游戏循环，点击值包含等待其下一次游戏渲染循环的时间；两者都使用同一 `gl.finish()` 结束点，这个差异本身是引擎接入模型的一部分，不能解释成纯 GPU 性能差异。

### 接入成本与缺失能力

- Pixi 适配器：`41` 行。
- 共享棋盘入口、规则调用、页面入口、Vite 条件配置：`150` 行。
- Pixi PoC 实现面：`191` 行，不含一次性测量脚本 `423` 行。
- Pixi 已提供：WebGL renderer、display tree、Graphics、事件分发和 ticker。
- 本 PoC 自己补：应用初始化、canvas 挂载、`eventMode` 配置、点击到重绘的调度、显示状态到 Graphics 的重绘。
- Pixi 没有 Phaser 风格的高层 Scene 管理；正式接入需要项目自己定义场景/页面生命周期、暂停/恢复、尺寸变化、销毁和输入更新循环。

## 接入代码行数原始输出

命令：

```text
node apps/web/spike-tools/measure.mjs cost
```

原始 `wc -l`：

```text
   30 apps/web/spike/index.html
    3 apps/web/spike/main.mjs
   68 apps/web/spike/common.mjs
   33 apps/web/spike/phaser.mjs
   41 apps/web/spike/pixi.mjs
   49 apps/web/vite.config.ts
  423 apps/web/spike-tools/measure.mjs
  647 total
```

测量脚本是一次性验证工具，不计入上面两种引擎的 PoC 实现面；完整文件仍保留，便于第三者复跑。

## 验收证据

- [x] `docs/spikes/engine-selection.md` 存在，包含基线、两轮原始体积、gzip、安装增量、启动、首绘、点击、命令和未验证项。
- [x] 测量命令不依赖会话状态。引擎版本、构建命令、dev/preview 命令、Playwright 通道和数据文件路径均已记录。
- [x] `pnpm run check` 在最终工作区退出码为 `0`。最后一次验证命令和输出摘要见下方。
- [x] 约束 grep 无命中：

  ```text
  grep -rn "phaser\|pixi" games/*/src/rules/ packages/
  # 原文输出为空；grep exit=1 表示 no matches
  ```

- [x] `apps/web/package.json` 最终不含 `phaser` 或 `pixi.js`；两轮都执行了卸载，`package.json` 和 `pnpm-lock.yaml` 均与各轮开始前逐字节一致：
  - manifest SHA-256：`614a05020b9f75b02f8e01368e3cba84aec0c34bdb9b5e46ba1b5cdb2edf6ec0`
  - lock SHA-256：`048cacec2345a532a483c63ae0ea04a94ff6eab972b3c49f1b19db4`

- [x] 已给出明确建议：选择 PixiJS 8.21.0，主要因为包体和安装增量更低；不选 Phaser 4.2.1 的主要原因是包体和安装成本。

## 最终验证

最后执行：

```text
pnpm run check
pnpm run build
grep -rn "phaser\|pixi" games/*/src/rules/ packages/
```

`pnpm run check`：EXIT=0。包含 workspace、typecheck、lint、format check 和 56 个 match3 规则测试。  
最终 `pnpm run build`：基线 JS `2.76 kB`，Vite gzip `1.41 kB`。  
grep：EXIT=1、原文输出为空，符合“必须为空”的验收条件。  
未运行项目默认的 `pnpm test:e2e`，因为它验证的是现有首页空状态；本次引擎入口由独立测量脚本对生产 preview 完成了 Playwright 验证。

## 未验证项和失败记录

- 未验证真实手机、不同浏览器、CI 下载的 Chromium、低端 GPU 和 WebGL 不可用时的 Canvas fallback。
- 未验证完整三消玩法、交换/匹配/连锁、动画、资源加载、音频、物理、存档、暂停恢复、销毁和多场景切换。
- 未验证长时间运行、内存占用、帧率、后台恢复、网络部署和缓存策略。
- PixiJS 本次直接从 `pixi.js` 顶层入口导入；没有继续优化按需模块、手动 alias 或进一步 code splitting，因此 Pixi 包体是当前接入方式的结果。
- 首次 Pixi 运行曾因错误使用 `renderer.on('postrender')` 导致 `__spikeFirstPaint` 超时；该次运行标记为未完成且没有使用其首绘/点击数字。修正为显式 `app.render()` 后，第二次干净基线运行完整通过，报告只采用第二次结果。
- “冷启动”没有清空操作系统文件缓存；首绘和 dev ready 都不应被解释为重启机器后的冷缓存数据。

本分支未提交、未推送。
