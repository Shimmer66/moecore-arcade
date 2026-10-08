# 星尘运行时 WebP

这里保存 `packages/assets/src/stardust.ts` 实际引用 PNG 的同尺寸 WebP 副本。
原始 PNG 继续作为可追溯源素材保留；运行时映射只加载本目录文件，以减少下载和解码成本。

执行：

```bash
python scripts/prepare-runtime-webp-assets.py
```

脚本同时生成站点横屏与竖屏背景的 WebP，并写入 [`manifest.json`](manifest.json)，
记录源文件、运行文件、尺寸、字节数和 SHA-256。转换不缩放、不裁切，使用 Pillow
WebP quality 86、method 6，并保留透明通道。
