"""Create display-sized WebP copies of the large duel animation atlases.

The source PNGs stay in the art pack. Runtime copies keep their pixel dimensions
and alpha channel, so the sprite crop geometry does not change.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "packages" / "assets" / "duel"
SOURCES = {
    "motion/deepseek.png": "motion-deepseek.webp",
    "motion/gpt.png": "motion-gpt.webp",
    "motion/doubao.png": "motion-doubao.webp",
    "crouch/atlas.png": "crouch-atlas.webp",
    "crouch/sweep-atlas.png": "sweep-atlas.webp",
}


def main() -> None:
    target = ROOT / "runtime"
    target.mkdir(exist_ok=True)
    for source_name, output_name in SOURCES.items():
        source = ROOT / "combat" / source_name
        output = target / output_name
        with Image.open(source) as image:
            image.save(output, "WEBP", quality=85, alpha_quality=90, method=6)
            with Image.open(output) as result:
                if result.size != image.size or result.mode != "RGBA":
                    raise ValueError(f"Sprite geometry or alpha changed: {output}")
        print(f"{source_name}: {source.stat().st_size} -> {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
