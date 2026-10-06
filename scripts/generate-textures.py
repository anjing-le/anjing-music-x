#!/usr/bin/env python3
"""Generate small, seamless paper/graphite/wax materials. Requires Pillow.

All seeds and pigment colors are fixed. Assets are generated before shipping;
the app neither generates noise nor creates texture caches at runtime.
Run: python3 scripts/generate-textures.py
"""

from pathlib import Path
import math
import random

from PIL import Image, ImageDraw


SIZE = 192
SEED = 20261006
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "textures"
COLORS = {
    "yellow": "efd36e",
    "coral": "df8c7c",
    "sage": "a3b9a1",
    "sky": "9cbdcc",
    "lilac": "b8add0",
}


def save_tile(image: Image.Image, name: str, colors: int = 64) -> None:
    """A small palette keeps reproducible fine texture inexpensive to ship."""
    method = Image.Quantize.FASTOCTREE if image.mode == "RGBA" else Image.Quantize.MEDIANCUT
    image.quantize(colors=colors, method=method, dither=Image.Dither.NONE).save(
        OUTPUT / f"{name}.png", optimize=True
    )


def wrapped_line(draw, points, fill, width=1):
    """Repeat strokes over all boundaries so each material tiles seamlessly."""
    for dx in (-SIZE, 0, SIZE):
        for dy in (-SIZE, 0, SIZE):
            draw.line([(x + dx, y + dy) for x, y in points], fill=fill, width=width)


def paper() -> Image.Image:
    rng = random.Random(SEED)
    image = Image.new("RGB", (SIZE, SIZE))
    image.putdata([
        (252 - n, 251 - n, 247 - n)
        for n in (rng.choices((0, 1, 2, 3), (7, 8, 3, 1))[0] for _ in range(SIZE * SIZE))
    ])
    draw = ImageDraw.Draw(image)
    for _ in range(660):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        length = rng.uniform(2, 10)
        angle = rng.uniform(0, math.tau)
        shade = rng.choice(((246, 245, 241), (248, 247, 243), (255, 254, 250)))
        points = [(x, y), (x + math.cos(angle) * length, y + math.sin(angle) * length)]
        wrapped_line(draw, points, shade)
    return image


def pencil() -> Image.Image:
    rng = random.Random(SEED + 1)
    image = Image.new("RGBA", (SIZE, SIZE), (82, 80, 76, 215))
    draw = ImageDraw.Draw(image)
    # Graphite is dense enough to keep thin outlines clear. Layered directional
    # hatching, soft grains and occasional small voids suggest real pressure.
    for _ in range(2900):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        length = rng.choice((1, 1, 2, 3, 5, 8))
        alpha = rng.choice((140, 170, 190, 220, 240, 250))
        gray = rng.choice((66, 72, 78, 84))
        wrapped_line(draw, [(x, y), (x + length, y - length * .32)], (gray, gray - 2, gray - 5, alpha))
    for _ in range(600):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        alpha = rng.choice((35, 70, 100, 145))
        wrapped_line(draw, [(x, y), (x + rng.choice((0, 1, 2)), y)], (82, 80, 76, alpha))
    return image


def wax(hex_color: str) -> Image.Image:
    rng = random.Random(SEED + 2)
    rgb = tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    image = Image.new("RGBA", (SIZE, SIZE), (*rgb, 0))
    draw = ImageDraw.Draw(image)
    # Adjacent broad strokes do not have perfect joins. Short finer strokes
    # add crossed pigment, pressure changes and little exposed-paper channels.
    for y in range(-12, SIZE + 12, 8):
        x = rng.randint(-14, -2)
        while x < SIZE:
            length = rng.randint(22, 52)
            drift = rng.uniform(-4, 1)
            pigment = tuple(max(0, min(255, c + rng.choice((-8, -4, 0, 3)))) for c in rgb)
            alpha = rng.choice((140, 160, 180, 200, 215, 230))
            wrapped_line(draw, [(x, y), (x + length, y + drift)], (*pigment, alpha), rng.choice((7, 8, 9)))
            x += length - rng.randint(3, 8)
    for _ in range(940):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        length = rng.randint(3, 17)
        alpha = rng.choice((70, 110, 160, 195, 235))
        delta = rng.choice((-12, -6, 0, 4))
        pigment = tuple(max(0, min(255, c + delta)) for c in rgb)
        wrapped_line(draw, [(x, y), (x + length, y - length * .21)], (*pigment, alpha), 1)
    for _ in range(1350):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        # Broken deposits and wax granules remain visible at actual UI size.
        alpha = rng.choice((0, 30, 55, 95, 120))
        draw.point((x, y), fill=(*rgb, alpha))
    return image


def tiled(source: Image.Image, size: int) -> Image.Image:
    result = Image.new("RGBA", (size, size))
    for y in range(0, size, source.height):
        for x in range(0, size, source.width):
            result.paste(source, (x, y))
    return result


def bezier(points, steps=48):
    p0, p1, p2, p3 = points
    return [
        tuple((1 - t) ** 3 * p0[i] + 3 * (1 - t) ** 2 * t * p1[i]
              + 3 * (1 - t) * t ** 2 * p2[i] + t ** 3 * p3[i] for i in (0, 1))
        for t in (j / steps for j in range(steps + 1))
    ]


def app_icon() -> Image.Image:
    """Original code-drawn note and wax mark; no font or external artwork."""
    from PIL import ImageChops

    size = 1024
    image = tiled(paper().convert("RGBA"), size)
    accent_mask = Image.new("L", (size, size))
    draw = ImageDraw.Draw(accent_mask)
    rng = random.Random(SEED + 3)
    for y in range(524, 641, 9):
        start = 279 + rng.randint(-17, 12)
        end = 733 + rng.randint(-17, 12)
        draw.line([(start, y + rng.randint(-3, 3)), (end, y - 42)], fill=220, width=13)
    accent = tiled(wax(COLORS["yellow"]), size)
    accent.putalpha(ImageChops.multiply(accent.getchannel("A"), accent_mask))
    image.alpha_composite(accent)

    symbol_mask = Image.new("L", (size, size))
    draw = ImageDraw.Draw(symbol_mask)
    draw.polygon([(565, 315), (610, 309), (610, 666), (565, 693)], fill=255)
    head = Image.new("L", (248, 166))
    ImageDraw.Draw(head).ellipse((11, 25, 232, 139), fill=255)
    head = head.rotate(22, resample=Image.Resampling.BICUBIC, expand=True)
    symbol_mask.paste(head, (362, 612), head)
    flag = (
        bezier([(581, 309), (643, 326), (750, 375), (740, 447)])
        + bezier([(740, 447), (735, 489), (698, 531), (650, 551)])
        + bezier([(650, 551), (701, 490), (714, 441), (648, 419)])
        + bezier([(648, 419), (617, 409), (586, 412), (581, 379)])
    )
    draw.polygon(flag, fill=255)
    # Center the note's actual visual bounds rather than its stem.
    centered_mask = Image.new("L", (size, size))
    centered_mask.paste(symbol_mask, (-61, -46))
    symbol_mask = centered_mask
    graphite = tiled(pencil(), size)
    graphite.putalpha(ImageChops.multiply(graphite.getchannel("A"), symbol_mask))
    image.alpha_composite(graphite)
    return image.convert("RGB")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    save_tile(paper(), "paper", 32)
    save_tile(pencil(), "pencil", 64)
    for name, color in COLORS.items():
        save_tile(wax(color), f"wax-{name}", 96)
    total = 0
    for file in sorted(OUTPUT.glob("*.png")):
        size = file.stat().st_size
        total += size
        print(f"{file.name}: {SIZE} x {SIZE}, {size:,} bytes")
    print(f"Total: {total:,} bytes")
    if total >= 160 * 1024:
        raise SystemExit("Texture budget exceeded (160 KiB)")
    icon_path = OUTPUT.parent / "app-icon.png"
    app_icon().quantize(colors=96, dither=Image.Dither.NONE).save(icon_path, optimize=True)
    icon_bytes = icon_path.stat().st_size
    print(f"app-icon.png: 1024 x 1024, {icon_bytes:,} bytes")
    if icon_bytes >= 250 * 1024:
        raise SystemExit("App icon budget exceeded (250 KiB)")


if __name__ == "__main__":
    main()
