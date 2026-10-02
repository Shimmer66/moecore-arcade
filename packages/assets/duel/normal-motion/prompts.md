# 轻脚与空中拳：生成提示词集

使用内置`image_gen`，`transparent_background=true`。参考只约束角色身份/画风，生成新动作。以下为共同制作规格与各角色追加要求；每个角色单独生成一张，不拼贴旧图。输出及来源见`generation-record.json`。

## 共同规格

```text
Use case: stylized-concept.
Asset type: production 2D fighting-game animation sprite sheet.
Exactly 4 columns x 4 rows = 16 separate full-body sprites on a square
TRUE transparent PNG. Fixed right-facing side/three-quarter viewpoint.
Generous empty gutters, every limb and prop entirely inside its cell.
One body scale throughout; do not enlarge crouched figures.
No text, labels, grid, effects, floor, shadow, or detached objects.
Match the provided character's identity, clothing, palette and crisp cel-shaded outlines.
Four visibly distinct anatomical animation stages per row, never duplicate idle copies.

Row 1 — STANDING LIGHT KICK:
slight knee lift; begin a short low snap kick; fully extend a short toe poke
to the right at shin/knee height with torso balanced upright; retract boot to guard.
Not a high heavy kick.

Row 2 — CROUCH LIGHT KICK:
deep squat; one boot slides out right along floor; fully extend a low toe poke
while torso stays crouched and supporting knee remains deeply bent;
retract into squat. Never rise during the strike.

Row 3 — AIR LIGHT PUNCH:
airborne bent knees, fist by cheek; begin extending quick jab right;
fully extended horizontal fist with the other hand guarding and both legs tucked;
retract fist while airborne.

Row 4 — AIR HEAVY PUNCH:
airborne knees tucked, fist cocked high above/behind shoulder;
begin diagonal down-right punch;
fully extend the downward punch with torso leaning forward and legs folded behind;
retract fist into airborne guard.
Rows 3 and 4 attack with HANDS, never with kicking legs.
Keep complete hair, horns, hands, equipment and feet visible.
```

## 六角色身份约束

| 角色       | 参考                                             | 追加约束                                                                                                         |
| ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| DeepSeek   | `../combat/deepseek/ready.png`                   | 蓝/青渐变长发、鲸尾、蓝眼、藏蓝白边女仆服、蓝靴。裙下不透明深蓝短裤，不露内衣。无饭碗。                          |
| GPT        | `../first-batch/duel_gpt_base.png`               | 白银发、象牙角、绿眼、白/薄荷绿褶边服装、玫瑰、白靴、白龙尾。双拳空手，不拿纸堆。裙下不透明短裤。                |
| 豆包       | `../first-batch/duel_doubao_base_v3.png`         | 棕色侧分短发、红围巾、黑卫衣、短裤配不透明黑打底裤、黑红鞋。保持人形，不变成包子，不变长发。                     |
| 甲方       | `../newcomers/motion/client-ground-v1.png`       | 黑色背头、方眼镜、酒红西装、白衬衫、黄领带、大肚子、深蓝裤和黑鞋。非攻击手夹文件，不拿红印章；空中拳保持腿蜷起。 |
| 提示词仙人 | `../newcomers/motion/prompt_sage-ground-v1.png`  | 黑发道髻带USB发簪、小胡须、深青橙金边道袍、黑裤、鸭子黄拖鞋。键盘只背在背上，双手空拳，不复制键盘、不飘符纸。    |
| 断网大爷   | `../newcomers/motion/unplug_uncle-ground-v1.png` | 秃顶灰侧发、粗灰眉胡子、白背心、橙线腰带、蓝花短裤、绿拖鞋。双手空拳，不拿插排或网线，保持矮壮体型。             |

## 实际生成图的帧序处理

生成图的第1行第二格多为抬膝蓄力，第三格才完整伸腿。运行时把每行前两格安排在前摇内，第三格从命中帧开始播放，第四格用于收招。没有通过修改图片像素纠正时间，而是让播放时序对应可见姿势。

原PNG保持不变；透明轮廓、裁切与单一缩放比例由`calibrate-duel-advanced-motion.py --family normal-motion`生成。站立参考高度142逻辑单位，蹲姿/空中蜷腿不被放大到站立高度。
