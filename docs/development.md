# 开发与验证

## 环境

- Node.js 24.15.0，记录于根目录 `.node-version`；项目当前限定 Node 24。
- pnpm 10.33.0，版本记录于根目录 `package.json`；工作区定义见 `pnpm-workspace.yaml`。
- `apps/web` 和游戏界面使用 Vue 3；游戏的 `rules` 入口保持纯 TypeScript。
- 所有命令在仓库根目录执行。Windows PowerShell、macOS 和 Linux 使用相同的 pnpm 命令。
- 当前不需要 `.env`、API 密钥、数据库或后端。

## 包管理器与锁文件

安装与 CI 以 pnpm 为准：首次安装执行 `pnpm install`；修改依赖后同步 `pnpm-lock.yaml`，提交清单和该锁文件。CI 执行 `pnpm install --frozen-lockfile`，不在子包维护独立锁文件。

根目录脚本仍通过 `npm --workspace` / `npm --workspaces` 分发部分任务，因此运行环境也需要 Node 随附的 npm。`pnpm run check` 等入口继续调用这些现有脚本；这不改变 CI 以 pnpm 安装依赖的事实。

仓库目前保留 `package-lock.json` 作为 npm 兼容记录。它不是 CI 的冻结安装依据，也不能用 npm 安装成功证明 pnpm 锁文件同步。

脑洞擂台接入时已同步 `game-arena` 与 `game-rewrite` 的 pnpm 锁文件。修改清单后仍须验证冻结安装；锁文件一致性检查不等同于远程 CI 已运行通过。

## 常用命令

| 命令                                                | 作用                                             |
| --------------------------------------------------- | ------------------------------------------------ |
| `pnpm start`                                        | 启动 Web 开发服务，默认只监听 `127.0.0.1`        |
| `pnpm run dev`                                      | 启动 Web 开发服务，默认只监听 `127.0.0.1`        |
| `pnpm run build`                                    | 构建唯一站点到 `apps/web/dist`                   |
| `pnpm run preview`                                  | 预览已经生成的构建产物，不执行构建               |
| `pnpm run check:workspace`                          | 校验包清单、导出、内部依赖、依赖环和源码跨包导入 |
| `pnpm run typecheck`                                | 对全部工作区包执行 TypeScript 检查               |
| `pnpm run lint`                                     | 检查全仓库 TypeScript 与工程脚本                 |
| `pnpm run format:check`                             | 检查格式                                         |
| `pnpm run format`                                   | 自动格式化                                       |
| `pnpm test`                                         | 执行具有单元测试脚本的包                         |
| `pnpm run test:match3`                              | 只测试消消乐包的配置与已实现规则                 |
| `pnpm --filter @moecore/game-match3 run test:watch` | 监听消消乐包的测试变化                           |
| `pnpm run check`                                    | 顺序执行工作区、类型、lint、格式和单元测试       |
| `pnpm run test:e2e`                                 | 对已构建站点运行 Playwright                      |

指定开发端口：`pnpm --filter @moecore/web run dev --port 5180`。指定预览端口：`pnpm --filter @moecore/web run preview --port 4180 --strictPort`。需要局域网设备访问时显式传入 `--host 0.0.0.0`，不要将开发服务器当作生产服务。

## 当前测试覆盖

| 范围           | 检查                                                              |
| -------------- | ----------------------------------------------------------------- |
| 消消乐包       | 棋盘、匹配、交换、连锁、目标、最后一步判胜与有界重建              |
| 跑酷包         | 基础物理、短局回放、二段跳、退件、幻觉核查、上下文护盾与完整交付  |
| 推箱子包       | 关卡结构、首关解法、撤销与重开规则                                |
| 鲸鲸长队包     | 会话种子、地图变化、转向、边界碰撞、思考减速与终局目标            |
| 模型战争包     | 横版动作规则、角色与能力；浏览器验证选角、跳跃、射击和暂停        |
| 生成事故冒险包 | 平台碰撞、事件、重力、救场、三关通关；桌面与触屏操作              |
| 角色包         | 稳定且不重复的角色 ID、素材待审核状态                             |
| 素材包         | 站点资源存在、消消乐与跑酷/推箱子素材清单和哈希、角色映射         |
| 存储包         | 命名空间、分隔符转义、空键拦截                                    |
| 游戏 SDK       | 纯类型包，通过 TypeScript 检查，不配置空的运行时测试              |
| Web 应用       | 桌面/移动视口下的对局、暂停、重开、退出、刷新、加载竞态与失败恢复 |

未使用 `passWithNoTests` 掩盖缺失测试。`pnpm test` 不包括 Web E2E，也不表示尚未实现的玩法、存档或生命周期已通过验证。

浏览器测试步骤：

```bash
pnpm --filter @moecore/web exec playwright install chromium
pnpm run build
pnpm run test:e2e
```

Playwright 在 `127.0.0.1:4175` 启动独立预览服务，结束后自动清理。
该端口占用时测试会失败，不复用来源不明的服务；检查已有进程或统一修改测试配置中的端口。
截图和失败追踪存入 `apps/web/test-results`，不提交到 Git。
移动视口模拟不等于 Android、iOS 真机兼容性验收。

若 Playwright 浏览器下载不可用，可显式指定本机已安装的 Chrome 进行本地冒烟验证：

```powershell
# PowerShell，仅影响当前终端；测试后清除
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm run test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

macOS / Linux 使用 `PLAYWRIGHT_CHANNEL=chrome pnpm run test:e2e`。
这不会使用日常浏览器的用户数据；测试仍启动独立浏览器实例。
记录实际使用的通道，不将本机 Chrome 验证等同于默认 Chromium 下载问题已经解决。
CI 不设置此变量，继续使用锁定 Playwright 版本对应的 Chromium。

### UI 验证范围与缺口

现有 E2E 文件为 `games.spec.ts`、`parkour.spec.ts`、`sokoban.spec.ts`、`rewrite.spec.ts` 和 `arena.spec.ts`。首页筛选、Logo / 顶部导航的离局确认、暂停后的键盘焦点，以及鲸鲸完整玩法尚无专用持续 E2E 覆盖。

2026-09-25 的 UI 改版已检查 1440px 桌面和 390px 手机页面；现有跑酷 E2E 还检查 320px 布局。鲸鲸在两个视口下手动验证了开始、暂停、恢复，手机方向键已移到棋盘下方。这些局部证据不代表所有游戏已完成人工通关、真机或所有浏览器验收。

## 新增游戏

1. 创建 `games/<id>`，包名采用 `@moecore/game-<id>`，声明实际依赖和公开导出。
2. 规则、Vue 组件、配置和测试放在本包；规则单独通过 `./rules` 导出。
3. 根组件使用 `defineProps<GameProps>()` 和 `defineEmits<GameEvents>()`，包入口导出 `GameDefinition`。
4. 在 `apps/web/package.json` 声明工作区依赖，并在 `src/games/registry.ts` 加入显式动态导入。
5. 注册表生成首页入口；在 `HomeView.vue` 的 `coverArt` 中配置封面，资源由 `@moecore/assets` 的公开导出提供。未配置封面时显示通用图标。
6. 按 [UI 规范](ui-guidelines.md) 接入共享样式，补齐玩法说明及与变更有关的规则、浏览器验证。

当前消消乐、跑酷、推箱子、鲸鲸的灵感长队和 模型战争及 别乱生成！共六款游戏已注册；其他游戏可以独立开发。注册项只负责加载，不代替游戏本身实现。
不要提前创建尚未实施的候选游戏包，也不需要先建设 `game-runtime`、`ui` 或 `playground`。

```ts
import type { GameDefinition } from '@moecore/game-sdk';
import ExampleGame from './components/ExampleGame.vue';

export const game = {
  id: 'example',
  title: '游戏名称',
  component: ExampleGame,
} satisfies GameDefinition;
```

以上为新游戏模板，不是已经存在的 `example` 包。游戏包自行声明 Vue、`vue-tsc` 与实际依赖，
保持与 Web 相同的 Vue 版本。规则测试从规则入口导入，不通过包含 `.vue` 的总入口。

## Vue 宿主边界

Vue 既渲染宿主页面，也渲染游戏棋盘；规则计算仍是普通 TypeScript 函数。
消消乐以 `shallowRef` 保存棋盘快照，由 CSS 展示消除反馈，规则结果不依赖 CSS 动画事件。

宿主通过 props 下发暂停和设置，通过事件接收结果；更换组件 key 创建新局。
游戏组件在卸载时取消动画帧，不自行修改全局路由，也不导入宿主内部代码。

## 素材预览

`pnpm start` 和 `pnpm run build` 都会在首页、消消乐、跑酷、推箱子和鲸鲸长队中加载当前使用的生成素材。模型战争使用组件内 SVG 场景。
公开试玩构建按项目所有者的决定展示这些图片；素材仍标记为待审核，没有增加“已获授权”的声明。
正式发行前仍需单独审核素材。首次启动后的 URL 模块加载与图片解码不能以文件哈希检查代替。

## CI 与部署

跑酷专项验证：`pnpm --filter @moecore/game-parkour run test` 执行纯规则与剧情条件测试，
`pnpm --filter @moecore/web exec playwright test parkour.spec.ts` 验证三个动作、暂停、即时重试、窄屏及完整短局。
开场不推进模拟；局内没有阅读暂停。取得答案并抵达 480 米出口即自动结算。
浏览器试跑通过正常按键完成干饭、退件、核查和爆发，不通过修改组件内部状态跳过关卡。
游戏通过 `GameResult.story` 返回可选结尾与角色图，宿主不判定剧情条件。

办公室素材的运行图由 `scripts/prepare-whale-assets.py` 生成（需要 Pillow），源 PNG 保持不变。
素材测试同时核对源文件与运行图哈希。公开试玩构建包含游戏实际使用的 PNG 和 WebP。

GitHub Actions 在 push / pull request 上运行：
`pnpm install --frozen-lockfile`、`pnpm run check`、构建、安装 Chromium、桌面与移动视口 E2E。
工作流只读仓库内容，不自动发布或配置 GitHub Pages。

后续静态部署只上传 `apps/web/dist`，不上传整个仓库。
Vite 使用相对 `base`，适合相对资源寻址；接入游戏路由和动态资源后，还需针对真实部署子路径单独验证。
不得仅凭本次首页构建就宣称所有子路径游戏资源已验证。

## 提交前

执行 `pnpm run check`、`pnpm run build` 与 `pnpm run test:e2e`，确认本次变更对应的测试已通过。
检查暂存区，排除依赖目录、构建输出、测试截图、密钥和私密授权证据。
记录未运行的检查和实际限制，不把规划功能写成已完成。
