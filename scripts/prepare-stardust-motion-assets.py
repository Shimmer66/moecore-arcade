from pathlib import Path
from collections import deque

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MOTION = ROOT / "packages" / "assets" / "stardust" / "motion"
SOURCES = (
    "jotaro-chibi-action-sheet-v1.png",
    "kakyoin-chibi-action-sheet-v1.png",
    "avdol-chibi-action-sheet-v1.png",
    "polnareff-chibi-action-sheet-v1.png",
    "hol-horse-chibi-action-sheet-v1.png",
    "vanilla-ice-chibi-action-sheet-v2.png",
    "dio-chibi-action-sheet-v1.png",
    "gray-fly-chibi-action-sheet-v1.png",
    "devo-chibi-action-sheet-v1.png",
    "rubber-soul-chibi-action-sheet-v1.png",
    "j-geil-chibi-action-sheet-v1.png",
    "nena-chibi-action-sheet-v1.png",
    "alessi-chibi-action-sheet-v1.png",
    "mariah-chibi-action-sheet-v1.png",
    "ndoul-chibi-action-sheet-v1.png",
    "darby-elder-chibi-action-sheet-v1.png",
    "darby-younger-chibi-action-sheet-v1.png",
    "pet-shop-chibi-action-sheet-v1.png",
)

COLS = 4
ROWS = 3
CELL = 256
EDGE_CROP = 5
CONTENT = 238


def remove_neighbor_fragments(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    width, height = frame.size
    pixels = alpha.load()
    seen = bytearray(width * height)
    components: list[tuple[list[tuple[int, int]], tuple[int, int, int, int]]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if seen[index] or pixels[x, y] <= 8:
                continue
            queue = deque([(x, y)])
            seen[index] = 1
            points: list[tuple[int, int]] = []
            min_x = max_x = x
            min_y = max_y = y
            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                min_x = min(min_x, px)
                max_x = max(max_x, px)
                min_y = min(min_y, py)
                max_y = max(max_y, py)
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    neighbor = ny * width + nx
                    if seen[neighbor] or pixels[nx, ny] <= 8:
                        continue
                    seen[neighbor] = 1
                    queue.append((nx, ny))
            components.append((points, (min_x, min_y, max_x, max_y)))

    if not components:
        return frame

    largest = max(len(points) for points, _ in components)
    kept = Image.new("L", frame.size, 0)
    kept_pixels = kept.load()
    for points, bounds in components:
        min_x, min_y, max_x, max_y = bounds
        touches_edge = min_x <= 2 or min_y <= 2 or max_x >= width - 3 or max_y >= height - 3
        if len(points) == largest or (len(points) >= largest * 0.015 and not touches_edge):
            for x, y in points:
                kept_pixels[x, y] = pixels[x, y]

    cleaned = frame.copy()
    cleaned.putalpha(kept)
    return cleaned


def clean_sheet(source_path: Path) -> Path:
    source = Image.open(source_path).convert("RGBA")
    output = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))

    for row in range(ROWS):
        for col in range(COLS):
            left = round(col * source.width / COLS)
            top = round(row * source.height / ROWS)
            right = round((col + 1) * source.width / COLS)
            bottom = round((row + 1) * source.height / ROWS)
            frame = source.crop(
                (
                    left + EDGE_CROP,
                    top + EDGE_CROP,
                    right - EDGE_CROP,
                    bottom - EDGE_CROP,
                )
            )
            frame = remove_neighbor_fragments(frame)
            frame.thumbnail((CONTENT, CONTENT), Image.Resampling.LANCZOS)
            x = col * CELL + (CELL - frame.width) // 2
            y = row * CELL + (CELL - frame.height) // 2
            output.alpha_composite(frame, (x, y))

    target = source_path.with_name(source_path.stem + "-clean-v1.png")
    output.save(target, optimize=True)
    return target


def main() -> None:
    missing = [name for name in SOURCES if not (MOTION / name).is_file()]
    if missing:
        raise SystemExit("Missing Stardust motion sheets: " + ", ".join(missing))
    for name in SOURCES:
        target = clean_sheet(MOTION / name)
        print(target.relative_to(ROOT))


if __name__ == "__main__":
    main()
