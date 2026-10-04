from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTERS = ROOT / "packages/assets/rewrite/masters"
RUNTIME = ROOT / "packages/assets/rewrite/runtime"


def normalize_atlas(
    name: str,
    columns: int,
    rows: int,
    cell_size: int,
    fill_ratio: float,
    lossless: bool = True,
    quality: int = 92,
) -> None:
    source = Image.open(MASTERS / f"{name}.png").convert("RGBA")
    output = Image.new("RGBA", (columns * cell_size, rows * cell_size))

    for row in range(rows):
        for column in range(columns):
            left = round(column * source.width / columns)
            right = round((column + 1) * source.width / columns)
            top = round(row * source.height / rows)
            bottom = round((row + 1) * source.height / rows)
            cell = source.crop((left, top, right, bottom))

            alpha = cell.getchannel("A").point(lambda value: 0 if value < 20 else value)
            cell.putalpha(alpha)
            bounds = alpha.getbbox()
            if bounds is None:
                continue

            sprite = cell.crop(bounds)
            maximum = round(cell_size * fill_ratio)
            scale = min(maximum / sprite.width, maximum / sprite.height)
            size = (
                max(1, round(sprite.width * scale)),
                max(1, round(sprite.height * scale)),
            )
            sprite = sprite.resize(size, Image.Resampling.LANCZOS)
            x = column * cell_size + (cell_size - sprite.width) // 2
            y = row * cell_size + (cell_size - sprite.height) // 2
            output.alpha_composite(sprite, (x, y))

    output.save(
        RUNTIME / f"{name}.webp",
        "WEBP",
        lossless=lossless,
        quality=quality,
        method=6,
        exact=True,
    )


def normalize_rect_atlas(
    name: str,
    columns: int,
    rows: int,
    cell_width: int,
    cell_height: int,
    fill_ratio: float,
    lossless: bool = True,
    quality: int = 92,
) -> None:
    source = Image.open(MASTERS / f"{name}.png").convert("RGBA")
    output = Image.new("RGBA", (columns * cell_width, rows * cell_height))

    for row in range(rows):
        for column in range(columns):
            left = round(column * source.width / columns)
            right = round((column + 1) * source.width / columns)
            top = round(row * source.height / rows)
            bottom = round((row + 1) * source.height / rows)
            cell = source.crop((left, top, right, bottom))
            alpha = cell.getchannel("A").point(lambda value: 0 if value < 20 else value)
            cell.putalpha(alpha)
            bounds = alpha.getbbox()
            if bounds is None:
                continue
            sprite = cell.crop(bounds)
            scale = min(
                cell_width * fill_ratio / sprite.width,
                cell_height * fill_ratio / sprite.height,
            )
            size = (
                max(1, round(sprite.width * scale)),
                max(1, round(sprite.height * scale)),
            )
            sprite = sprite.resize(size, Image.Resampling.LANCZOS)
            x = column * cell_width + (cell_width - sprite.width) // 2
            y = row * cell_height + (cell_height - sprite.height) // 2
            output.alpha_composite(sprite, (x, y))

    output.save(
        RUNTIME / f"{name}.webp",
        "WEBP",
        lossless=lossless,
        quality=quality,
        method=6,
        exact=True,
    )


normalize_atlas("enemy-motion-ground-v1", 4, 3, 384, 0.78, False)
normalize_atlas("enemy-motion-air-v1", 4, 3, 384, 0.78, False)
normalize_atlas("combat-vfx-atlas-v1", 4, 4, 256, 0.86)
normalize_atlas("boss-reaction-atlas-v1", 4, 4, 384, 0.82, False)
normalize_atlas("boss-phase-atlas-v1", 4, 2, 384, 0.82, False)
for pair in ("12", "34", "56", "78"):
    normalize_atlas(f"stage-props-{pair}-v1", 4, 2, 256, 0.82, False, 90)
normalize_atlas("ai-meme-props-atlas-v1", 4, 2, 256, 0.82, False, 90)
normalize_atlas("operator-reaction-atlas-v1", 4, 3, 256, 0.86, False)
normalize_rect_atlas("mission-card-atlas-v1", 4, 2, 384, 216, 0.96, False, 90)

alignment = Image.open(MASTERS / "alignment-wall-background-v1.png").convert("RGB")
alignment = alignment.resize((1881, 836), Image.Resampling.LANCZOS)
alignment.save(
    RUNTIME / "alignment-wall-background-v1.webp",
    "WEBP",
    quality=88,
    method=6,
)
