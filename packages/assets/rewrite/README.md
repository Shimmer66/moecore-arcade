# AI 娘闯关素材

2026-09-26 使用内置 GPT Image 生成项目素材，状态为 `generated-pending-review`。原始 PNG 保存在 `first-batch/`；`python scripts/prepare-rewrite-assets.py` 从原图和已有角色母版制作 `runtime/` 中的轻量 WebP。游戏通过 `@moecore/assets/rewrite` 加载运行图，不在构建中载入原图。

| 原图                                 | 用途                   | 参考素材                                                                                          |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `deepseek-shoot.png`                 | DeepSeek 娘向右射击    | `match3/assets/tiles/deepseek_tile_portrait.png`、`generated-world/first-batch/deepseek-idle.png` |
| `gpt-shoot.png`                      | GPT 娘向右射击         | `match3/assets/tiles/gpt_tile_portrait.png`、`generated-world/first-batch/player-idle.png`        |
| `claude-idle.png`                    | Claude 娘待机          | `match3/assets/characters/claude_pose_01.png`                                                     |
| `claude-run.png`、`claude-shoot.png` | Claude 娘奔跑与射击    | 本批 `claude-idle.png`                                                                            |
| `receipt-walker.png`                 | 移动的空白回执纸敌人   | 原创提示词，无输入图                                                                              |
| `turret.png`                         | 粉色加班打印机炮台     | 原创提示词，无输入图                                                                              |
| `boss-shielded.png`、`boss-open.png` | 幻觉大王护盾与弱点暴露 | 后者参考本批护盾图                                                                                |
| `level-1-background.png`             | 开机热身浮岛           | `generated-world/first-batch/bg-floating-islands.png` 仅作画风参考                                |
| `level-2-background.png`             | 已读走廊               | 本批第一关背景仅作画风参考                                                                        |
| `level-3-background.png`             | 上下文高路             | 本批第一关背景仅作画风参考                                                                        |
| `level-4-background.png`             | 弹幕加班               | 本批第一关背景仅作画风参考                                                                        |
| `level-5-background.png`             | 幻觉大王王宫           | 本批首领和第一关背景作画风参考                                                                    |

运行图还复用 `generated-world/first-batch/` 的 DeepSeek 和 GPT 待机、奔跑姿态及薄荷草沿平台。角色、敌人与平台保留透明通道；背景是不透明图。游戏内的生命、子弹、护盾、星星、进度与命中特效仍由 SVG 绘制，短音效由 Web Audio 合成。

这些图片不是已校准的逐帧动画。角色在空中使用待机图，奔跑使用单张关键姿态。碰撞框、首领弱点时机和平台可站立边界均由游戏规则决定。发布前仍需检查小尺寸识别度、角色造型和最终质量。
