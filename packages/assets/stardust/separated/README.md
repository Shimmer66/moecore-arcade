# 分离本体与替身

## 世界与 Cream（2026-10-06）

新增 `dio-the-world-entity-v1.png`、`ice-cream-entity-v1.png` 两张独立实体，
及 `motion/dio-stand-motion-v1.png`、`motion/ice-stand-motion-v1.png` 两套 4×2 动作图。
顺序为待机、移动、轻击、重击、连打、防御、受击、召回。
两名本体使用 `../motion/*-body-only-motion-v1.png`，贴身、离体、跳跃与下蹲均不再夹带旧替身。
生成方式和提示词记录在 `boss-stands-v1.prompts.txt`。用户已确认造型；
这些是生成的同人游戏素材，不表示取得官方授权。两人的大招设计留待用户另行提供。

## 原四名主角

`stand-separation-v1.png` 为内置 image_gen 根据项目已有角色概念图及 Q 版动作图生成的
透明 PNG，2026-10-06 接入。状态：`generated-pending-review`，不代表官方授权素材。

4 列 × 2 行：列顺序为承太郎、花京院、阿布德尔、波鲁那雷夫。
第一行只有本体；第二行只有白金之星、绿色法皇、红色魔术师、银色战车。
离体与消失状态使用独立本体图，离体实体使用独立替身图；贴身状态仍使用已有动作图。

生成方式：内置 image_gen，生成后复制到项目，不覆盖原图。
提示词摘要：将既有四名人物及其替身重排为严格 4×2 等格游戏图集；本体与替身分开；
保留角色脸型、服装、配色，面向右侧，完整身体与武器，透明背景，格间留白，
无字、无标签、无地面、无边框。第二次定向编辑仅移除背景和光晕并增加格间透明留白。
原始参考：`../concept/stardust-crusaders-lineup-v6.png`、
`../motion/jotaro-chibi-action-sheet-v1-clean-v1.png`。
