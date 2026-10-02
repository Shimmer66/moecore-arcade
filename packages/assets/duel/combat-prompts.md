# 推演对决 · 30 张战斗素材完整提示词

生成方式：内置 image_gen。每项均为实际使用的完整提示词，可单独复制；参考图按顺序提供。角色姿态与独立特效均已生成，仍需动画补间、锚点与游戏内验证。

中文制作约束与动作用途见 [制作说明](combat/README.md)。机器可读记录和修订历史见 [JSON](combat-prompts.json)。

## duel_deepseek_ready · 战斗待机

- 文件：[combat/deepseek/ready.png](combat/deepseek/ready.png)
- 角色：deepseek；动作：idle
- 参考图：references/duel_ds_base.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Grounded boxing-ready stance, feet apart, knees softly bent, lead fist at chest height and rear fist beside jaw. Face watches opponent at screen right. Clear gap between arms and torso, relaxed but ready.
Asset ID (not rendered): duel_deepseek_ready.
```

## duel_deepseek_dash · 压低冲刺

- 文件：[combat/deepseek/dash.png](combat/deepseek/dash.png)
- 角色：deepseek；动作：dash
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Fast ground dash to the right, torso leaning forward 35 degrees, forward leg reaching and rear leg pushing off; arms trail in a controlled sprinter posture. Hair and tail or scarf trail left; face focused. No speed lines, no duplicates. Lowest planted foot at y=88%.
Asset ID (not rendered): duel_deepseek_dash.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_jump · 起跳腾空

- 文件：[combat/deepseek/jump.png](combat/deepseek/jump.png)
- 角色：deepseek；动作：jump
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Ascending toward screen right, leading knee raised, other leg trailing bent, fists ready. Head at y=14%, feet around y=72%, same body scale as ready pose. Hair and scarf or tail follow momentum. No jump circle or dust.
Asset ID (not rendered): duel_deepseek_jump.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_jab_start · 第一拳·蓄势

- 文件：[combat/deepseek/jab_start.png](combat/deepseek/jab_start.png)
- 角色：deepseek；动作：light1-start
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Grounded short jab ANTICIPATION: chin tucked, leading fist retracted near chest ready to punch right, rear fist guards jaw, torso twists back slightly, bent knees; compact readable anticipation. Both fists visibly closed.
Asset ID (not rendered): duel_deepseek_jab_start.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_jab_hit · 第一拳·直击

- 文件：[combat/deepseek/jab_hit.png](combat/deepseek/jab_hit.png)
- 角色：deepseek；动作：light1-hit
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Grounded short jab CONTACT pose: front arm extends horizontally RIGHT at opponent chest height, fist in side profile, rear hand guards jaw. Forward knee bent, weight shifts onto front foot; fist never points at camera. Smug confident tiny smile.
Asset ID (not rendered): duel_deepseek_jab_hit.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_cross_hit · 第二拳·转身背拳

- 文件：[combat/deepseek/cross_hit_v2.png](combat/deepseek/cross_hit_v2.png)
- 角色：deepseek；动作：light2-hit
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: A powerful SPINNING BACKFIST contact pose attacking SCREEN RIGHT. This must be visibly different from a front-facing straight jab. Show the character's BACK and rear shoulder prominently to camera, torso twisted away about 60 degrees, face visible ONLY in right-facing profile over the attacking shoulder. One bent forearm sweeps horizontally across toward the RIGHT, striking with the BACK of a clenched fist; elbow remains bent 90 degrees, do NOT straighten this arm into a jab. The free arm extends behind to LEFT at waist height as counterbalance, do NOT put it beside the cheek. Wide planted lunge, rear heel lifted, hips strongly rotated. Hair and tail/scarf sweep left. For DeepSeek, rear waist bow of maid apron is visible; for Doubao, back of charcoal sweatshirt is visible. Keep identity, scale, and full figure intact.
Asset ID (not rendered): duel_deepseek_cross_hit.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_kick_hit · 第三脚·横踢

- 文件：[combat/deepseek/kick_hit.png](combat/deepseek/kick_hit.png)
- 角色：deepseek；动作：light3-hit
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Grounded horizontal SIDE KICK to screen right: one leg planted, other leg fully extended at opponent torso height, shoe sole facing right in profile; arms counterbalance and torso leans left. Clean visible separation of both legs. Comically fierce expression. Full extended foot must remain inside canvas.
Asset ID (not rendered): duel_deepseek_kick_hit.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_upper_hit · 挑空上勾拳

- 文件：[combat/deepseek/upper_hit.png](combat/deepseek/upper_hit.png)
- 角色：deepseek；动作：upper-hit
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Rising UPPERCUT contact pose aimed up-right. Lead boot still planted near baseline, other knee bent; fist above face, elbow and shoulder form readable upward arc, body uncoils from crouch. Open fierce shout. No slash or flame.
Asset ID (not rendered): duel_deepseek_upper_hit.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_skill_cast · 专属技能出手

- 文件：[combat/deepseek/skill_cast.png](combat/deepseek/skill_cast.png)
- 角色：deepseek；动作：skill
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: DeepSeek counterattack release: grounded stance, front open palm calmly pushes to the right at chest height, rear fist pulled back ready for devastating counter. Other hand must not hold a prop. Half-lidded completely unbothered face; one eyebrow lifted. Whale tail curls behind her to the left. No monitor, no circle or effects.
Asset ID (not rendered): duel_deepseek_skill_cast.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_guard · 抱架格挡

- 文件：[combat/deepseek/guard.png](combat/deepseek/guard.png)
- 角色：deepseek；动作：guard
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Grounded defensive guard facing right: both forearms crossed in front of face and chest, elbows bent, knees bent, body braces backward slightly. Eyes peek cautiously over arms; hair/scarf or tail recoil left. No shield, bubble, sparks or opponent.
Asset ID (not rendered): duel_deepseek_guard.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_hurt · 重击受创

- 文件：[combat/deepseek/hurt.png](combat/deepseek/hurt.png)
- 角色：deepseek；动作：hurt
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Standing heavy hit recoil: invisible hit came from right, torso bows backward toward left, chin lifts, arms fly apart, knees buckle, one foot retains contact with baseline. Eyes comically squeezed shut, puffed cheek. No injury, blood, bruise, stars or attacker; fully intact clothes.
Asset ID (not rendered): duel_deepseek_hurt.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_deepseek_down · 倒地嘴硬

- 文件：[combat/deepseek/down.png](combat/deepseek/down.png)
- 角色：deepseek；动作：down
- 参考图：references/duel_ds_base.png → combat/deepseek/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: DeepSeek whale maid from reference: cobalt blue hair with cyan tips, blue whale fin ears, one large blue whale tail, white frilly maid headband, cyan hair bow, blue eyes, dark navy long-sleeve dress, white apron and frills, navy boots with small gold bows, small white rice grain on cheek. Preserve all costume colors and accessories. Sleepy-smart expressions turning unexpectedly fierce.
Pose requirement: Knocked down resting on the left hip with feet extending to the right, one forearm props upper body, other clenched fist raised weakly as if still insisting everything is fine. Head on the left, face glances toward opponent on right. Same body scale as standing reference, occupy LOWER half of canvas, body lowest edge y=88%, not magnified to fill canvas. Comically disgruntled, no sign or speech bubble.
Asset ID (not rendered): duel_deepseek_down.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_ready · 战斗待机

- 文件：[combat/doubao/ready.png](combat/doubao/ready.png)
- 角色：doubao；动作：idle
- 参考图：references/duel_doubao_base_v3.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Grounded boxing-ready stance, feet apart, knees softly bent, lead fist at chest height and rear fist beside jaw. Face watches opponent at screen right. Clear gap between arms and torso, relaxed but ready.
Asset ID (not rendered): duel_doubao_ready.
```

## duel_doubao_dash · 压低冲刺

- 文件：[combat/doubao/dash.png](combat/doubao/dash.png)
- 角色：doubao；动作：dash
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Fast ground dash to the right, torso leaning forward 35 degrees, forward leg reaching and rear leg pushing off; arms trail in a controlled sprinter posture. Hair and tail or scarf trail left; face focused. No speed lines, no duplicates. Lowest planted foot at y=88%.
Asset ID (not rendered): duel_doubao_dash.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_jump · 起跳腾空

- 文件：[combat/doubao/jump.png](combat/doubao/jump.png)
- 角色：doubao；动作：jump
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Ascending toward screen right, leading knee raised, other leg trailing bent, fists ready. Head at y=14%, feet around y=72%, same body scale as ready pose. Hair and scarf or tail follow momentum. No jump circle or dust.
Asset ID (not rendered): duel_doubao_jump.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_jab_start · 第一拳·蓄势

- 文件：[combat/doubao/jab_start.png](combat/doubao/jab_start.png)
- 角色：doubao；动作：light1-start
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Grounded short jab ANTICIPATION: chin tucked, leading fist retracted near chest ready to punch right, rear fist guards jaw, torso twists back slightly, bent knees; compact readable anticipation. Both fists visibly closed.
Asset ID (not rendered): duel_doubao_jab_start.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_jab_hit · 第一拳·直击

- 文件：[combat/doubao/jab_hit.png](combat/doubao/jab_hit.png)
- 角色：doubao；动作：light1-hit
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Grounded short jab CONTACT pose: front arm extends horizontally RIGHT at opponent chest height, fist in side profile, rear hand guards jaw. Forward knee bent, weight shifts onto front foot; fist never points at camera. Smug confident tiny smile.
Asset ID (not rendered): duel_doubao_jab_hit.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_cross_hit · 第二拳·转身背拳

- 文件：[combat/doubao/cross_hit_v2.png](combat/doubao/cross_hit_v2.png)
- 角色：doubao；动作：light2-hit
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: A powerful SPINNING BACKFIST contact pose attacking SCREEN RIGHT. This must be visibly different from a front-facing straight jab. Show the character's BACK and rear shoulder prominently to camera, torso twisted away about 60 degrees, face visible ONLY in right-facing profile over the attacking shoulder. One bent forearm sweeps horizontally across toward the RIGHT, striking with the BACK of a clenched fist; elbow remains bent 90 degrees, do NOT straighten this arm into a jab. The free arm extends behind to LEFT at waist height as counterbalance, do NOT put it beside the cheek. Wide planted lunge, rear heel lifted, hips strongly rotated. Hair and tail/scarf sweep left. For DeepSeek, rear waist bow of maid apron is visible; for Doubao, back of charcoal sweatshirt is visible. Keep identity, scale, and full figure intact.
Asset ID (not rendered): duel_doubao_cross_hit.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_kick_hit · 第三脚·横踢

- 文件：[combat/doubao/kick_hit.png](combat/doubao/kick_hit.png)
- 角色：doubao；动作：light3-hit
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Grounded horizontal SIDE KICK to screen right: one leg planted, other leg fully extended at opponent torso height, shoe sole facing right in profile; arms counterbalance and torso leans left. Clean visible separation of both legs. Comically fierce expression. Full extended foot must remain inside canvas.
Asset ID (not rendered): duel_doubao_kick_hit.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_upper_hit · 挑空上勾拳

- 文件：[combat/doubao/upper_hit.png](combat/doubao/upper_hit.png)
- 角色：doubao；动作：upper-hit
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Rising UPPERCUT contact pose aimed up-right. Lead boot still planted near baseline, other knee bent; fist above face, elbow and shoulder form readable upward arc, body uncoils from crouch. Open fierce shout. No slash or flame.
Asset ID (not rendered): duel_doubao_upper_hit.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_skill_cast · 专属技能出手

- 文件：[combat/doubao/skill_cast.png](combat/doubao/skill_cast.png)
- 角色：doubao；动作：skill
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Doubao bubble-casting release: grounded stance, front open palm forcefully pushes to screen right, rear hand braces front elbow, head tilts forward with a cheeky matter-of-fact grin. Red scarf whips left. She is casting a projectile but the projectile is NOT in this image; clean character only.
Asset ID (not rendered): duel_doubao_skill_cast.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_guard · 抱架格挡

- 文件：[combat/doubao/guard.png](combat/doubao/guard.png)
- 角色：doubao；动作：guard
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Grounded defensive guard facing right: both forearms crossed in front of face and chest, elbows bent, knees bent, body braces backward slightly. Eyes peek cautiously over arms; hair/scarf or tail recoil left. No shield, bubble, sparks or opponent.
Asset ID (not rendered): duel_doubao_guard.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_hurt · 重击受创

- 文件：[combat/doubao/hurt.png](combat/doubao/hurt.png)
- 角色：doubao；动作：hurt
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Standing heavy hit recoil: invisible hit came from right, torso bows backward toward left, chin lifts, arms fly apart, knees buckle, one foot retains contact with baseline. Eyes comically squeezed shut, puffed cheek. No injury, blood, bruise, stars or attacker; fully intact clothes.
Asset ID (not rendered): duel_doubao_hurt.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_doubao_down · 倒地嘴硬

- 文件：[combat/doubao/down.png](combat/doubao/down.png)
- 角色：doubao；动作：down
- 参考图：references/duel_doubao_base_v3.png → combat/doubao/ready.png

```text
Use case: stylized-concept. Asset type: a single full-body key pose for an original humorous 2D side-view anime fighting game. Generate ONE character, ONE pose on a genuinely transparent RGBA background, square canvas. Reference image is identity/costume reference only. Crisp hand-drawn cel shading, strong navy outlines, clean readable silhouette at 160 pixels tall. Keep a consistent compact 3-head-tall proportion, no realistic rendering. Camera fixed at waist height, orthographic side view with a very slight three-quarter turn that shows the face, character facing and attacking to SCREEN RIGHT, never looking at the viewer. Full hair, hands, feet and accessories inside canvas; no cropping. Character resting hip centered around x=45% of canvas. Grounded sole baseline y=88%, standing head top around y=18%; maintain that character scale in all poses, leaving room to the right for attacks. Keep at least 8% transparent padding on every side. Flat soft upper-left lighting. No scenery, floor, ground shadow, motion blur, duplicates, afterimage, aura, effect, impact star, text, numbers, label, watermark, border, grid or fake checkerboard. Limbs anatomically clear, exactly two arms and two legs. Fully clothed action comedy. This is a clean character layer; effects will be separate assets.
Identity lock: Doubao from reference: dark brown CHIN-LENGTH SIDE-PARTED BOB, exposed forehead, dark eyes, long RED SCARF, charcoal sweatshirt, black shorts over opaque dark leggings, black/red sneakers with white soles. No maid dress, no twin buns, no straight bangs, no orange outfit, no white shirt. Preserve the recognizable bob/scarf silhouette. Confident helpful expression turning comically blunt.
Pose requirement: Knocked down resting on the left hip with feet extending to the right, one forearm props upper body, other clenched fist raised weakly as if still insisting everything is fine. Head on the left, face glances toward opponent on right. Same body scale as standing reference, occupy LOWER half of canvas, body lowest edge y=88%, not magnified to fill canvas. Comically disgruntled, no sign or speech bubble.
Asset ID (not rendered): duel_doubao_down.
Reference image 2 is the approved side-facing combat stance: match its head/body proportions, exact costume and linework. Change only the pose and expression requested; do not redesign the fighter.
```

## duel_fx_whale_arc · 鲸尾蓝弧

- 文件：[combat/effects/whale_arc.png](combat/effects/whale_arc.png)
- 角色：deepseek；动作：effect
- 参考图：无；全新独立特效

```text
Use case: stylized-concept. ONE isolated 2D fighting-game VFX cutout on a genuinely transparent RGBA background, square canvas. Bright cel shading, crisp graphic shapes and clean navy accent edges matching an anime chibi arcade fighter. Full effect inside canvas with 10% clear padding. A single broad cyan and cobalt crescent attack arc shaped like the sweep of a whale tail, sweeping left-to-right, a compact stylized whale-tail silhouette embedded at the advancing RIGHT tip, sharp white leading edge, three small water droplets trailing left. No character, no literal scene of water. Clean separated skill layer. No text, letters, watermark, checkerboard, colored background, scenery, gradients fading to opaque black, or contact sheet. Asset ID (not rendered): duel_fx_whale_arc.
```

## duel_fx_bubble · 包的·可反弹气泡

- 文件：[combat/effects/bubble.png](combat/effects/bubble.png)
- 角色：doubao；动作：effect
- 参考图：无；全新独立特效

```text
Use case: stylized-concept. ONE isolated 2D fighting-game VFX cutout on a genuinely transparent RGBA background, square canvas. Bright cel shading, crisp graphic shapes and clean navy accent edges matching an anime chibi arcade fighter. Full effect inside canvas with 10% clear padding. ONE glossy coral-pink speech bubble projectile, nearly circular, a small triangular speech-tail pointing left, bright white specular highlights, translucent rosy interior, tiny smug dot eyes and a curved smile. Comically inflated, enough clean outline to read at 48 pixels. No text or character. No text, letters, watermark, checkerboard, colored background, scenery, gradients fading to opaque black, or contact sheet. Asset ID (not rendered): duel_fx_bubble.
```

## duel_fx_bubble_pop · 没包住·气泡破裂

- 文件：[combat/effects/bubble_pop.png](combat/effects/bubble_pop.png)
- 角色：doubao；动作：effect
- 参考图：无；全新独立特效

```text
Use case: stylized-concept. ONE isolated 2D fighting-game VFX cutout on a genuinely transparent RGBA background, square canvas. Bright cel shading, crisp graphic shapes and clean navy accent edges matching an anime chibi arcade fighter. Full effect inside canvas with 10% clear padding. ONE radial bursting pink speech bubble effect, hollow irregular opening at center, six thick curved translucent pink rubbery fragments flying outward and four small droplets. Large clean shapes. The outline hints at a speech bubble falling apart; no intact bubble, no character. No text, letters, watermark, checkerboard, colored background, scenery, gradients fading to opaque black, or contact sheet. Asset ID (not rendered): duel_fx_bubble_pop.
```

## duel_fx_hit_heavy · 重拳爆点

- 文件：[combat/effects/hit_heavy.png](combat/effects/hit_heavy.png)
- 角色：shared；动作：effect
- 参考图：无；全新独立特效

```text
Use case: stylized-concept. ONE isolated 2D fighting-game VFX cutout on a genuinely transparent RGBA background, square canvas. Bright cel shading, crisp graphic shapes and clean navy accent edges matching an anime chibi arcade fighter. Full effect inside canvas with 10% clear padding. ONE striking angular heavy-hit impact burst, hot ivory center and golden orange outer spikes, long diagonal primary spike from bottom-left to top-right, short secondary spikes, three chunky orange fragments around it. Punchy cel-shaded arcade fighting impact, asymmetric silhouette, no ring, no words. No text, letters, watermark, checkerboard, colored background, scenery, gradients fading to opaque black, or contact sheet. Asset ID (not rendered): duel_fx_hit_heavy.
```

## duel_fx_guard_spark · 格挡火花

- 文件：[combat/effects/guard_spark.png](combat/effects/guard_spark.png)
- 角色：shared；动作：effect
- 参考图：无；全新独立特效

```text
Use case: stylized-concept. ONE isolated 2D fighting-game VFX cutout on a genuinely transparent RGBA background, square canvas. Bright cel shading, crisp graphic shapes and clean navy accent edges matching an anime chibi arcade fighter. Full effect inside canvas with 10% clear padding. ONE compact ice-blue guard impact: a curved defensive crescent facing screen RIGHT, white contact flash at its middle, six short cyan sparks fanning right and two concentric partial arcs behind. Clean open center and readable at small scale, no actual shield, no character. No text, letters, watermark, checkerboard, colored background, scenery, gradients fading to opaque black, or contact sheet. Asset ID (not rendered): duel_fx_guard_spark.
```

## duel_fx_landing_dust · 砸地烟尘

- 文件：[combat/effects/landing_dust.png](combat/effects/landing_dust.png)
- 角色：shared；动作：effect
- 参考图：无；全新独立特效

```text
Use case: stylized-concept. ONE isolated 2D fighting-game VFX cutout on a genuinely transparent RGBA background, square canvas. Bright cel shading, crisp graphic shapes and clean navy accent edges matching an anime chibi arcade fighter. Full effect inside canvas with 10% clear padding. ONE low wide ground-slam dust burst, symmetric outward puffs of pale grey-blue smoke with ivory edges, hollow center reserved for character feet, two tiny dark debris chips. Side-view orthographic, width twice height, effect fully visible centered in square canvas, lower baseline at y=80%, transparent surrounding and gaps. No floor, no terrain or character. No text, letters, watermark, checkerboard, colored background, scenery, gradients fading to opaque black, or contact sheet. Asset ID (not rendered): duel_fx_landing_dust.
```
