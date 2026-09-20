# 萌芯游乐园 · MoeCore Arcade

以 AI 看板娘为主题的轻量网页小游戏合集。一个入口，多款独立玩法，共享角色、素材和必要的基础能力。

**当前阶段：消消乐可玩原型。** Vue 3 负责合集页面和游戏界面，纯 TypeScript 负责规则。已接入一关 8×8 消消乐；不接入大模型 API，不需要模型账户，也不消耗真实 Token。

## 快速开始

环境基线：Node.js **24.15.0**、pnpm **10.33.0**。Node 版本记录在 `.node-version`，pnpm 版本由 `packageManager` 固定，依赖由根锁文件统一管理。

```bash
# 安装指定包管理器；已安装对应版本时跳过
npm install --global pnpm@10.33.0

# 在仓库根目录安装并启动
pnpm install --frozen-lockfile
pnpm dev
```

默认开发地址为 `http://127.0.0.1:5173`，端口占用时以终端输出为准。选择消消乐，或直接进入 `/#/games/match3`。
本地开发显示提供的待审核角色素材；正式构建使用彩色缩写棋子，不打包这些待审核图片。

```bash
pnpm check                     # 工作区、类型、代码风格、格式、单元测试
pnpm build                     # 构建到 apps/web/dist
pnpm preview                   # 本地预览构建产物

# 浏览器测试首次运行前安装 Chromium
pnpm --filter @moecore/web exec playwright install chromium
pnpm build
pnpm test:e2e                   # 对生产构建执行桌面/移动视口冒烟测试
```

Linux CI 安装浏览器时使用 `playwright install --with-deps chromium`。完整命令与验证范围见[开发指南](docs/development.md)。

## 当前内容

| 模块     | 已有内容                                                    | 尚未实现                             |
| -------- | ----------------------------------------------------------- | ------------------------------------ |
| Web 入口 | Vue 3、游戏列表、hash 路由、动态加载、暂停、重开和结算      | 设置持久化、图鉴、更多游戏           |
| 消消乐   | Vue 棋盘、点击/拖动交换、消除连锁、收集目标、一步结算和提示 | 五关内容、教程、音效和进度保存       |
| 游戏 SDK | Vue 组件定义、统一 props / 事件、会话及结果类型             | 持久化服务接入                       |
| 角色     | 六位候选角色的稳定 ID、名称和待审核状态                     | 已获许可的角色头像和立绘             |
| 素材     | 自制占位图、60 张消消乐待审核素材、本地棋子预览和清单       | 完整发布审核                         |
| 存储     | 设置键、分游戏存储键生成与隔离测试                          | 持久化适配、异常降级、数据校验和迁移 |
| 工程     | 严格 TypeScript、ESLint、Prettier、Vitest、Playwright、CI   | 游戏流程、真实移动设备和发布性能验收 |

项目没有 Phaser，也没有手动 `mount/destroy` 的游戏兼容接口。消消乐直接渲染 Vue 组件。
当前仅为一关原型，浏览器测试不等于难度平衡、长期内容量或真实移动设备发布验收。

## 项目结构

```text
moecore-arcade/
├── apps/web/                  # 唯一可启动、可部署的应用
│   ├── src/
│   │   ├── App.vue            # Vue 宿主布局与全局生命周期
│   │   ├── features/          # Vue 页面组件
│   │   ├── games/            # registry.ts 注册表、GameHost.vue 通用宿主
│   │   └── main.ts
│   ├── public/                # 站点固定文件
│   └── e2e/                   # 浏览器冒烟测试
├── games/match3/              # 独立的消消乐包
│   ├── src/config/            # 原型配置，后续增加关卡
│   ├── src/rules/             # 纯 TypeScript 规则与类型
│   ├── src/components/        # Vue 棋盘、输入与消除反馈
│   └── tests/
├── packages/
│   ├── game-sdk/              # @moecore/game-sdk
│   ├── characters/            # @moecore/characters
│   ├── assets/                # @moecore/assets，资源与 CREDITS.md
│   └── storage/               # @moecore/storage
├── tooling/                   # 共享 TypeScript / ESLint 配置
├── scripts/                   # 工作区结构与依赖边界检查
├── docs/                      # 架构、开发、玩法和路线
├── .github/workflows/ci.yml
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

每个已创建的包都有独立清单与检查命令。暂不创建其他游戏空包、独立调试应用或通用引擎封装。

## 工程约定

- 使用 **pnpm Workspace + TypeScript + Vite + Vue 3**；宿主与游戏界面均使用 Vue，规则层不导入 Vue。
- `apps/web` 组装游戏和服务；`games/*` 管理本游戏规则；`packages/*` 提供必要的共享能力。
- 内部依赖通过 `workspace:*` 和公开 `exports` 导入，禁止跨包访问私有源码。公共包不得反向依赖应用或游戏，游戏之间不得互相依赖。
- 内部包直接导出 TypeScript / Vue 源码，由应用统一构建；均为私有工作区包，不发布到 npm。
- 只保留根目录一份 `pnpm-lock.yaml`，CI 使用冻结锁文件安装。推送触发检查，不自动部署网站。

详细接入协议和资源流程见[架构说明](docs/architecture/README.md)。

## 玩法路线

| 玩法                              | 安排                                               |
| --------------------------------- | -------------------------------------------------- |
| AI 娘消消乐                       | 首个原型方向：交换式三消，先验证普通匹配与完整一局 |
| AI 娘弹珠乱斗                     | 后续重点：三对三、回合制弹射、碰撞出界             |
| AI 娘翻牌挑战                     | 轻量扩展候选                                       |
| AI 娘合成小屋、AI 娘躲躲乐        | 后续玩法候选                                       |
| 守住最后一个 Token、AI 娘三人小队 | 策略扩展候选                                       |
| AI 娘休息室                       | 至少两款游戏稳定后再评估，不单独算一款游戏         |

除消消乐原型外，以上均为规划，不是同步交付承诺。下一阶段完善[消消乐内容与交互](docs/games/match3.md)，完整安排见[路线图](docs/roadmap.md)。

## 文档导航

- [开发与验证](docs/development.md)：环境、命令、测试范围、CI 和静态构建。
- [架构与包边界](docs/architecture/README.md)：包职责、游戏生命周期和共享数据。
- [消消乐规格](docs/games/match3.md)：目标规则、最小范围与验收条件。
- [弹珠乱斗参考](docs/games/marbles.md)：保留原方案的主要规则与约束。
- [项目路线图](docs/roadmap.md)：七种玩法、阶段安排与未决事项。
- [素材清单](packages/assets/CREDITS.md)：占位图与消消乐素材的来源、哈希和审核状态。

## 素材与许可

候选角色为 DeepSeek、GLM、GPT / ChatGPT、Claude、Gemini、Kimi。项目不声明与对应公司、产品或社区存在官方、合作或赞助关系，也不以角色数值比较真实模型能力。

消消乐素材包已纳入本地工作区，状态仍是 `generated-pending-review`，只在 `pnpm dev` 中预览。
图片、音效与字体使用前需要逐项确认来源、作者、修改范围和分发许可；正式构建不包含待审核图片，许可私信不得放入公开仓库或发布目录。

代码许可证尚未确定，当前不提供 `LICENSE` 授权声明。第三方素材许可与未来代码许可分别管理。
