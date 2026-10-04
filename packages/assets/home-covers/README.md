# 首页游戏封面

2026-10-04 使用内置 `image_gen` 为首页游戏卡片生成七张方形封面。所有封面均以实际游戏截图和仓库内角色、道具素材作为参考，状态为 `generated-pending-review`，作者记为 MoeCore Arcade contributors with GPT Image。

封面不包含游戏名称、UI、Logo 或水印；标题继续由首页卡片的 HTML 文本提供。生成原图为 1254×1254 PNG，发布图使用 Pillow 缩放为 768×768、WebP quality 86。

| 文件                     | 主要画面                                  | 参考素材                               |
| ------------------------ | ----------------------------------------- | -------------------------------------- |
| `steady-cover.webp`      | GPT 被弹簧垫接住，气球与磁铁改变轨迹      | 实际实验室截图、`steady_gpt_ready.png` |
| `arena-cover.webp`       | DeepSeek 跳过崩塌平台，躲避尖刺并追赶出口 | 实际关卡截图、`deepseek-run.png`       |
| `match3-cover.webp`      | 角色棋盘中三枚 DeepSeek 图块消除          | 实际棋盘截图、三位角色反应图块         |
| `parkour-cover.webp`     | DeepSeek 抱白饭越过退件文档与打印机       | 实际菜单截图、`char_run_03.webp`       |
| `sokoban-cover.webp`     | 鲸娘把木箱推向发光目标点                  | 实际棋盘截图、推箱动作、木箱、目标点   |
| `whale-queue-cover.webp` | 鲸娘带三只小鲸绕开礁石收集灵感星          | 实际棋盘截图、玩家、小鲸、灵感星       |
| `rewrite-cover.webp`     | DeepSeek、GPT、Claude 在数据战场射击      | 实际选角截图、三位角色射击姿态         |

## 最终提示词摘要

每张图均使用 `stylized-concept`：方形游戏目录封面、2D 动漫 Q 版游戏主视觉、清晰轮廓、100px 缩略图可读、主体保留裁切安全区。要求保留参考角色的发型、服装、比例与配色；禁止 UI、标题、字母、数字、Logo、水印、写实摄影和静态头像构图。

具体场景分别限定为物理实验室、浮空岛陷阱、三消玻璃棋盘、数据海跑酷、薄荷色推箱棋盘、数据海鲸鲸队列和横版数据战场。生成时每项仅生成一张最终候选，没有保留废弃变体。
