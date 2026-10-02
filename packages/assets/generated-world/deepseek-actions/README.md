# DeepSeek 动作图

- 工具：内置 GPT Image / image_gen，2026-09-28。
- 参考：`../first-batch/deepseek-idle.png`，保留角色身份和服装。
- 原始文件：`atlas.png`，实际尺寸 1254 × 1254，RGBA。
- SHA-256：`8FCA2CD49EB6CBC9FC4D37BEEB07B15F6F2C42C41EB20AF48D1D32C8DB23492B`
- 包含：起跳、下落、落地、失败四个关键姿态。不是完整逐帧动画。
- 生成结果没有遵守请求的 2048 等分网格。实测中部透明行 680–710、
  透明列约 650–686；运行时用 SVG viewBox 分区，不修改母版。
- 当前取图区：左上 `0 0 670 695`，右上 `670 0 584 695`，
  左下 `0 695 670 559`，右下 `670 695 584 559`。角色脚底与统一比例单独锚定。

## 最终提示词

Use case: identity-preserve. Asset type: transparent 2D game character action atlas. Use the supplied reference solely for character identity and rendering style. Preserve the same chibi blue-haired whale girl, huge blue eyes, navy and white maid outfit, whale apron emblem, blue whale tail, blue bow and white headband. Create a square 2048x2048 sprite atlas divided into exactly four equal 1024x1024 cells in a precise 2 by 2 grid, no visible grid lines. Each cell has one complete isolated full-body pose, same character scale, facing screen right in three-quarter side view, centered horizontally in its own cell with ample transparent margin. TOP LEFT: energetic takeoff, one knee raised, arms balancing, hair and tail trailing downward. TOP RIGHT: falling pose, hands lifted and knees bent, hair floating up, surprised focused expression. BOTTOM LEFT: landing squash, crouched knees, one hand near the floor, determined face. BOTTOM RIGHT: comic non-graphic defeat, seated with dizzy spiral eyes, tilted head, tail curled, tiny drawn star marks close to head. Each standing-sized character fits within 780 by 850 pixels of its cell; keep all limbs, hair, tail and marks inside its own cell. Render clean polished anime cel shading with crisp outline and consistent costume and proportions. True transparent background, no floor, no shadows, no text, no labels, no interface, no framing, no watermark. This is a final game sprite sheet, not a presentation.
