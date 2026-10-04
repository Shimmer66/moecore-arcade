# 素材清单

项目所有者于 2026-09-24 确认游戏生成素材均由其自创，并同意用于公开试玩站点。清单中保留的 `generated-pending-review` 表示品牌、角色形象及成品质量仍待复核，不表示素材作者未知，也不等同于第三方品牌授权。

| assetId          | 文件                            | 来源 / 作者                                                                         | 状态       |
| ---------------- | ------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| `arcade-mark`    | `resources/arcade-mark.svg`     | 摸鱼局 UI 改版绘制的蓝底白色手柄 SVG 标识 / MoeCore Arcade contributors             | 自制占位   |
| `rice-bowl`      | `resources/rice-bowl.svg`       | 本次跑酷玩法扩充绘制的饭碗 / MoeCore Arcade contributors                            | 自制占位   |
| `canteen`        | `resources/canteen.svg`         | 本次跑酷玩法扩充绘制的食堂窗口 / MoeCore Arcade contributors                        | 自制占位   |
| `answer-sea`     | `resources/answer-sea.png`      | 本次数据海场景，以 GPT Image 按项目提示词生成 / MoeCore Arcade contributors         | 生成待复核 |
| `echo-reef`      | `resources/echo-reef.webp`      | 参考数据海画风生成的紫色纸带回音礁 / MoeCore Arcade contributors with GPT Image     | 生成待复核 |
| `request-vortex` | `resources/request-vortex.webp` | 参考数据海画风生成的青蓝请求漩涡 / MoeCore Arcade contributors with GPT Image       | 生成待复核 |
| `starfall-cover` | `resources/starfall-cover.svg`  | 2026-10-04 为《荒星回响：第七码头》绘制的原创矢量封面 / MoeCore Arcade contributors | 自制占位   |

这些图不描绘候选角色，不使用第三方角色原图或品牌 Logo，也不是已经核验商标的正式标识。
饭碗和食堂窗口是特定游戏道具，可随正式构建发布；没有把它们登记成原 72 张素材包中的图片。

《荒星回响：第七码头》的首页封面、局内沙漠车站、两名角色、回响体、漫画拟声与必杀分镜均为本项目 SVG/CSS 绘制。它们只采用宽泛的沙漠旅途与漫画格斗语言，没有复制现成作品的角色名称、造型、招式名称、台词、音频或图片素材。

## 承诺实验室首批试稿

后续视觉重制新增五张透明道具和一张实验室背景，均由内置 image_gen 为本项目生成，沿用 `generated-pending-review`。提示词与工具记录见 [`steady/visual-generation-log.json`](steady/visual-generation-log.json)，原图、透明通道和哈希见同目录素材清单。游戏通过独立图片层接入道具和远景，未把概念图作为碰撞地图。

`steady/` 包含内置 image_gen 生成的四张选定样图：GPT 待接、GPT 硬撑、用户基准、上天接人的组合概念稿。GPT 身份参考本项目已有白龙娘图，另外三张沿用新基准；实际提示词、引用关系与修正记录见 [`steady/generation-log.json`](steady/generation-log.json)，尺寸、透明通道和哈希见 [`steady/manifest.json`](steady/manifest.json)。作者为 MoeCore Arcade contributors with image_gen，状态为 `generated-pending-review`。用户图已接入实验室人物，GPT 两姿态用于对白反应区；组合图仍作预览。硬撑初稿保留在 drafts，不列为选定成品。

## 首页复用资源

局内素材接入又补充 `duel/combat/gpt/atlas.png`：内置 image_gen 参考已有 GPT 基准生成的一张十二姿态透明图集。完整提示词、源图、尺寸、透明通道和哈希见 [generation.json](duel/combat/gpt/generation.json)。与 DeepSeek、豆包的关键姿态和六种特效一起接入战斗；原图不改写，仅按已检查的 viewport 裁显。沿用 `generated-pending-review`，作者为 MoeCore Arcade contributors with image_gen。

推演对决本轮新增 30 张战斗关键姿态与独立特效：DeepSeek、豆包各 12 张人物图及 6 张特效，原图位于 `duel/combat/`。由内置 image_gen 参考已有角色图与新战斗待机图生成，作者为 MoeCore Arcade contributors with image_gen；来源与实际提示词见 [duel/combat-prompts.json](duel/combat-prompts.json)，尺寸、透明通道与哈希见 [duel/combat-manifest.json](duel/combat-manifest.json)，沿用 `generated-pending-review`。两张第二拳旧稿在 `combat/drafts/`，正式图改用转身背拳 v2。当前为动作关键姿态素材，尚未作为校准连续动画接入战斗。

推演对决的首批 12 张静态角色/表情/大招样张另存于 [`duel/`](duel/README.md)，使用内置 image_gen 生成，逐张记录见 [`duel/manifest.json`](duel/manifest.json)，提示词见 [`duel/prompts.json`](duel/prompts.json)。DeepSeek 与 GPT 参考本项目已有肖像，豆包参考用户提供的头像，均保留 `generated-pending-review` 状态；现已通过 `@moecore/assets/duel` 用于选角、表情反馈和大招，不作为连续动作图集或官方形象授权声明。豆包两个旧稿移入 `duel/drafts/`，不在当前 12 张清单中。

推演对决新增六张原创梗图片，存于 `duel/memes/`：缓存命中、已读已堵、版本回滚及三位角色各自的嘴硬结算图。内置 image_gen 参考上述角色基准生成，原图未作代码编辑；提示词与来源见 [duel/meme-prompts.json](duel/meme-prompts.json)，当前 [清单](duel/manifest.json) 共 18 张，沿用 `generated-pending-review`。图片已用于战斗反馈与结算，场内配套道具由 `MemeProp.vue` 绘制。

推演对决封面由 `HOME_ART.duel` 映射到 `resources/duel-cover.svg`，在 `ASSETS.duelCover` 登记为 `original-placeholder`。封面、`games/duel/src/FighterSprite.vue` 内三位角色和 `DuelGame.vue` 内机房场景均为本项目代码绘制的 SVG，作者为 MoeCore Arcade contributors；没有引入第三方角色图、配音或字体。打击音由 Web Audio 合成，台词可选设备本地中文语音。角色形象为原型，仍需成品质量复核。

首页通过 `src/index.ts` 的 `HOME_ART` 公开映射复用以下素材，保留原始来源和审核状态；复用不产生新的授权结论。

| 映射         | 文件                                                             | 用途                       |
| ------------ | ---------------------------------------------------------------- | -------------------------- |
| `match3`     | `match3/assets/tiles/gpt_tile_portrait.png`                      | 首屏白龙娘与消消乐封面     |
| `parkour`    | `parkour/assets/characters/deepseek/poses/deepseek_pose_001.png` | 跑酷首页封面，来自旧素材包 |
| `sokoban`    | `sokoban/runtime/char_S_idle_01.png`                             | 推箱子封面                 |
| `whaleQueue` | `whale-queue/character/portrait_whalegirl_proud.png`             | 首屏角色与鲸鲸封面         |
| `rewrite`    | `rewrite/runtime/deepseek-shoot.webp`                            | AI 娘闯关封面              |

AI 娘闯关首页入口使用 `HOME_ART.rewrite` 映射的 DeepSeek 娘射击姿态；游戏场景结合项目生成位图与 Vue 组件内 SVG。站点标识仍沿用资源元数据中的 `original-placeholder` 分类，当前描述不将其认定为已核验商标。

## 消消乐素材包

`match3/` 包含 70 张独立 PNG，分为角色立绘、头像、棋子、消除表情、道具、障碍物、
静态特效和界面按钮。六张头像棋子已于 2026-09-25 按明确的人设重新生成：DeepSeek 蓝发鲸鱼娘、GPT 白龙娘、Claude 橙发书娘、GLM 黑裙书娘、Gemini 双星娘、Kimi 月弧娘。2026-09-26 又新增十张消除反应图，DeepSeek 与 GPT 各三张，其余四位各一张。原画为本项目生成；[社区角色描述](https://github.com/WPH666-py/AI-Family-Skin-Suit3)只作人设参考，未复制其图片。详细 ID、来源与 SHA-256 见
[`match3/asset-manifest.json`](match3/asset-manifest.json)。

| 范围                                           | 来源 / 状态                                             | 发布限制                                             |
| ---------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| `match3/assets/**`                             | 本次对话生成的同人风格素材 / `generated-pending-review` | 尚无品牌、角色或第三方授权证明，不作为已审核发布素材 |
| `match3/asset-list.csv`、`asset-manifest.json` | 随素材包提供的索引                                      | 用于开发核对，不代表授权证明                         |

## 旧跑酷素材包

`parkour/` 收录用户于 2026-09-21 提供的 400 张独立 RGBA PNG，来自
`萌芯游乐园_AI娘跑酷_400张_一图一素材.zip`。分类、原图记录、原生尺寸和哈希保留在
[`parkour/manifest.json`](parkour/manifest.json)，包内质量声明保留为 `QA_REPORT.json`。

## 推箱子

[`sokoban/manifest.json`](sokoban/manifest.json) 记录大肥鱼推箱子运行时素材及其 `generated-pending-review` 状态。素材说明见 [`sokoban/CREDITS.md`](sokoban/CREDITS.md)。
项目测试另行校验数量、尺寸和哈希；原包声明不能代替实际使用范围的审核。

来源按原包说明登记为 AI 生成参考图的切分整理，状态为 `generated-pending-review`。
当前公开试玩构建按项目所有者的决定展示这些素材，不改变其待审核状态。静态角色姿态不标为已校准连续动画。

## 大肥鱼跑酷素材包

`whale-runner/` 是 2026 年 9 月 21 日提供的 72 张办公室主题素材，
用于《大肥鱼跑酷：答案马上就到》。内容包括蓝发鲸鱼女仆动作、表情、办公室背景、
文档堆、打印机、纸团、算力泡泡和鲸鱼冲刺特效。
来源状态为 `generated-pending-review`，没有随包提供第三方发布授权。

跑酷新增三张 GPT Image 事件表情，存放在 `games/parkour/assets/reactions/`，
以现有角色头像为参考生成。提示词、触发事件和处理方式见该目录的 `README.md`；
同样标为 `generated-pending-review`，不是官方表情包。
跑道角色另外使用三张同源生成的全身搞怪动作，存放在 `games/parkour/assets/actions/`，
具体来源与事件映射见其 `README.md`，状态同为 `generated-pending-review`。

当前没有收录音效或字体文件。消消乐和跑酷图片已用于公开试玩原型；正式发行前仍需确认拟使用方式、
署名要求、品牌与角色相关权利及最终发布范围。源图集和概念参考图没有复制到仓库运行资源目录。

## 鲸鲸的灵感长队素材包

`whale-queue/` 收录用户于 2026-09-22 提供的 `Whale_Queue_Assets_75` 候选包中的核心棋盘、
角色、道具、界面图标和特效，用于《鲸鲸的灵感长队》。完整来源清单、提示词和 QA 记录保留在用户素材目录；
仓库保留了已接入素材，状态为 `generated-pending-review`。它们按项目所有者的确认用于公开试玩，不代表第三方品牌或角色授权已完成。当前棋盘使用简洁 CSS 外框，花边框资源仍保留但不在组件中引用。

新增第三方素材时登记原作者、原始发布页、获取日期、允许修改范围、公开署名和可发布渠道。
授权证据及私信另行内部保存，不提交到本仓库。代码许可证不能替代素材许可。

## 生成事故冒险复用资源

《AI 娘：别乱生成！》复用 `HOME_ART.match3` 和 `HOME_ART.whaleQueue` 作为玩家与解说角色，保留原素材来源及审核状态。平台、星星、出口和事故演出由 SVG/CSS 绘制，短提示音通过 Web Audio 合成；本次没有调用图片生成。

历史弹射原型曾使用 `ARENA_ART` 映射的三张消消乐头像；该映射仍保留，但当前冒险界面不引用它。新增素材须先向项目所有者列明需求并获得确认。

## 生成世界第一批 GPT Image 素材

2026-09-26 按用户确认的试制清单通过内置 GPT Image 生成；过程中按用户要求优先制作 DeepSeek 鲸娘。当前接入 DeepSeek 待机、奔跑关键姿态及第一关背景、平台、桥，另保留此前生成的两张白发龙娘备选图。角色参考项目已有角色设定图，未覆盖原素材。

文件、参考来源和接入方式见 [generated-world/README.md](generated-world/README.md)，原始提示词见 [prompts.json](generated-world/prompts.json)，尺寸与哈希见 [manifest.json](generated-world/manifest.json)。状态为 `generated-pending-review`。

## AI 娘闯关第一批 GPT Image 素材

`rewrite/first-batch/` 收录 DeepSeek 娘与 GPT 娘的射击姿态、Claude 娘待机/奔跑/射击姿态、五关远景、“已读回执怪”、打印机炮台和幻觉大王的两种状态。DeepSeek 与 GPT 分别参考项目已有头像与全身待机图生成。压缩运行图在 `rewrite/runtime/`，现已接入游戏。文件与参考来源见 [rewrite/README.md](rewrite/README.md)，状态为 `generated-pending-review`。
