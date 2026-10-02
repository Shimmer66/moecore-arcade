# 算力喷射角色

- 文件：`char-compute-jetpack.png`
- 日期：2026-09-28
- 工具：内置 GPT Image / imagegen，透明背景。
- 参考：同目录 `char-whale-burst.webp`，用于人物身份和画风。
- 输出保留生成的 PNG 与 alpha，无裁切、改画或转换。
- 已检查文件：1254×1254，32bpp ARGB，角落 alpha 为 0。
- 用途：`FlightGame.vue` 的飞行角色；火焰由游戏按真实喷射状态绘制。

完整提示词：

> Use case: identity-preserve. Asset type: transparent character sprite for the existing side-scrolling game. Input image is the character identity and rendering-style reference. Create one new flight pose of exactly this blue-haired, blue-eyed chibi whale maid: same face, navy blue and white maid dress, frilled headband, whale tail and cyan hair highlights. She is facing right, floating upright with knees gently bent and fists forward, wearing a compact cyan-and-navy computing jetpack on her back; two small downward-facing rocket nozzles are visible. Cheerful determined expression. Clear readable silhouette for display at 70px tall. Full body including tail and jetpack, centered with a small transparent margin. Preserve detailed polished anime/chibi game-sprite rendering. One character only. Actual transparent alpha background. No floor, shadows on a floor, text, UI, logo, watermark, frame, additional objects, giant flames or speed streaks. The game adds the thruster flame separately.
