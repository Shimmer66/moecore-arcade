# 萌芯游乐园 · MoeCore Arcade

以 AI 看板娘为主题的轻量网页小游戏合集。一个入口，多款独立玩法，共享角色、素材和必要的基础能力。

**当前阶段：四游戏可玩原型。** Vue 3 负责合集页面和游戏界面，纯 TypeScript 负责规则。
已接入一关 8×8 消消乐、《大肥鱼跑酷：答案马上就到》、五关《大肥鱼 · 搬家日记》和《鲸鲸的灵感长队》；不接入大模型 API，不需要模型账户，也不消耗真实 Token。

## 快速开始

环境基线：Node.js **24.15.0** 和 npm。Node 版本记录在 `.node-version`，依赖由根目录的 npm workspace 和锁文件统一管理。

```bash
# 在仓库根目录安装并启动
npm install
npm start
```

默认开发地址为 `http://127.0.0.1:5173`，端口占用时以终端输出为准。
`npm start` 会启动 Web 开发服务。
选择游戏，或直接进入 `/#/games/match3`、`/#/games/parkour`、`/#/games/sokoban`。
《鲸鲸的灵感长队》入口为 `/#/games/whale-queue`。
本地开发显示提供的待审核角色素材；正式构建使用自制缩写棋子或几何角色，不打包这些待审核图片。

```bash
npm run check                  # 工作区、类型、代码风格、格式、单元测试
npm run build                  # 构建到 apps/web/dist
npm run preview                # 本地预览构建产物

# 浏览器测试首次运行前安装 Chromium
npm exec --workspace @moecore/web -- playwright install chromium
npm run build
npm run test:e2e                # 对生产构建执行桌面/移动视口冒烟测试
```

Linux CI 安装浏览器时使用 `playwright install --with-deps chromium`。完整命令与验证范围见[开发指南](docs/development.md)。

## 当前内容

| 模块           | 已有内容                                                     | 尚未实现                               |
| -------------- | ------------------------------------------------------------ | -------------------------------------- |
| Web 入口       | Vue 3、游戏列表、hash 路由、动态加载、暂停、重开和结算       | 设置持久化、图鉴、更多游戏             |
| 消消乐         | Vue 棋盘、点击/拖动交换、消除连锁、收集目标、一步结算和提示  | 五关内容、教程、音效和进度保存         |
| 大肥鱼跑酷     | 短局交付、干饭路线、尾巴退件、上下文护盾、幻觉核查与鲸鱼爆发 | 后续关卡、真人手感调优、音效与真机验收 |
| 大肥鱼推箱子   | Vue 3 五关、点击绕行、相邻推箱、撤销/重开、难度递进          | 真实移动设备验收、素材授权与音效       |
| 鲸鲸的灵感长队 | Vue 3 16×16 自动前进、灵感星、思考减速、摘要贝壳与四向输入   | 更多关卡、音效、素材授权与真机验收     |
| 游戏 SDK       | Vue 组件定义、统一 props / 事件、会话及结果类型              | 持久化服务接入                         |
| 角色           | 六位候选角色的稳定 ID、名称和待审核状态                      | 已获许可的角色头像和立绘               |
| 素材           | 60 张消消乐、72 张办公室素材与运行图；旧 400 张跑酷包归档    | 完整发布审核                           |
| 存储           | 设置键、分游戏存储键生成与隔离测试                           | 持久化适配、异常降级、数据校验和迁移   |
| 工程           | 严格 TypeScript、ESLint、Prettier、Vitest、Playwright、CI    | 游戏流程、真实移动设备和发布性能验收   |

项目没有 Phaser，也没有手动 `mount/destroy` 的游戏兼容接口。消消乐直接渲染 Vue 组件。
当前为原型版本，浏览器测试不等于难度平衡、长期内容量或真实移动设备发布验收。

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
├── games/parkour/             # 跑酷基础规则、冒险机制、故事与 Vue 场景
├── games/sokoban/             # 大肥鱼推箱子规则、五关和 Vue 棋盘
├── games/whale-queue/         # 鲸鲸的灵感长队规则和 Vue 棋盘
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
└── package-lock.json
```

每个已创建的包都有独立清单与检查命令。暂不创建其他游戏空包、独立调试应用或通用引擎封装。

## 工程约定

- 使用 **npm Workspace + TypeScript + Vite + Vue 3**；宿主与游戏界面均使用 Vue，规则层不导入 Vue。
- `apps/web` 组装游戏和服务；`games/*` 管理本游戏规则；`packages/*` 提供必要的共享能力。
- 内部依赖通过 npm 兼容的本地 workspace 引用和公开 `exports` 导入，禁止跨包访问私有源码。公共包不得反向依赖应用或游戏，游戏之间不得互相依赖。
- 内部包直接导出 TypeScript / Vue 源码，由应用统一构建；均为私有工作区包，不发布到 npm。
- 依赖锁定在根目录的 `package-lock.json`。推送触发检查，不自动部署网站。

详细接入协议和资源流程见[架构说明](docs/architecture/README.md)。

## 玩法路线

| 玩法                              | 安排                                                     |
| --------------------------------- | -------------------------------------------------------- |
| AI 娘消消乐                       | 首个原型方向：交换式三消，先验证普通匹配与完整一局       |
| 大肥鱼跑酷：答案马上就到          | 已接入：穿过自己生成的混乱办公室，把能玩的小游戏送给用户 |
| AI 娘弹珠乱斗                     | 后续重点：三对三、回合制弹射、碰撞出界                   |
| AI 娘翻牌挑战                     | 轻量扩展候选                                             |
| AI 娘合成小屋、AI 娘躲躲乐        | 后续玩法候选                                             |
| 守住最后一个 Token、AI 娘三人小队 | 策略扩展候选                                             |
| AI 娘休息室                       | 至少两款游戏稳定后再评估，不单独算一款游戏               |

除消消乐和跑酷原型外，以上均为规划，不是同步交付承诺。完整安排见[路线图](docs/roadmap.md)。

## 文档导航

- [开发与验证](docs/development.md)：环境、命令、测试范围、CI 和静态构建。
- [架构与包边界](docs/architecture/README.md)：包职责、游戏生命周期和共享数据。
- [消消乐规格](docs/games/match3.md)：目标规则、最小范围与验收条件。
- [大肥鱼跑酷](docs/games/parkour.md)：回答生成中心的故事、动作机制与验证范围。
- [大肥鱼推箱子](docs/games/sokoban.md)：五关规则、点击绕行和素材审核状态。
- [弹珠乱斗参考](docs/games/marbles.md)：保留原方案的主要规则与约束。
- [项目路线图](docs/roadmap.md)：七种玩法、阶段安排与未决事项。
- [素材清单](packages/assets/CREDITS.md)：占位图、消消乐和跑酷素材的来源、哈希和审核状态。

## 素材与许可

候选角色为 DeepSeek、GLM、GPT / ChatGPT、Claude、Gemini、Kimi；推箱子使用大肥鱼形象。项目不声明与对应公司、产品或社区存在官方、合作或赞助关系，也不以角色数值比较真实模型能力。

消消乐与跑酷素材已纳入本地工作区，状态仍是 `generated-pending-review`，只在 `npm start` 中预览。
图片、音效与字体使用前需要逐项确认来源、作者、修改范围和分发许可；正式构建不包含待审核图片，许可私信不得放入公开仓库或发布目录。

代码许可证尚未确定，当前不提供 `LICENSE` 授权声明。第三方素材许可与未来代码许可分别管理。
