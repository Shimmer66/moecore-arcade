# GPT 接投动作图集

2026-10-01，使用内置 image_gen，透明背景，参考 `../normal-motion/gpt-v1.png` 的角色设计。生成原PNG保留，校准脚本只分析透明轮廓并输出JSON。

## 最终提示词

Use case: stylized-concept. Asset type: transparent fighting game sprite atlas. Reference image is character identity and rendering style reference ONLY. Create a NEW atlas for the exact same chibi GPT dragon girl: white lavender long hair, ivory curved horns, teal eyes, white and emerald frilled dress, dark emerald vest with gold trim, white green boots, small dragon wings and tail. Preserve outfit and proportions. Exactly EIGHT separated full-body sprites arranged in FOUR columns and TWO rows with wide transparent gutters, each pose fits completely inside its equal-size cell. Every sprite is facing screen RIGHT, side/three-quarter view, fixed camera, same body scale, feet on common baseline for each row. No opponent, no text, no lines/grid, no ground shadow, no particles, no props. Hands must be empty because the game draws the opponent separately. Row 1 is welcoming catch startup sequence: cell1 ready braced feet, palms opening; cell2 bend knees, both open palms out at chest height; cell3 arms fully extended to right with palms upward ready to catch falling person; cell4 lean back under weight, elbows bent and both forearms horizontal at chest height cradling invisible weight. Row2 is throw follow-through: cell1 hug invisible weight at chest, knees bent, determined smirk; cell2 raise BOTH arms above head lifting invisible weight, straighten legs; cell3 powerful two-arm downward throw toward screen right, deep forward bend and hands low at right; cell4 release and recover standing palms open with exaggerated smug grin. Make the eight poses strongly distinct and useful for sequential animation. Clean bold anime outlines, crisp cel shading matching supplied reference. Genuine transparent background. Portrait-free atlas, full bodies, no clipping, no second figure, no energy effects.

## 接入

- `grapple-frame.ts`按动作年龄选帧：F接人准备、O普通投起手、成功抓取后的抬起/下摔/恢复。
- 对手单独渲染，不烘焙到图集里；抓取第9帧的下摔对应既有伤害结算，前8帧仍可拆投。
- `geometry.json`使用实际透明轮廓和脚底锚点，八帧同一比例；不假定生成结果严格等分。
- 原始文件名：`call_r91mDfAGHeDUT547tAMGugmy.png`；哈希、尺寸和透明占比记录于 `manifest.json`。
