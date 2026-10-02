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

上述早期图片是单张姿态；2026-09-28 已接入下文的动作图集。碰撞框、首领弱点时机和平台可站立边界均由游戏规则决定。

## 2026-09-28 模型战争补充素材

通过内置 GPT Image 生成，运行时直接引用 PNG；未调用外部图片下载。已检查生成图及浏览器中的实际显示。来源路径仅记录文件名，不包含机器私人路径。

| 文件                                | 尺寸     | 用途                                                          |
| ----------------------------------- | -------- | ------------------------------------------------------------- |
| `runtime/server-war-background.png` | 1881×836 | 服务器工厂远景，后三关共享并叠加不同关卡色                    |
| `runtime/boss-atlas.png`            | 1774×887 | 4列×2行、透明背景，八个原创 Boss。SVG 按 443.5×443.5 单元显示 |

背景生成指令：Wide 2D side-scrolling original anime arcade AI server megafactory; cyan pipes, violet neural reactor, indigo atmospheric layered industrial scene; lower third dark and uncluttered; side-on camera; no platforms, characters, text or logos.

Boss 图集生成指令：Original anime AI meme side-scrolling run-and-gun enemy boss sprite atlas. Landscape exactly four columns and two rows, eight square cells, isolated on actual transparent background; no overlapping text, UI, borders or logos. Cute menacing chibi mechanical monsters, readable silhouettes, polished hand-painted style. Top row: cyan traffic-gate robot, orange printer tank, lavender context jellyfish, pink eyed book mimic. Bottom row: red furnace tank, green spider dispatcher with drones, blue shield fortress, purple neural queen. Center complete full body in each cell with transparent margins. Eight distinct original designs in consistent style.

生成结果标识：背景 `exec-27ef3438-6b77-43f3-9404-e2e7d9fe3ee6.png`；Boss `exec-6ae24842-bcf4-48fa-a4b1-0a4933f1e726.png`。上述文字为生成要求记录；素材是否适配以运行时检查为准。原来的单体 Boss 图保留来源记录，新战役使用新图集。

## 2026-09-28 纵深角色图集

`runtime/depth-operators.png`：2172×724，三个 724×724 等宽单元，从左到右为 DeepSeek、GPT、Claude 娘的背向射击姿态。来源为内置 GPT Image；生成结果文件名 `call_HEN1Zy3EJ1yd76vhKMcgnTPN.png`。输入参考为本目录已有的三张角色待机运行图 `deepseek-idle.webp`、`gpt-idle.webp`、`claude-idle.webp`。原图保留在工具输出目录，项目使用复制件；保留透明通道，通过 SVG viewBox 分格显示。

生成要求记录：Create a polished 2D game sprite atlas based on the three supplied original character references, preserving identity and costume. Exactly three equal square cells in one horizontal row, transparent alpha, no text or borders. Left blue-haired whale maid; middle silver-haired white dragon girl in green-white dress; right warm brown-haired flower beret girl in brown-white frills. All seen from behind, slight rear three-quarter, facing away into the distance and aiming a small cute sci-fi rifle over the right shoulder. Full body and planted feet; consistent chibi scale, preserve hair, headwear, tails/horns and colors. No front-facing faces, bullets, muzzle flashes, floor or logos. Center each sprite with transparent padding. Clean detailed line art and readable shading.

已检查生成图和桌面/移动浏览器中的实际显示；当前为背向关键姿态，不是逐帧行走动画。

## 2026-09-28 动作、装备与敌人补图

全部由内置 GPT Image 生成，保留透明 PNG、原始工具输出和项目复制件。生成标识与要求记录在 `motion-and-loadout-prompts.json`，校准矩形位于 `packages/assets/src/rewrite.ts` 和 `games/rewrite/src/ItemArt.vue`。没有从其他游戏提取素材。

| 运行文件                                                                | 尺寸         | 实际用途                                                               |
| ----------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| `deepseek-motion-v1.png` / `gpt-motion-v1.png` / `claude-motion-v1.png` | 各 1536×1024 | 各四帧奔跑、团身跳跃、卧倒；共 18 单元                                 |
| `aim-motion-v1.png`                                                     | 1448×1086    | 三角色各四方向瞄准；12 单元                                            |
| `depth-motion-v1.png`                                                   | 1448×1086    | 三角色各三背向迈步与低姿态；12 单元                                    |
| `loot-atlas-v1.png`                                                     | 1254×1254    | 六武器、护盾、医疗、手雷；9 单元，武器栏与横版/纵深掉落                |
| `enemy-atlas-v1.png`                                                    | 1536×1024    | 回执步兵、打印机炮台、无人机、狙击机、弹簧垃圾邮件怪、炉口机关；6 单元 |

动作图集按透明边界与脚底锚点校准，使用暂停模拟时钟切帧。旧的背向单姿态图只在新图尚未加载时短暂显示。道具图标使用内部 SVG 视窗裁切，避免宽按钮露出相邻单元。敌机分别映射到真实敌人类型，炉口用于火墙危险区。桌面/手机实景已检查角色动作、透明边缘、图标裁切及新敌人显示。

## 独立地形改版的场景补图

熔炉与最终关各增加一张内置 GPT Image 生成的专用背景，均为 1881×836、不透明 PNG。第五关 `runtime/token-furnace-background.png` 表现 GPU 熔炉与热交换管线，替换不合主题的旧宫殿；第八关 `runtime/neural-nest-background.png` 表现记忆囊与神经核心，替换共用服务器工厂。生成原件保留，项目引用复制件；完整提示词和结果标识在 `scenery-prompts.json`。

背景本身没有碰撞。画面中可站立表面仍由实际平台绘制。首关和瀑布高台另外复用现有 `runtime/platform.webp` 草沿素材；工业平台以金属结构、运输方向标记及发光边缘区分。

## 2026-09-29 补给载具与独立增益

`runtime/powerup-atlas-v1.png` 为内置 GPT Image 生成的 1536×1024 RGBA 图集，三列两行，各单元512×512。依次为飞行胶囊、关闭补给箱、算力超频芯片、沙盒力场发生器、全量清理脉冲和打开的空箱。工具原件保留，项目使用复制件。完整提示词、结果标识和集成位置见 `powerup-prompts.json`。

六个单元均已投入游戏：横向/纵向补给载具、箱体被击毁后的状态、纵深补给节点、释放道具与增益倒计时。和早期护盾图标区分：普通护盾以青色层数显示，限时力场使用紫色球形图像和秒数。

## 基地组合弱点节点

`runtime/depth-node-atlas-v1.png` 为内置 GPT Image 生成并修正留白后的1254×1254透明图集，四个627×627单元分别为蓝色计划、薄荷执行、橙色反思和紫色复核机械节点。第一张结果的天线与边缘过紧，第二次编辑恢复完整轮廓并扩大间隔，选用后者；原图和编辑原件均保留在工具输出目录。

第二关Boss使用两个不同高度的固定外围节点，第六关使用两组相向移动节点。四个单元全部接入 `DepthBattle.vue`，橙色保护、绿色暴露与连线为独立SVG覆盖层，与实际规则同步。手机实景检查后缩小节点并降低受保护主核心的不透明度，避免可攻击节点被遮住。提示词、编辑指令和结果标识见 `depth-node-prompts.json`。

## 最终神经巢穴

`runtime/neural-nest-atlas-v1.png` 为内置 GPT Image 生成的1254×1254透明图集，四个627×627单元依次为孵化节点、幻觉幼体、推理心核和破碎空壳。前三个单元已用于终关真实敌人和弱点，空壳保留为后续持续破坏反馈素材；完整提示词和结果标识见 `neural-nest-prompts.json`。

终关背景继续使用 `runtime/neural-nest-background.png`。图集只提供实体造型，孵化冷却、幼体移动、心核血量、Boss保护和命中框均由规则决定；标签、血条、受击闪烁和保护提示由SVG绘制。桌面与手机均检查过心核围绕Boss、节点关闭提示和幼体显示。
