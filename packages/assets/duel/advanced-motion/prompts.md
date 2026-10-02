# 六角色进阶动作提示词

使用内置 `image_gen`，`transparent_background=true`，每人独立一张图。参考图仅用于角色身份与画风，生成新的动作。原PNG复制到本目录后未修改像素。共同要求如下；角色条目给出完整的身份、道具及差异约束，可与共同要求合并复现。

## 共同制作要求

```text
Use case: stylized-concept.
Asset type: production 2D fighting-game animation sprite sheet.
Create a square PNG with genuine transparent alpha, exactly 4 columns x 4 rows,
16 isolated full-body sprites. Use regular cells with wide transparent gutters.
No grid, labels, text, numbers, backdrop, floor shadow, FX, loose objects or watermark.
Preserve the reference character's identity, outfit, palette and chibi proportions.
Use crisp clean outlined anime-cartoon cel shading, fixed right-facing
side/three-quarter view. Keep one body scale throughout, without enlarging crouches.
Entire limbs, shoes, hair, tail and held equipment must stay inside each cell.
Ground contact baseline aligned across each row.

Row 1: forward evasive roll:
1 deep crouched anticipation leaning right;
2 tucked shoulder roll, feet lifting;
3 genuinely upside-down curled somersault, head near ground, boots overhead;
4 low rising lunge recovery.

Row 2: powerful standing blowback kick:
1 coil and raise knee;
2 extend boot right at waist height;
3 full follow-through, torso counterbalances left;
4 retract leg into fighting stance.

Row 3: guard-cancel counter:
1 firmly block with forearms or the specified equipment;
2 brace and wind up;
3 forceful full forward extension to shove right;
4 retract to guard.

Row 4: airborne blowback:
1 compact airborne knee tuck;
2 start diagonal down-right kick;
3 fully extend down-right kicking leg with other leg bent;
4 airborne recovery with knees recoiled.

Four truly distinct anatomical poses per row. No repeated idle figures.
Never rotate an ordinary standing sprite to fake rolling.
```

## DeepSeek

参考：`../combat/deepseek/ready.png`  
输出：`deepseek-v1.png`

```text
The same blue-haired whale-tail maid fighter: blue/cyan hair, blue eyes,
white frills, navy outfit, blue boots, large whale tail.
Keep face, chibi proportions and crisp shaded anime outlines of the reference.
Tail flops comically during the tucked roll and sweeps during kick follow-through.
Guard counter uses crossed arms, opening lunge, fully extended two-palm shove,
then pulling hands back into guard.
Skirt stays modest with opaque navy shorts; no underwear exposure.
No rice bowl or new prop in these combat movements.
```

## GPT

参考：`../first-batch/duel_gpt_base.png`  
输出：`gpt-v1.png`

```text
The same GPT girl: white/silver hair, ivory horns, green eyes,
white and mint-green ruffled costume, roses, white boots and small white dragon tail.
Empty hands for combat, omit the source picture's paper stack.
No loose papers. Keep all horns and tail inside the cell.
Guard counter inspired by “steadily catch you”: cross-arm guard;
spread forearms as if catching and pivot right;
both palms fully thrust right to shove; recover into guard.
Modest opaque shorts under skirt, no exposed underwear.
```

## 豆包

参考：`../first-batch/duel_doubao_base_v3.png`（已按用户头像校正的形象）  
输出：`doubao-v1.png`

```text
The same Doubao girl: brown side-parted short bob haircut, large brown eyes,
red scarf, black hoodie, black shorts over opaque black leggings,
black/red sneakers. Keep this human design, never replace her with a bun
or a long-haired girl. Preserve the short bob and red scarf throughout.
Funny determined expressions. Scarf trails behind kick follow-through.
Counter uses cross forearms, opening arms, a powerful two-palm shove, then boxing guard.
```

## 甲方

参考：`../newcomers/motion/client-ground-v1.png`  
输出：`client-v1.png`

```text
The same chubby client/boss: black pompadour, rectangular glasses,
smug angry face, burgundy blazer, white shirt, yellow tie, protruding belly,
navy trousers, black shoes. Keep the marked document folder tucked under one arm.
Omit the giant red stamp for these motions, no loose papers.
Tuck belly during shoulder roll; upside-down round belly comically compressed.
Counter row: folder and forearm block face/chest; brace and wind up;
shove the thick folder hard forward right with extended arm and belly leaning in;
retract and sneer. Airborne kick stays stocky and humorous.
```

## 提示词仙人

参考：`../newcomers/motion/prompt_sage-ground-v1.png`  
初稿：`prompt_sage-v1.png`  
最终：`prompt_sage-v2.png`

```text
The same prompt-word sage: messy black topknot with USB-stick hairpin,
thin mustache, mischievous eyebrows, dark teal robe with orange-gold trim,
hanging talisman strips, dark loose pants, yellow rubber-duck slippers,
keyboard strapped on back. No floating talismans or FX.
Kick yellow slipper right in a comic “eat my slipper” follow-through.
Counter row: bring keyboard in front of chest as shield; pull it back while bracing;
shove keyboard forward right with both arms; retract keyboard to guard.
Only one keyboard in each sprite.
```

第三行出现重复键盘，使用内置编辑修正。首次编辑连接失败，重试成功，未切换CLI。

最终修正提示词：

```text
Precise correction of this 4x4 transparent sprite sheet. Keep all sixteen
characters, poses, exact grid arrangement, body scale, colors and transparent
background unchanged. ONLY correct row three, the third row from top:
remove the duplicate keyboard from the sage's BACK in each of the four sprites
where he holds a keyboard with his hands. Fill that rear keyboard area with
his ordinary dark teal robe. Exactly ONE keyboard per sprite in row three:
the existing handheld keyboard, whose pose is unchanged. Leave rows one,
two, and four entirely unchanged with their back-mounted keyboards.
No other changes, no text, no new props, no effects. Genuine transparent alpha.
```

## 断网大爷

参考：`../newcomers/motion/unplug_uncle-ground-v1.png`  
输出：`unplug_uncle-v1.png`

```text
The same network-unplugging uncle: bald crown, gray side hair, thick gray eyebrows
and mustache, grumpy face, white undershirt, orange cable sash,
blue floral beach shorts, green slippers, short stocky chibi body.
Counter row holds ONE cream power strip in front of face/chest;
brace with it pulled back; thrust strip forward right; pull it back into guard.
Power strip only in row three, no loose blue cable for these movements.
Upside-down roll has bald head low and slippers overhead.
Preserve comedic stubborn-uncle energy and clean reference shading.
```
