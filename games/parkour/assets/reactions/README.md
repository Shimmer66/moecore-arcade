# 跑酷事件表情

三张透明头像由内置 GPT Image 参考 `packages/assets/whale-runner/runtime` 中相应角色头像生成，
保留蓝发、鲸鳍、尾巴和女仆装。未复制网络表情包。

| 文件                     | 触发事件       | 生成提示词要点                                                                              |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------- |
| `rice-guilty.webp`       | 吃到白饭       | 以 `portrait_happy.webp` 为参考；鼓腮偷吃、心虚侧眼、嘴边饭粒、漫画汗滴；透明背景，无文字。 |
| `thinking-overload.webp` | 吃到未核验假饭 | 以 `portrait_thinking.webp` 为参考；螺旋眼、疑问火花、头顶蒸汽；透明背景，无文字。          |
| `whale-burst.webp`       | 启动大肥鱼爆发 | 以 `portrait_confident.webp` 为参考；星星眼、夸张龇牙笑、举拳冲刺；透明背景，无文字。       |

原始生成图保存在当前任务的 Codex 生成图片目录。运行图使用 FFmpeg 缩至最大 436×512，
转为保留透明通道的 WebP。素材状态为 `generated-pending-review`；这三张是角色同人衍生图，
并非 DeepSeek 官方形象。
