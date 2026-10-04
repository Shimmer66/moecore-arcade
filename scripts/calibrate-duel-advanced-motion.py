"""Read alpha only; write sprite geometry/manifest. Generated PNG pixels are never changed."""
from collections import deque
from hashlib import sha256
from pathlib import Path
from statistics import median
import json
import argparse
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument(
    "--family",
    choices=["advanced-motion", "normal-motion", "grapple-motion", "signature-motion"],
    default="advanced-motion",
)
args = parser.parse_args()
NORMAL = args.family == "normal-motion"
GRAPPLE = args.family == "grapple-motion"
SIGNATURE = args.family == "signature-motion"
ROWS = 2 if GRAPPLE or SIGNATURE else 4
ROOT = Path(__file__).resolve().parents[1] / "packages/assets/duel" / args.family
FILES = {name: f"{name}-v1.png" for name in
         ["deepseek", "gpt", "doubao", "client", "prompt_sage", "unplug_uncle"]}
if GRAPPLE:
    FILES = {"gpt": "gpt-v1.png"}
elif SIGNATURE:
    FILES = {
        "deepseek": "deepseek-v1.png",
        "doubao": "doubao-v1.png",
        "client": "client-v2.png",
        "prompt_sage": "prompt_sage-v1.png",
        "unplug_uncle": "unplug_uncle-v1.png",
    }
elif not NORMAL:
    FILES["prompt_sage"] = "prompt_sage-v2.png"


def components(alpha, width, height):
    seen = bytearray(width * height)
    found = []
    for start, value in enumerate(alpha):
        if value < 24 or seen[start]:
            continue
        seen[start] = 1
        queue = deque([start])
        count = sx = sy = 0
        lo_x = hi_x = start % width
        lo_y = hi_y = start // width
        while queue:
            pos = queue.popleft()
            x, y = pos % width, pos // width
            count += 1
            sx += x
            sy += y
            lo_x, hi_x = min(lo_x, x), max(hi_x, x)
            lo_y, hi_y = min(lo_y, y), max(hi_y, y)
            for ny in range(max(0, y - 1), min(height, y + 2)):
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    other = ny * width + nx
                    if not seen[other] and alpha[other] >= 24:
                        seen[other] = 1
                        queue.append(other)
        if count >= 16:
            found.append((count, sx / count, sy / count, lo_x, lo_y, hi_x + 1, hi_y + 1))
    return found


geometry, report = {}, {}
for name, filename in FILES.items():
    path = ROOT / filename
    image = Image.open(path)
    if image.mode != "RGBA":
        raise ValueError(f"{filename}: expected generated alpha")
    width, height = image.size
    alpha = image.getchannel("A").tobytes()
    groups = [[] for _ in range(ROWS * 4)]
    for component in components(alpha, width, height):
        _, cx, cy, *_ = component
        col = min(3, int(cx * 4 / width))
        row = min(ROWS - 1, int(cy * ROWS / height))
        groups[row * 4 + col].append(component)
    boxes = []
    for index, group in enumerate(groups):
        if sum(c[0] for c in group) < 4000:
            raise ValueError(f"{filename} frame {index}: incomplete sprite")
        boxes.append([min(c[3] for c in group), min(c[4] for c in group),
                      max(c[5] for c in group), max(c[6] for c in group)])
    # One scale per character. Crouches and rolls retain their natural lower height.
    standing_height = median(
        boxes[i][3] - boxes[i][1]
        for i in (
            [0, 7]
            if GRAPPLE or SIGNATURE
            else [0, 3]
            if NORMAL
            else [4, 7, 8, 11]
        )
    )
    scale = 142 / standing_height
    crops = [[max(0, left - 2), max(0, top - 2), min(width, right + 2), min(height, bottom + 2)]
             for left, top, right, bottom in boxes]
    # Two sheets have almost touching adjacent rows. Avoid sampling a neighbour's
    # alpha: at most one subpixel at game scale is trimmed from either outer edge.
    for index in range((ROWS - 1) * 4):
        below = index + 4
        if crops[index][3] > crops[below][1]:
            overlap = boxes[index][3] - boxes[below][1]
            if overlap > 2:
                raise ValueError(f"{filename}: sprites {index}/{below} need art repair")
            if overlap > 0:
                crops[index][3] = boxes[below][1]
                crops[below][1] = boxes[index][3]
            else:
                cut = (boxes[index][3] + boxes[below][1]) // 2
                crops[index][3] = min(crops[index][3], cut)
                crops[below][1] = max(crops[below][1], cut)
    frames = []
    for index, box in enumerate(boxes):
        left, top, right, bottom = box
        pivot_x = (left + right) / 2
        if GRAPPLE or SIGNATURE or (index < 8 if NORMAL else 4 <= index < 12):
            feet = [x for y in range(max(top, bottom - 18), bottom)
                    for x in range(left, right) if alpha[y * width + x] >= 96]
            if feet:
                pivot_x = (min(feet) + max(feet)) / 2
        pivot_y = bottom
        crop = crops[index]
        x, y, end_x, end_y = crop
        frames.append({
            "x": round((x - pivot_x) * scale, 3), "y": round((y - pivot_y) * scale, 3),
            "width": round((end_x - x) * scale, 3), "height": round((end_y - y) * scale, 3),
            "viewBox": f"{x} {y} {end_x - x} {end_y - y}",
            "sourceWidth": width, "sourceHeight": height,
            "alphaBounds": box, "pivot": [pivot_x, pivot_y], "scale": round(scale, 6),
            "edgeTrimPx": [max(0, crop[1] - top), max(0, bottom - crop[3])],
        })
    geometry[name] = frames
    report[name] = {
        "file": filename, "sha256": sha256(path.read_bytes()).hexdigest(),
        "width": width, "height": height, "frames": ROWS * 4, "scale": round(scale, 6),
        "transparentFraction": round(alpha.count(0) / len(alpha), 4),
        "bytes": path.stat().st_size,
    }
    print(name, "scale", round(scale, 3), "row bounds",
          [(min(boxes[i][1] for i in range(row * 4, row * 4 + 4)),
            max(boxes[i][3] for i in range(row * 4, row * 4 + 4))) for row in range(ROWS)])

(ROOT / "geometry.json").write_text(json.dumps(geometry, indent=2) + "\n", encoding="utf-8")
(ROOT / "manifest.json").write_text(json.dumps({
    "status": "calibrated", "frameCount": len(FILES) * ROWS * 4,
    "rows": (
        ["catch-startup", "throw-followthrough"]
        if GRAPPLE
        else ["signature-startup", "signature-followthrough"]
        if SIGNATURE
        else ["lightKick", "crouchKick", "air", "airHeavy"]
        if NORMAL
        else ["roll", "blowback", "guardCounter", "airBlowback"]
    ),
    "method": "Alpha component bounds and contact pivots; one uniform body scale per character; original PNG preserved.",
    "characters": report,
}, indent=2) + "\n", encoding="utf-8")
