"""Build small runtime images from the preserved 模型战争 source PNGs."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "packages/assets/rewrite/first-batch"
RUNTIME = ROOT / "packages/assets/rewrite/runtime"
OTHER = ROOT / "packages/assets/generated-world/first-batch"

SPRITES = {
    "platform": OTHER / "platform.png",
    "deepseek-idle": OTHER / "deepseek-idle.png",
    "deepseek-run": OTHER / "deepseek-run.png",
    "deepseek-shoot": SOURCE / "deepseek-shoot.png",
    "gpt-idle": OTHER / "player-idle.png",
    "gpt-run": OTHER / "player-run.png",
    "gpt-shoot": SOURCE / "gpt-shoot.png",
    "claude-idle": SOURCE / "claude-idle.png",
    "claude-run": SOURCE / "claude-run.png",
    "claude-shoot": SOURCE / "claude-shoot.png",
    "receipt-walker": SOURCE / "receipt-walker.png",
    "turret": SOURCE / "turret.png",
    "boss-shielded": SOURCE / "boss-shielded.png",
    "boss-open": SOURCE / "boss-open.png",
}


def main() -> None:
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for name, source in SPRITES.items():
        image = Image.open(source).convert("RGBA")
        alpha = image.getchannel("A")
        bounds = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
        if bounds is None:
            raise ValueError(f"Empty sprite: {source}")
        left, top, right, bottom = bounds
        padding = max(8, round((bottom - top) * 0.025))
        cropped = image.crop(
            (
                max(0, left - padding),
                max(0, top - padding),
                min(image.width, right + padding),
                min(image.height, bottom + padding),
            )
        )
        scale = min(1, 512 / max(cropped.size))
        size = (round(cropped.width * scale), round(cropped.height * scale))
        cropped = cropped.resize(size, Image.Resampling.LANCZOS)
        target = RUNTIME / f"{name}.webp"
        cropped.save(target, "WEBP", quality=88, method=6)
        print(f"{name}: {cropped.width}x{cropped.height} -> {target}")

    for level in range(1, 6):
        name = f"level-{level}-background"
        background = Image.open(SOURCE / f"{name}.png").convert("RGB")
        width = min(1600, background.width)
        height = round(background.height * width / background.width)
        background.resize((width, height), Image.Resampling.LANCZOS).save(
            RUNTIME / f"{name}.webp", "WEBP", quality=85, method=6
        )


if __name__ == "__main__":
    main()
