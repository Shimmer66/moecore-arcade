# 大肥鱼 · 搬家日记

状态：已接入 Vue 3 游戏宿主的五关可玩原型，素材仍待人工审核。

推箱子由大肥鱼作为棋盘上的主角。第 1 关为简单教学，第 2 关适中，第 3 至 5 关困难。点击空地会规划绕开墙和箱子的路线；靠近箱子后点击箱子只推动一格。电脑支持方向键 / WASD，Z 撤销，R 重开。

规则层位于 `games/sokoban/src/rules`，不依赖 Vue 或浏览器。Vue 组件通过游戏 SDK 的 `GameProps` / `GameEvents` 接入 `apps/web`，首四关在组件内继续推进，最后一关完成后由宿主展示统一结算。

素材从 `packages/assets/sokoban/manifest.json` 按需加载。当前运行时 PNG 的状态是 `generated-pending-review`；正式发布前需要补齐来源、生成模型、授权边界和人工视觉审查，不能把当前原型验收视为素材发行许可。

规则测试：`npm --workspace @moecore/game-sokoban run test`。
