"""Create display-sized WebP derivatives for the shell and Stardust runtime."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STARDUST_ROOT = ROOT / "packages/assets/stardust"
STARDUST_OUTPUT = STARDUST_ROOT / "runtime-webp"
STARDUST_SOURCE = ROOT / "packages/assets/src/stardust.ts"
HOME_SOURCE = ROOT / "packages/assets/src/index.ts"
SHELL_IMAGES = ROOT / "apps/web/src/assets/images"
QUALITY = 86


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def referenced_stardust_sources() -> list[Path]:
    text = STARDUST_SOURCE.read_text(encoding="utf-8") + HOME_SOURCE.read_text(encoding="utf-8")
    direct = re.findall(r"\.\./stardust/([^']+)\.png", text)
    runtime = re.findall(r"\.\./stardust/runtime-webp/([^']+)\.webp", text)
    return sorted({STARDUST_ROOT / f"{relative}.png" for relative in [*direct, *runtime]})


def convert(source: Path, destination: Path) -> dict[str, object]:
    if not source.is_file():
        raise FileNotFoundError(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        image = opened.convert("RGBA" if "A" in opened.getbands() else "RGB")
        width, height = image.size
        image.save(destination, "WEBP", quality=QUALITY, method=6, exact=True)
    return {
        "source": source.relative_to(ROOT).as_posix(),
        "output": destination.relative_to(ROOT).as_posix(),
        "width": width,
        "height": height,
        "sourceBytes": source.stat().st_size,
        "outputBytes": destination.stat().st_size,
        "sourceSha256": sha256(source),
        "outputSha256": sha256(destination),
    }


def main() -> None:
    assets = []
    for source in referenced_stardust_sources():
        relative = source.relative_to(STARDUST_ROOT).with_suffix(".webp")
        assets.append(convert(source, STARDUST_OUTPUT / relative))

    shell = []
    for name in ("bg_menu_landscape", "bg_menu_portrait"):
        shell.append(convert(SHELL_IMAGES / f"{name}.png", SHELL_IMAGES / f"{name}.webp"))

    manifest = {
        "generatedAt": "2026-10-08",
        "tool": "Pillow",
        "quality": QUALITY,
        "method": 6,
        "stardust": assets,
        "shell": shell,
        "summary": {
            "sourceBytes": sum(int(item["sourceBytes"]) for item in [*assets, *shell]),
            "outputBytes": sum(int(item["outputBytes"]) for item in [*assets, *shell]),
        },
    }
    STARDUST_OUTPUT.mkdir(parents=True, exist_ok=True)
    (STARDUST_OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    ratio = manifest["summary"]["outputBytes"] / manifest["summary"]["sourceBytes"]
    print(
        f"Converted {len(assets)} Stardust images and {len(shell)} shell backgrounds "
        f"to {ratio:.1%} of the PNG source size."
    )


if __name__ == "__main__":
    main()
