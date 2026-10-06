from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MOTION = ROOT / "packages" / "assets" / "stardust" / "motion"
SOURCE = MOTION / "extended-source"
TARGET = MOTION / "extended"
STAND_SOURCE = ROOT / "packages" / "assets" / "stardust" / "separated" / "motion-source"
STAND_TARGET = ROOT / "packages" / "assets" / "stardust" / "separated" / "motion"
SEPARATED = ROOT / "packages" / "assets" / "stardust" / "separated" / "stand-separation-v1.png"
CELL = 256

HEROES = ("jotaro", "kakyoin", "avdol", "polnareff")
VILLAINS = {
    "gray-fly": "gray-fly-chibi-action-sheet-v1-clean-v1.png",
    "devo": "devo-chibi-action-sheet-v1-clean-v1.png",
    "rubber-soul": "rubber-soul-chibi-action-sheet-v1-clean-v1.png",
    "holhorse": "hol-horse-chibi-action-sheet-v1-clean-v1.png",
    "j-geil": "j-geil-chibi-action-sheet-v1-clean-v1.png",
    "nena": "nena-chibi-action-sheet-v1-clean-v1.png",
    "alessi": "alessi-chibi-action-sheet-v1-clean-v1.png",
    "mariah": "mariah-chibi-action-sheet-v1-clean-v1.png",
    "ndoul": "ndoul-chibi-action-sheet-v1-clean-v1.png",
    "darby-elder": "darby-elder-chibi-action-sheet-v1-clean-v1.png",
    "darby-younger": "darby-younger-chibi-action-sheet-v1-clean-v1.png",
    "pet-shop": "pet-shop-chibi-action-sheet-v1-clean-v1.png",
    "ice": "vanilla-ice-chibi-action-sheet-v2-clean-v1.png",
    "dio": "dio-chibi-action-sheet-v1-clean-v1.png",
}


def alpha_crop(frame: Image.Image) -> Image.Image:
    bounds = frame.getchannel("A").getbbox()
    return frame.crop(bounds) if bounds else frame


def place(output: Image.Image, frame: Image.Image, index: int, size: tuple[int, int] = (238, 238)) -> None:
    frame = alpha_crop(frame)
    frame.thumbnail(size, Image.Resampling.LANCZOS)
    x = (index % 4) * CELL + (CELL - frame.width) // 2
    y = (index // 4) * CELL + (CELL - frame.height) // 2
    output.alpha_composite(frame, (x, y))


def normalize_generated_hero(hero: str) -> None:
    source = Image.open(SOURCE / f"{hero}-extended-source.png").convert("RGBA")
    output = Image.new("RGBA", (CELL * 4, CELL * 2), (0, 0, 0, 0))
    for index in range(8):
        col = index % 4
        row = index // 4
        frame = source.crop(
            (
                round(col * source.width / 4),
                round(row * source.height / 2),
                round((col + 1) * source.width / 4),
                round((row + 1) * source.height / 2),
            )
        )
        place(output, frame, index)
    output.save(TARGET / f"{hero}-extended-motion-v1.png", optimize=True)


def normalize_stand(hero: str) -> None:
    source = Image.open(STAND_SOURCE / f"{hero}-stand-motion-source.png").convert("RGBA")
    output = Image.new("RGBA", (CELL * 4, CELL * 2), (0, 0, 0, 0))
    for index in range(8):
        col = index % 4
        row = index // 4
        frame = source.crop(
            (
                round(col * source.width / 4),
                round(row * source.height / 2),
                round((col + 1) * source.width / 4),
                round((row + 1) * source.height / 2),
            )
        )
        place(output, frame, index)
    output.save(STAND_TARGET / f"{hero}-stand-motion-v1.png", optimize=True)


def build_kakyoin_body_sheets() -> None:
    source = Image.open(SOURCE / "kakyoin-body-only-source.png").convert("RGBA")
    poses = []
    for index in range(12):
        col = index % 4
        row = index // 4
        poses.append(
            source.crop(
                (
                    round(col * source.width / 4),
                    round(row * source.height / 3),
                    round((col + 1) * source.width / 4),
                    round((row + 1) * source.height / 3),
                )
            )
        )
    regular = Image.new("RGBA", (CELL * 4, CELL * 3), (0, 0, 0, 0))
    for index, pose in enumerate(poses):
        place(regular, pose, index)
    regular.save(MOTION / "kakyoin-body-only-motion-v2.png", optimize=True)

    extended = Image.new("RGBA", (CELL * 4, CELL * 2), (0, 0, 0, 0))
    extended_poses = (poses[8], poses[10], poses[10], poses[10], poses[10], poses[8], poses[7], poses[6])
    for index, pose in enumerate(extended_poses):
        place(extended, pose, index)
    extended.save(TARGET / "kakyoin-body-only-extended-v2.png", optimize=True)


def frame_from_sheet(sheet: Image.Image, index: int) -> Image.Image:
    col = index % 4
    row = index // 4
    return sheet.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))


def transformed(frame: Image.Image, scale: float = 1, angle: float = 0, y_scale: float = 1) -> Image.Image:
    frame = alpha_crop(frame)
    width = max(1, round(frame.width * scale))
    height = max(1, round(frame.height * scale * y_scale))
    frame = frame.resize((width, height), Image.Resampling.LANCZOS)
    if angle:
        frame = frame.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    return frame


def build_villain(name: str, source_name: str) -> None:
    sheet = Image.open(MOTION / source_name).convert("RGBA")
    jump = frame_from_sheet(sheet, 3)
    crouch = frame_from_sheet(sheet, 8)
    guard = frame_from_sheet(sheet, 7)
    attack = frame_from_sheet(sheet, 4)
    frames = (
        transformed(crouch, 1.02, 0, 0.9),
        transformed(jump, 0.96, -5),
        transformed(jump, 0.92, -2),
        transformed(jump, 0.9),
        transformed(jump, 0.93, 4),
        transformed(crouch, 1.04, 0, 0.82),
        transformed(guard, 1.0, 0, 0.92),
        transformed(attack, 1.0, 0, 0.9),
    )
    output = Image.new("RGBA", (CELL * 4, CELL * 2), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        place(output, frame, index)
    output.save(TARGET / f"{name}-extended-motion-v1.png", optimize=True)


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    STAND_TARGET.mkdir(parents=True, exist_ok=True)
    for hero in HEROES:
        normalize_generated_hero(hero)
        normalize_stand(hero)
    build_kakyoin_body_sheets()
    for name, source_name in VILLAINS.items():
        build_villain(name, source_name)
    print(f"Prepared {len(HEROES) + len(VILLAINS)} extended motion sheets in {TARGET}")


if __name__ == "__main__":
    main()
