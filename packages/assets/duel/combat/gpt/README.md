# GPT 局内动作图集

`atlas.png` 是内置 image_gen 参考 `first-batch/duel_gpt_base.png` 新生成的 4 × 3 透明动作图集。完整实际提示词和源图路径见 [generation.json](generation.json)。一张 PNG 提供十二种关键姿态，未通过代码切图、改图或重采样。

顺序为：待机、冲刺、跳跃、起手 / 直拳、背拳、侧踢、挑空 / 出招、格挡、受击、倒地。使用 [combat-geometry.json](../../combat-geometry.json) 中逐个检查的 viewport 裁显原图，防止较长的腿跨过等分格边缘而被截断。运行时统一站立高度为 142 游戏单位。

通过 [duel-combat.ts](../../../src/duel-combat.ts) 导出，在 `RasterFighter.vue` 中按实际战斗动作选择关键姿态。图片失败时回退可动 SVG，不影响游戏规则。
