# 2026-10-08 加载性能优化

## 范围

- 站点横屏和竖屏背景。
- 首页星尘远征封面。
- `packages/assets/src/stardust.ts` 实际引用的 59 张星尘图片。

原 PNG 继续作为源素材保留；运行时改用同尺寸 WebP，不改变精灵图坐标、裁切或透明通道。

## 本地冷加载测量

使用生产构建、Vite preview 和全新 Chromium context，等待 `networkidle` 后统计响应
`content-length`。星尘战斗数据包含从直接进入游戏、显示选角到启动 AI 伙伴冒险。

| 场景             |    优化前 |    优化后 | 减少 |
| ---------------- | --------: | --------: | ---: |
| 首页             |   6.00 MB |   1.54 MB |  74% |
| 星尘选角首屏     |  14.43 MB |   2.02 MB |  86% |
| 星尘进入战斗累计 |  18.54 MB |   3.17 MB |  83% |
| 完整构建目录     | 229.48 MB | 169.29 MB |  26% |

加载时间会受机器、缓存和网络影响，因此把资源字节数作为稳定指标，不把本地毫秒值作为线上承诺。

## 生成方式

运行：

```bash
python scripts/prepare-runtime-webp-assets.py
```

脚本使用 Pillow WebP quality 86、method 6，保持原始尺寸，并在
`packages/assets/stardust/runtime-webp/manifest.json` 记录源文件、输出文件、字节数与 SHA-256。
