# 摸鱼局 · AI 小游戏俱乐部

以 AI 看板娘为主题的轻量网页小游戏合集。一个入口，多款独立玩法，共享角色、素材和必要的基础能力。

**当前阶段：多款小游戏可玩原型。** Vue 3 负责合集页面和游戏界面，纯 TypeScript 负责规则。
已接入一关 8×8 消消乐、《大肥鱼跑酷：答案马上就到》、五关《大肥鱼 · 搬家日记》、《鲸鲸的灵感长队》、五关《幻觉防线》和《别乱生成！》；不接入大模型 API，不需要模型账户，也不消耗真实 Token。

## 快速开始

新增 **[战斗吧，大肥鱼](games/duel/README.md)**：白饭我吃，拳头你挨！支持三角色人机对战、同机双人、抢饭与气泡反弹。启动后进入 `/#/games/duel`；详细规则见[游戏说明](games/duel/README.md)。

新试玩：[稳稳接住你 · 承诺实验室](docs/games/steady.md)，入口 `/#/games/steady`。五关救援挑战与自由实验：摆气球、磁铁、锅和蹦床，利用风、剪绳和惯性完成目标。逐关解锁、15 星挑战和本地进度保存，已接入生成角色图。

环境基线：Node.js **24.15.0** 和 **pnpm 10.33.0**，分别记录在 `.node-version` 和根目录 `package.json`。工作区由 `pnpm-workspace.yaml` 定义，CI 使用 `pnpm-lock.yaml` 冻结安装。包管理器约定见[开发指南](docs/development.md#包管理器与锁文件)。

```bash
# 在仓库根目录安装并启动
pnpm install
pnpm start
```

默认开发地址为 `http://127.0.0.1:5173`，端口占用时以终端输出为准。
`pnpm start` 会启动 Web 开发服务。
选择游戏，或直接进入 `/#/games/match3`、`/#/games/parkour`、`/#/games/sokoban`。
《鲸鲸的灵感长队》入口为 `/#/games/whale-queue`。
《幻觉防线》入口为 `/#/games/rewrite`。
《别乱生成！》入口为 `/#/games/arena`。
本地开发和公开试玩构建均显示当前游戏使用的生成素材；素材审核状态仍见下文与素材清单。

```bash
pnpm run check                  # 工作区、类型、代码风格、格式、单元测试
pnpm run build                  # 构建到 apps/web/dist
pnpm run preview                # 本地预览构建产物

# 浏览器测试首次运行前安装 Chromium
pnpm --filter @moecore/web exec playwright install chromium
pnpm run build
pnpm run test:e2e                # 对生产构建执行桌面/移动视口冒烟测试
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
| 幻觉防线       | 五关横版动作、已读回信窗口、上下文过期区、幻觉桥核查与守关战 | 真人手感、真机性能与素材成品复核       |
| 别乱生成！     | 三世界48关、隐藏协议、双人五局三胜、无尽生成、玩家工坊       | 参考内容覆盖与最终体验审查             |
| 游戏 SDK       | Vue 组件定义、统一 props / 事件、会话及结果类型              | 持久化服务接入                         |
| 角色           | 六位候选角色的稳定 ID、名称和待审核状态                      | 已获许可的角色头像和立绘               |
| 素材           | 站点标识、首页封面、消消乐、办公室跑酷、推箱子与鲸鲸素材     | 完整发布审核                           |
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
├── games/arena/              # 生成事故冒险的规则与关卡界面
├── games/match3/              # 独立的消消乐包
│   ├── src/config/            # 原型配置，后续增加关卡
│   ├── src/rules/             # 纯 TypeScript 规则与类型
│   ├── src/components/        # Vue 棋盘、输入与消除反馈
│   └── tests/
├── games/parkour/             # 跑酷基础规则、冒险机制、故事与 Vue 场景
├── games/sokoban/             # 大肥鱼推箱子规则、五关和 Vue 棋盘
├── games/whale-queue/         # 鲸鲸的灵感长队规则和 Vue 棋盘
├── games/rewrite/             # 幻觉防线的横版动作规则与 Vue 场景
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
- 内部依赖通过 npm 兼容的本地 workspace 引用和公开 `exports` 导入，禁止跨包访问私有源码。公共包不得反向依赖应用或游戏，游戏之间不得互相依赖。
- 内部包直接导出 TypeScript / Vue 源码，由应用统一构建；均为私有工作区包，不发布到 npm。
- CI 的安装依据为 `pnpm-lock.yaml`。仓库暂留 `package-lock.json` 作为 npm 兼容记录，不能用它替代 pnpm 冻结安装验证；根脚本仍有 npm 子命令。推送触发检查，不自动部署网站。

详细接入协议和资源流程见[架构说明](docs/architecture/README.md)。

## 玩法路线

| 玩法                             | 安排                                                     |
| -------------------------------- | -------------------------------------------------------- |
| 幻觉消消乐                       | 首个原型方向：交换式三消，先验证普通匹配与完整一局       |
| 大肥鱼跑酷：答案马上就到         | 已接入：穿过自己生成的混乱办公室，把能玩的小游戏送给用户 |
| 大肥鱼 · 搬家日记                | 已接入：五关推箱子、撤销、重开和提示                     |
| 鲸鲸的灵感长队                   | 已接入：队列移动、灵感星、思考减速与摘要贝壳             |
| 幻觉防线                         | 已接入：五关横版动作、角色选择与两次能力选择             |
| 别乱生成！                       | 已接入：主线、分身隐藏关、双人竞速、无尽与关卡创作       |
| 提示词弹珠乱斗                   | 后续重点：三对三、回合制弹射、碰撞出界                   |
| 幻觉翻牌挑战                     | 轻量扩展候选                                             |
| 模型合成小屋、幻觉躲躲乐         | 后续玩法候选                                             |
| 守住最后一个 Token、模型三人小队 | 策略扩展候选                                             |
| 模型休息室                       | 至少两款游戏稳定后再评估，不单独算一款游戏               |

表中标记“已接入”的六款为当前原型，其余为候选规划，不是同步交付承诺。完整安排见[路线图](docs/roadmap.md)。

## 文档导航

- [开发与验证](docs/development.md)：环境、命令、测试范围、CI 和静态构建。
- [架构与包边界](docs/architecture/README.md)：包职责、游戏生命周期和共享数据。
- [UI 规范](docs/ui-guidelines.md)：摸鱼局的视觉变量、组件、响应式布局与待修交互。
- [消消乐规格](docs/games/match3.md)：目标规则、最小范围与验收条件。
- [大肥鱼跑酷](docs/games/parkour.md)：回答生成中心的故事、动作机制与验证范围。
- [大肥鱼推箱子](docs/games/sokoban.md)：五关规则、点击绕行和素材审核状态。
- [鲸鲸的灵感长队](docs/games/whale-queue.md)：收集目标、思考减速、摘要贝壳和输入方式。
- [幻觉防线](games/rewrite/README.md)：角色选择、跳跃射击和能力组合。
- [别乱生成！](docs/games/arena.md)：平台闯关、双人、隐藏协议、无尽与工坊说明。
- [弹珠乱斗参考](docs/games/marbles.md)：保留原方案的主要规则与约束。
- [项目路线图](docs/roadmap.md)：已实现玩法、候选方向、阶段安排与待修问题。
- [素材清单](packages/assets/CREDITS.md)：站点标识、首页封面及各游戏素材的来源和审核状态。

## 素材与许可

候选角色为 DeepSeek、GLM、GPT / ChatGPT、Claude、Gemini、Kimi；推箱子使用大肥鱼形象。项目不声明与对应公司、产品或社区存在官方、合作或赞助关系，也不以角色数值比较真实模型能力。

项目所有者已确认这些游戏素材由其自创，并同意在公开试玩站点展示。当前构建加载首页、消消乐、跑酷、推箱子、鲸鲸长队与幻觉防线使用的生成素材；`generated-pending-review` 表示品牌、角色形象和成品质量仍待复核，不表示素材作者未知，也不代表已取得第三方品牌授权。
正式发行前仍需逐项确认图片、音效与字体的来源、作者、修改范围和分发许可；许可私信不得放入公开仓库或发布目录。

代码许可证尚未确定，当前不提供 `LICENSE` 授权声明。第三方素材许可与未来代码许可分别管理。
