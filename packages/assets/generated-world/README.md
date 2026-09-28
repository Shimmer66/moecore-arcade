# 生成世界 · 第一批试制素材

制作工具：内置 GPT Image（`image_gen`）。批次：2026-09-26。用户在制作过程中要求优先 DeepSeek，因此当前预览优先接入 DeepSeek 鲸娘。

## 文件与用途

| 文件                                  | 用途                      | 当前接入                   |
| ------------------------------------- | ------------------------- | -------------------------- |
| `first-batch/deepseek-idle.png`       | DeepSeek 全身待机母版     | 玩家待机、空中和首页入口   |
| `first-batch/deepseek-run.png`        | DeepSeek 单张奔跑关键姿态 | 玩家地面移动时切换         |
| `first-batch/bg-floating-islands.png` | 幻觉浮岛背景              | 第一关背景                 |
| `first-batch/platform.png`            | 薄荷草沿、淡紫岩石平台    | 第一关地面和浮台           |
| `first-batch/bridge.png`              | 幻觉桥实体                | 第一关可行走桥，事故时隐藏 |
| `first-batch/player-idle.png`         | 白发龙娘待机母版          | 已生成的备选，保留原图     |
| `first-batch/player-run.png`          | 白发龙娘奔跑关键姿态      | 已生成的备选，保留原图     |

全部原始 PNG 已复制到项目中。角色、平台、桥均为 RGBA 透明图，背景为 RGB。尺寸、透明信息、可见区域和 SHA-256 见 `manifest.json`；原始提示词见 `prompts.json`。

DeepSeek 母版参考 `match3/assets/tiles/deepseek_tile_portrait.png` 的当前形象及 `whale-runner/runtime/ref_character_right.webp` 的全身服装，奔跑图引用新母版。白发龙娘参考 `match3/assets/tiles/gpt_tile_portrait.png`。背景参考白发母版的柔和插画风格，平台与桥参考新背景配色。

## 接入约定

资源通过 `@moecore/assets/generated-world` 导出。角色按可见高度归一为 72 个逻辑单位，并使用各图实际脚底基线定位。平台与桥通过嵌套 SVG 的 `viewBox` 对齐平直可站立边缘；原始文件没有被裁切或覆盖。碰撞仍由规则数据决定。

当前只有待机和一张奔跑关键姿态，尚未制作完整跑步帧、起跳、落地或倒挂专用动画。奔跑状态切图并使用轻微动态反馈，不应称为完整跑步循环。第二、三关仍使用既有程序绘制背景。

蓝发鲸娘是当前试制预览主角，白发龙娘素材保留为后续选择。素材属于本项目生成稿，状态为 `generated-pending-review`；此分类不表示已完成品牌或成品质量审核。
