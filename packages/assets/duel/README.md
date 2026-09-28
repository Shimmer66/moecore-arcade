# 推演对决 · 角色与原创梗素材

## 新增战斗素材包

新批次补充 DeepSeek、豆包各 12 张战斗关键姿态与 6 张独立特效，共 30 张；与下方原有 18 张合计 48 张选定素材。见 [战斗素材预览](combat-preview.html)、[完整逐图提示词](combat-prompts.json)、[动作制作说明](combat/README.md)与[战斗清单](combat-manifest.json)。原始图位于 `combat/`，两张第二拳旧稿位于 `combat/drafts/`，不计入选定数量。

本批已经校准脚底锚点并接入局内动作与特效，另补 [GPT 十二姿态图集](combat/gpt/README.md)一张，三人均以 PNG 绘制，图片失败回退可动 SVG。仍需继续补中间帧才能成为完整逐帧动画。原有 `manifest.json` 记录 18 张，`combat-manifest.json` 记录本批 30 张，GPT 图集来源单独登记；共 49 个选定 PNG 文件。运行时布局记录见 [combat-geometry.json](combat-geometry.json)。

五张体积最大的动作图集在 `runtime/` 保留原尺寸与透明通道生成 WebP 副本，游戏加载副本，`combat/` 中的 PNG 仍是编辑原图。需要重新生成时，在仓库根目录运行 `python scripts/prepare-duel-runtime-assets.py`；不要修改图集尺寸，否则裁切坐标会失准。

## 原有角色与互动素材

本目录用于保存[素材方案](../../../docs/games/deepseek-duel-assets.md)的 12 张独立样张：三位角色各包含全身基准、两种表情和一张大招关键画面。

新增六张原创梗透明图片，当前共 18 张。新图位于 [memes/](memes/)，完整提示词、参考图片与生成来源见 [meme-prompts.json](meme-prompts.json)：

| 文件                         | 游戏用途                                     |
| ---------------------------- | -------------------------------------------- |
| `duel_ds_cache_hit.png`      | 缓存命中：DeepSeek 抱着回放显示器            |
| `duel_gpt_muffled.png`       | 已读已堵：GPT 嘴被气泡堵住，耳朵继续输出纸条 |
| `duel_gpt_rollback.png`      | 版本回滚：GPT 撤回失败版本的残影             |
| `duel_ds_sore_loser.png`     | DeepSeek 败局举牌                            |
| `duel_gpt_sore_loser.png`    | GPT 败局举牌                                 |
| `duel_doubao_sore_loser.png` | 豆包败局举牌；沿用侧分短发、红围巾与深色上衣 |

六张新图均由内置 image_gen 参考已确认角色图生成，保留未经代码修改的原始 RGBA PNG，透明通道实际范围均为 0–255。通过 `DUEL_MEME_ART` 和 `DUEL_SORE_LOSER_ART` 接入游戏；场内同步使用可动 SVG 道具。牌子文字由界面绘制，结算时从“失败”翻为“战略性休息”。预览页默认显示六张新梗，可切换全部 18 张。

生成方式：内置 image_gen。使用项目已有 DeepSeek / GPT 肖像作为身份参考，再以首张基准统一画风。豆包以用户直接提供的头像为身份依据，固定为深棕侧分短发、露额头、红围巾和深色上衣，依据见[形象核对与修正](doubao-reference.md)。下装为游戏化补全；表情与道具为本项目创作。

首批 12 张样张已完成：9 张 1254 × 1254 角色/表情图，3 张 1672 × 941 大招关键画面，全部为含真实透明通道的 RGBA PNG。大招画面是静态演出样稿，不是完整动画或已拆分的动作精灵。角色设计、成品效果仍需试玩复核。

`drafts/duel_doubao_base_v1-rejected.png` 与 `drafts/duel_doubao_base_v2.png` 为弃稿，不在当前素材清单中。当前豆包基准是 `first-batch/duel_doubao_base_v3.png`，表情与大招都由它派生。

最终图片放在 [first-batch/](first-batch/)，完整提示词保存到 [prompts.json](prompts.json)，实际尺寸、透明通道、透明像素比例与哈希保存到 [manifest.json](manifest.json)。[preview.html](preview.html) 提供按角色分组的深浅底、透明棋盘底、放大翻页和原图下载。

## 验证与使用

- 逐张检查角色身份、表情、道具与大招构图；豆包四张图统一为用户参考的侧分露额、红围巾和深色上衣。
- 实际解码全部 18 张 PNG，检查 RGBA、透明通道范围 0–255、尺寸和 SHA-256；保留生成原图，未通过代码改图或重采样。
- 浏览器检查全部 18 张图片加载、新梗/全部筛选、深浅底切换、放大与翻页、Escape 关闭，以及 390px 无横向溢出；截图已复核。
- 已通过 `@moecore/assets/duel` 接入对战选角、搞怪表情、大招、三人战斗关键姿态和独立特效，加载失败回退为 SVG。完整逐帧补间仍待后续制作。
- `node scripts/build-duel-art-review.mjs` 可在仓库根目录重新生成清单和预览页；仅在图片哈希未变时保留已有透明像素统计，图片改变后须重新检查。
