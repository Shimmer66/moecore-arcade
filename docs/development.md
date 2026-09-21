# 开发与验证

## 环境

- Node.js 24.15.0，记录于根目录 `.node-version`；项目当前限定 Node 24。
- pnpm 10.33.0，记录于根目录 `package.json` 的 `packageManager`。
- `apps/web` 和游戏界面使用 Vue 3；游戏的 `rules` 入口保持纯 TypeScript。
- 所有命令在仓库根目录执行。Windows PowerShell、macOS 和 Linux 使用相同的 pnpm 命令。
- 当前不需要 `.env`、API 密钥、数据库或后端。

首次安装执行 `pnpm install --frozen-lockfile`。修改依赖后执行 `pnpm install` 更新锁文件，再提交对应清单和根锁文件；不在子包生成独立锁文件。

## 常用命令

| 命令                                            | 作用                                             |
| ----------------------------------------------- | ------------------------------------------------ |
| `pnpm dev`                                      | 启动 Web 开发服务，默认只监听 `127.0.0.1`        |
| `pnpm build`                                    | 构建唯一站点到 `apps/web/dist`                   |
| `pnpm preview`                                  | 预览已经生成的构建产物，不执行构建               |
| `pnpm check:workspace`                          | 校验包清单、导出、内部依赖、依赖环和源码跨包导入 |
| `pnpm typecheck`                                | 对全部工作区包执行 TypeScript 检查               |
| `pnpm lint`                                     | 检查全仓库 TypeScript 与工程脚本                 |
| `pnpm format:check`                             | 检查格式                                         |
| `pnpm format`                                   | 自动格式化                                       |
| `pnpm test`                                     | 执行具有单元测试脚本的包                         |
| `pnpm test:match3`                              | 只测试消消乐包的配置与已实现规则                 |
| `pnpm --filter @moecore/game-match3 test:watch` | 监听消消乐包的测试变化                           |
| `pnpm check`                                    | 顺序执行工作区、类型、lint、格式和单元测试       |
| `pnpm test:e2e`                                 | 对已构建站点运行 Playwright                      |

指定开发端口：`pnpm dev --port 5180`。需要局域网设备访问时显式传入 `--host 0.0.0.0`，不要将开发服务器当作生产服务。

## 当前测试覆盖

| 范围     | 检查                                                              |
| -------- | ----------------------------------------------------------------- |
| 消消乐包 | 棋盘、匹配、交换、连锁、目标、最后一步判胜与有界重建              |
| 角色包   | 稳定且不重复的角色 ID、素材待审核状态                             |
| 素材包   | 占位图存在、60 张素材的清单与 SHA-256、皮肤角色一致性             |
| 存储包   | 命名空间、分隔符转义、空键拦截                                    |
| 游戏 SDK | 纯类型包，通过 TypeScript 检查，不配置空的运行时测试              |
| Web 应用 | 桌面/移动视口下的对局、暂停、重开、退出、刷新、加载竞态与失败恢复 |

未使用 `passWithNoTests` 掩盖缺失测试。`pnpm test` 不包括 Web E2E，也不表示尚未实现的玩法、存档或生命周期已通过验证。

浏览器测试步骤：

```bash
pnpm --filter @moecore/web exec playwright install chromium
pnpm build
pnpm test:e2e
```

Playwright 在 `127.0.0.1:4175` 启动独立预览服务，结束后自动清理。
该端口占用时测试会失败，不复用来源不明的服务；检查已有进程或统一修改测试配置中的端口。
截图和失败追踪存入 `apps/web/test-results`，不提交到 Git。
移动视口模拟不等于 Android、iOS 真机兼容性验收。

若 Playwright 浏览器下载不可用，可显式指定本机已安装的 Chrome 进行本地冒烟验证：

```powershell
# PowerShell，仅影响当前终端；测试后清除
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

macOS / Linux 使用 `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e`。
这不会使用日常浏览器的用户数据；测试仍启动独立浏览器实例。
记录实际使用的通道，不将本机 Chrome 验证等同于默认 Chromium 下载问题已经解决。
CI 不设置此变量，继续使用锁定 Playwright 版本对应的 Chromium。

## 新增游戏

1. 创建 `games/<id>`，包名采用 `@moecore/game-<id>`，声明实际依赖和公开导出。
2. 规则、Vue 组件、配置和测试放在本包；规则单独通过 `./rules` 导出。
3. 根组件使用 `defineProps<GameProps>()` 和 `defineEmits<GameEvents>()`，包入口导出 `GameDefinition`。
4. 在 `apps/web/package.json` 声明工作区依赖，并在 `src/games/registry.ts` 加入显式动态导入。
5. 注册表同时生成首页入口；补齐该游戏的规则与浏览器测试后再合并。

当前消消乐与跑酷已注册；其他游戏可以独立开发。注册项只负责加载，不代替游戏本身实现。
不要提前创建其余六款游戏包，也不需要先建设 `game-runtime`、`ui` 或 `playground`。

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

`pnpm dev` 会在消消乐和跑酷中加载本地提供的角色与场景素材。
`pnpm build` 使用自制缩写棋子或几何角色，不包含待审核 PNG；没有增加“已获授权”的声明。
公开发布前仍需单独审核素材。首次启动后的 URL 模块加载与图片解码不能以文件哈希检查代替。

## CI 与部署

跑酷专项验证：`pnpm --filter @moecore/game-parkour test` 执行纯规则与剧情条件测试，
`pnpm --filter @moecore/web exec playwright test parkour.spec.ts` 验证动作输入、暂停、结算和两个剧情节点。
剧情阅读不推进模拟，补给只触发一次；游戏通过 `GameResult.story` 返回可选结尾，宿主不判定剧情条件。

GitHub Actions 在 push / pull request 上运行：
冻结依赖安装、`pnpm check`、构建、安装 Chromium、桌面与移动视口 E2E。
工作流只读仓库内容，不自动发布或配置 GitHub Pages。

后续静态部署只上传 `apps/web/dist`，不上传整个仓库。
Vite 使用相对 `base`，适合相对资源寻址；接入游戏路由和动态资源后，还需针对真实部署子路径单独验证。
不得仅凭本次首页构建就宣称所有子路径游戏资源已验证。

## 提交前

执行 `pnpm check`、`pnpm build` 与 `pnpm test:e2e`，确认本次变更对应的测试已通过。
检查暂存区，排除依赖目录、构建输出、测试截图、密钥和私密授权证据。
记录未运行的检查和实际限制，不把规划功能写成已完成。
