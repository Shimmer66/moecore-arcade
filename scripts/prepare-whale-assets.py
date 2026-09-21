"""Create small, reproducible runtime derivatives without changing supplied originals."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "packages/assets/whale-runner"
source = json.loads((ROOT / "asset-manifest.json").read_text(encoding="utf-8"))
output = ROOT / "runtime"
output.mkdir(exist_ok=True)
entries = []
for asset in source["assets"]:
    original = ROOT / asset["file"]
    assert hashlib.sha256(original.read_bytes()).hexdigest() == asset["sha256"], asset["id"]
    image = Image.open(original).convert("RGBA")
    if asset["mode"] == "RGBA":
        bounds = image.getchannel("A").point(lambda value: 255 if value > 12 else 0).getbbox()
        if bounds:
            image = image.crop(bounds)
    if asset["category"] == "character":
        low_pose = any(word in asset["id"] for word in ("slide", "fail", "land"))
        image.thumbnail((296, 165 if low_pose else 268), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (320, 320))
        canvas.alpha_composite(image, ((320 - image.width) // 2, 304 - image.height))
        image = canvas
    else:
        limits = (1280, 720) if asset["category"] in ("background", "keyart") else (512, 512)
        image.thumbnail(limits, Image.Resampling.LANCZOS)
    path = output / f"{asset['id']}.webp"
    image.save(path, "WEBP", lossless=True, method=6)
    entries.append({
        "id": asset["id"],
        "file": f"runtime/{path.name}",
        "width": image.width,
        "height": image.height,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "sourceSha256": asset["sha256"],
    })
(output / "manifest.json").write_text(
    json.dumps({"count": len(entries), "assets": entries}, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps({"images": len(entries), "sourceBytes": sum((ROOT / a["file"]).stat().st_size for a in source["assets"]),
                  "runtimeBytes": sum((ROOT / a["file"]).stat().st_size for a in entries)}))
