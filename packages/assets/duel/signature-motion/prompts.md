# DeepSeek 白饭动作图集

2026-10-01 使用内置 imagegen 生成，透明背景。参考 `../normal-motion/deepseek-v1.png` 保持角色设计。生成原PNG保留；校准脚本只读取透明轮廓并写入JSON，不修改图片像素。

## 最终提示词

Use case: stylized-concept. Asset type: transparent 2D fighting game sprite atlas. Image 1 is the exact character identity and rendering style reference only. Create a NEW animation atlas for the same chibi DeepSeek blue whale girl: long vivid royal-blue to cyan gradient hair, dark navy whale-tail maid headpiece, blue flower hair ornament, blue eyes, navy and white maid dress with gold accents, dark boots, large blue whale tail behind her. Preserve her face, outfit, proportions, palette, bold anime outline, and crisp cel shading. Exactly EIGHT separated full-body sprites in FOUR columns and TWO rows, wide fully transparent gutters, each sprite fully contained in its equal cell, same scale, facing screen RIGHT in side/three-quarter view, fixed camera and common foot baseline per row. The bowl and chopsticks are part of the character sprite and must stay visually consistent: one white porcelain bowl with a blue rim, filled with plain white rice, one pair of dark chopsticks. No text, no grid, no ground shadow, no particles, no second character, no logos, no watermark.

Row 1, summoning and starting to eat: cell 1 suddenly presents the rice bowl with both hands, wide-eyed guilty expression; cell 2 crouches protectively around the bowl, looking sideways as if someone may steal it; cell 3 holds bowl in left hand and chopsticks in right, lifting a huge clump of white rice; cell 4 stuffs the rice into her mouth with comically puffed cheeks, eyes squeezed shut.

Row 2, chewing and payoff: cell 1 rapidly chews with puffed cheeks, bowl hugged close; cell 2 swallows and flashes a bright satisfied grin while raising the empty chopsticks, still holding the bowl; cell 3 holds up the nearly empty bowl triumphantly with a smug powered-up pose, whale tail flicking upward; cell 4 tucks the bowl away behind her back and returns to fighting stance with one fist raised, a tiny grain of rice on her cheek.

Make all eight silhouettes and arm positions clearly distinct for sequential animation. Genuine transparent background and clean alpha edges. No clipping. Do not change costume. Do not add extra props beyond the single bowl and single pair of chopsticks.

## 接入说明

- `signature-frame.ts`按现有一次F自动吃完的规则映射八帧；饭被抢后重新按F时，从护碗姿势进入吃饭阶段。
- 第36帧吞咽后沿用现有生命+40、能量+20结算；MAX中仍不获得能量。
- 动作图已包含饭碗，播放期间隐藏旧的矢量浮碗；其他角色拿到饭时仍显示通用浮碗。
- `geometry.json`按透明轮廓生成八个独立视口和统一比例。

## 豆包回旋气泡

参考 `../normal-motion/doubao-v1.png`，使用内置 imagegen 生成 `doubao-v1.png`。

Use case: stylized-concept. Asset type: transparent 2D fighting game sprite atlas. Image 1 is the exact character identity and rendering style reference only. Create a NEW animation atlas for the same chibi Doubao woman: straight dark-brown chin-length bob haircut with side part, very large dark eyes, black puffer jacket and black pants, red knitted scarf, black sneakers with red accents. Preserve her face, outfit, proportions, palette, bold anime outlines, and crisp cel shading. Exactly EIGHT separated full-body sprites arranged in FOUR columns and TWO rows, with wide fully transparent gutters. Each sprite must fit completely inside its equal cell, same body scale, facing screen RIGHT in side/three-quarter view, fixed camera, common foot baseline per row. No text, no grid, no ground shadow, no particles, no second character, no logos, no watermark.

The special prop is one small glossy pink speech-bubble parcel, shaped like a rounded chat bubble with a short tail and a simple white left-pointing return arrow symbol. Keep it consistent and only include it in row 1 cells 1 to 3. Do not include it in any other cell because the game renders the projectile separately.

Row 1, throw sequence: cell 1 holds the pink chat-bubble parcel in both hands and studies it with a confident customer-service smile; cell 2 pulls it back beside her shoulder, knees bent, scarf swinging, preparing an overhand throw; cell 3 twists her waist and extends one hand forward at the release moment while the parcel is just leaving her fingertips; cell 4 empty-handed throwing follow-through toward screen right, one arm fully extended, smug expression.

Row 2, return reaction: cell 1 stands hands on hips, smugly pretending the thrown parcel is no longer her problem; cell 2 suddenly spots it returning from screen right, points at it with wide shocked eyes and open mouth, both hands otherwise empty; cell 3 leans sharply backward and raises both forearms to protect her face, worried grimace, ready for the player to punch the projectile away; cell 4 returns to fighting stance with embarrassed forced smile, brushing off her sleeves, hands empty.

Make the eight silhouettes, arm positions, and facial expressions clearly distinct and readable at small fighting-game scale. Genuine transparent background with clean alpha edges. No clipping and no costume changes.

## 甲方合同指令投

参考 `../newcomers/motion/client-ground-v1.png` 生成。初版上下排透明轮廓重叠，未以程序裁图；使用内置imagegen缩小约10%并加大透明行距，最终接入 `client-v2.png`。

Use case: stylized-concept. Asset type: transparent 2D fighting game command-grab sprite atlas. Image 1 is the exact character identity, outfit, props, and rendering style reference only. Create a NEW animation atlas for the same chibi Client/甲方 businessman: short stocky heavy body, slick black hair with one curled forelock, rectangular black glasses, thick eyebrows, stern face, burgundy suit jacket, white shirt stretched over belly, mustard-gold tie, navy trousers, shiny black shoes. Preserve proportions, colors, face, bold anime outlines, and crisp cel shading. Exactly EIGHT separated full-body sprites arranged in FOUR columns and TWO rows with wide fully transparent gutters. Each sprite fits completely inside its equal cell, same scale, facing screen RIGHT in side/three-quarter view, fixed camera, common foot baseline per row. The opponent is rendered separately by the game: NEVER draw another person or body part. Hands must interact with invisible opponent space only. No text, no grid, no ground shadow, no particles, no logos, no watermark.

Consistent props: a white contract clipboard with several simple red oval correction marks but no readable text, a black pen, and one oversized bright-red approval stamp/mallet matching the reference. Do not add other props.

Row 1, startup and capture: cell 1 thrusts the contract clipboard toward screen right with demanding expression and pen ready; cell 2 leans forward pointing the pen at the signature area, other hand gripping the clipboard, shouting; cell 3 reaches forward with left hand gripping an invisible opponent's lapel while raising the red stamp in the right hand, contract tucked under arm; cell 4 plants feet and pulls the invisible opponent close with both arms, contract pressed against the invisible target, angry determined face.

Row 2, lift, stamp, slam, recovery: cell 1 heaves the invisible opponent upward, torso leaning back, red stamp raised overhead; cell 2 performs a huge downward stamping strike onto invisible opponent space at chest height, both hands on the red stamp, explosive angry expression; cell 3 bends deeply and forcefully presses/slams invisible opponent space toward the floor with both arms extended downward, contract pages fluttering behind him; cell 4 stands upright holding the visibly red-marked contract clipboard triumphantly, red stamp resting on shoulder, smug satisfied expression.

Make all eight silhouettes and arm positions strongly distinct and useful for sequential fighting-game animation. Keep props consistent across cells. Genuine transparent background with clean alpha edges. No clipping. Do not redesign the character.

Repair prompt: Preserve the exact same character, props, poses and order. Uniformly shrink every sprite by about 10 percent, move the top row upward and bottom row downward, and leave at least 45 pixels of transparent horizontal gutter between row alpha bounds. Do not crop or add elements.

## 提示词仙人飞符与慢鸡符阵

参考 `../newcomers/motion/prompt_sage-ground-v1.png`，使用内置imagegen生成 `prompt_sage-v1.png`。

Use case: stylized-concept. Asset type: transparent 2D fighting game signature-move sprite atlas. Image 1 is the exact character identity, outfit, props, and rendering style reference only. Create a NEW atlas for the same chibi Prompt Sage man: slim mischievous martial-arts hermit, black hair in a high messy topknot, thin curled mustache and small goatee, narrow smug eyes, dark teal robe with orange trim, black loose trousers, bright yellow chicken slippers, small gray computer keyboard strapped across his back, yellow-orange paper talismans hanging from belt. Preserve face, proportions, costume, palette, bold anime outlines, and crisp cel shading. Exactly EIGHT separated full-body sprites arranged in FOUR columns and TWO rows with wide fully transparent gutters. Each sprite fits fully inside its equal cell, same body scale, facing screen RIGHT in side/three-quarter view, fixed camera, common foot baseline per row. No opponent, no readable text, no grid, no ground shadow, no large magic effects, no logos, no watermark.

Props: small yellow-orange rectangular talisman papers with only abstract dark rune strokes, and the same compact gray keyboard. The game renders flying projectiles and the ground trap separately, so do not draw a detached flying talisman, floor circle, or distant trap. Keep hands empty after each release moment.

Row 1, U flying-talisman skill: cell 1 pulls one talisman from his sleeve while glancing sideways with a sly grin; cell 2 holds the talisman in one hand and rapidly taps the compact keyboard with the other, focused expression; cell 3 snaps his arm forward toward screen right at the exact release moment, open empty fingertips, robe sleeve and belt talismans trailing; cell 4 settles into a guarded stance with one palm raised, keyboard back in place, smug smile.

Row 2, F slow-trap casting: cell 1 kneels low and traces an invisible circle on the ground in front of him using two fingers, intense concentration; cell 2 presses one talisman downward toward invisible ground space, other hand forming a martial finger sign; cell 3 rises into a strong two-hand sealing pose aimed toward the ground ahead, sleeves flaring, triumphant expression, hands empty because the trap is rendered separately; cell 4 returns upright with arms folded and a deeply smug grin, yellow chicken slippers clearly visible.

Make all eight silhouettes, hand positions, and facial expressions strongly distinct and useful for sequential fighting-game animation. Genuine transparent background with clean alpha edges. No clipping and no character redesign.

## 断网大爷拉线与拔线

参考 `../newcomers/motion/unplug_uncle-ground-v1.png`，使用内置imagegen生成 `unplug_uncle-v1.png`。

Use case: stylized-concept. Asset type: transparent 2D fighting game signature-move sprite atlas. Image 1 is the exact character identity, outfit, props, and rendering style reference only. Create a NEW atlas for the same chibi Unplug Uncle: short stocky elderly Chinese man, bald crown with gray side hair, thick gray eyebrows and large gray mustache, stern eyes, white ribbed sleeveless undershirt, blue beach shorts with large white flower prints, orange sash around waist, green flip-flops. Preserve face, proportions, costume, palette, bold anime outlines, and crisp cel shading. Exactly EIGHT separated full-body sprites arranged in FOUR columns and TWO rows with wide fully transparent gutters. Each sprite fits fully inside its equal cell, same scale, facing screen RIGHT in side/three-quarter view, fixed camera, common foot baseline per row. No opponent, no readable text, no grid, no ground shadow, no large energy effects, no logos, no watermark.

Consistent props: one beige four-socket power strip with orange cable, one blue Ethernet cable with a large blue RJ45 plug, and one oversized red electrical plug. Keep props consistent. The game draws long cable extensions and hit waves separately, so only show short cable lengths close to his hands and body; do not draw a cable reaching outside the cell.

Row 1, U cable-pull skill: cell 1 holds the beige power strip on one shoulder and grips the coiled blue Ethernet cable in the other hand, suspicious technician expression; cell 2 swings the short blue cable overhead like a lasso, knees bent and mustache bristling; cell 3 lunges toward screen right and thrusts the blue RJ45 plug forward at chest height, arm fully extended, exact hit moment; cell 4 leans strongly backward and pulls the cable with both hands as if dragging an invisible opponent closer, feet planted.

Row 2, F disconnect meme: cell 1 inspects the power strip and oversized red plug with annoyed expression; cell 2 crouches and grabs the red plug with both hands, preparing to yank it free; cell 3 violently pulls the red plug free and raises it overhead, power strip in the other hand, triumphant angry shout, exact disconnect hit moment; cell 4 throws the unplugged cord over his shoulder and raises both fists in a practical boxing stance, smug satisfied expression, ready to fight offline.

Make all eight silhouettes, hand positions, cable poses, and facial expressions strongly distinct and useful for sequential fighting-game animation. Genuine transparent background with clean alpha edges. No clipping and no character redesign.
