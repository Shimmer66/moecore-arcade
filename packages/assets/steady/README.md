# 承诺实验室：首批四张素材

本包由内置 image_gen 工具生成。首批四张样图包括三张透明角色图，以及一张组合场景概念稿。用户基准已用于实验室人物；GPT 待接与硬撑用于对白反应区和接应点。组合图仍仅用于预览。

视觉重制又新增五张道具图与一张深靛色远景，当前清单共十张选定素材。新一批提示词见 [visual-generation-log.json](visual-generation-log.json)，实际尺寸、alpha 和渲染裁切区域见 [manifest.json](manifest.json)。游戏通过 SVG viewBox 映射主体区域，原始文件未被重采样或抠图改写。

| 新素材     | 文件                           |
| ---------- | ------------------------------ |
| 铁锅       | props/steady_pot_v2.png        |
| 气球       | props/steady_balloon_v2.png    |
| 磁铁       | props/steady_magnet_v2.png     |
| 蹦床       | props/steady_pad_v2.png        |
| 固定平台   | props/steady_shelf_v2.png      |
| 实验室远景 | backgrounds/steady_room_v2.png |

- [预览页](preview.html)：支持棋盘、浅底和深底检查透明边缘。
- [素材清单](manifest.json)：实际尺寸、透明像素比例、边界和 SHA-256。
- [实际生成提示词](generation-log.json)：包含参考关系及硬撑图的修正提示词。
- [完整 20 条策划提示词](../../../docs/games/steady-asset-prompts.json)：另外 16 张尚未生成。

| ID                | 文件                             | 用途               |
| ----------------- | -------------------------------- | ------------------ |
| steady_gpt_ready  | characters/steady_gpt_ready.png  | 白龙娘待接基准     |
| steady_gpt_strain | characters/steady_gpt_strain.png | 第二版硬撑表情     |
| steady_user_base  | characters/steady_user_base.png  | 用户角色基准       |
| steady_key_sky    | concepts/steady_key_sky.png      | 上天接人的组合构图 |

GPT 参考项目已有的 `duel/first-batch/duel_gpt_base.png`。其他三张沿用新生成的角色基准，具体参考与原始生成文件名见日志。

硬撑图第一版表情接近眨眼卖萌，保留在 `drafts/steady_gpt_strain-v1.png`，不计入四张选定稿。第二版加强了双眼失衡、缩小瞳孔和僵硬笑容。

三张角色图实际为 1254×1254 RGBA，alpha 范围均为 0–255；组合图为 1536×1024 RGB。保留工具返回原生像素，没有重采样或剪切。

已人工检查角色主体、一致性和基本构图。用户按 52×78 逻辑显示区域映射主体，物理半径仍为 19；GPT 使用对白区与接应点的静态图片，没有直接把完整立绘用作碰撞体。角色留白并非严格的 10%，其他姿态仍需单独对齐；这些不是连续动画帧。

状态为 `generated-pending-review`，不据此增加官方关联或第三方角色授权声明。
