#!/usr/bin/env python3
"""Generate six original, quiet demonstration pieces and object-only covers.

The melodies below are written for this prototype, not taken from recordings
or commercial compositions. Python's wave module writes real 22-second PCM
WAV files. Covers use our fixed paper/pencil/wax materials. Requires Pillow.
"""

from array import array
import math
from pathlib import Path
import random
import sys
import wave

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
COVERS = ROOT / "public" / "covers"
TEXTURES = ROOT / "public" / "textures"
RATE = 11025
DURATION = 22
SEED = 20261006
PIECES = [
    ("paper-morning", [72, 76, 79, 76, 74, 72, 67, 72], [48, 53, 55, 48], "piano"),
    ("afternoon-window", [69, 72, 76, 74, 72, 69, 67, 69], [45, 50, 53, 45], "guitar"),
    ("passing-breeze", [67, 71, 74, 79, 76, 74, 71, 67], [43, 48, 50, 43], "guitar"),
    ("slow-home", [64, 67, 72, 71, 69, 67, 64, 60], [48, 45, 53, 48], "piano"),
    ("rain-on-paper", [74, 77, 81, 77, 76, 74, 72, 69], [50, 46, 53, 50], "piano"),
    ("little-lamp", [65, 69, 72, 77, 74, 72, 69, 65], [41, 46, 48, 41], "guitar"),
]


def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)


def add_note(samples, note, start, duration, amplitude, instrument):
    f = frequency(note)
    first = round(start * RATE)
    length = min(round(duration * RATE), len(samples) - first)
    for i in range(max(0, length)):
        t = i / RATE
        attack = min(1.0, t / 0.014)
        release = min(1.0, max(0, duration - t) / 0.065)
        if instrument == "guitar":
            value = sum(weight * math.sin(math.tau * f * harmonic * t)
                        * math.exp(-(2.6 + harmonic * .8) * t)
                        for harmonic, weight in ((1, 1), (2, .23), (3, .09), (4, .035)))
        else:
            value = sum(weight * math.sin(math.tau * f * harmonic * t)
                        * math.exp(-(1.8 + harmonic * .8) * t)
                        for harmonic, weight in ((1, 1), (2, .27), (3, .07)))
        samples[first + i] += value * amplitude * attack * release


def make_piece(name, melody, bass, instrument):
    samples = array("d", [0]) * (RATE * DURATION)
    for phrase in range(4):
        offset = .28 + phrase * 4.8
        for beat, note in enumerate(melody):
            # A quiet reply changes register on alternating phrases.
            octave = -12 if phrase == 2 else 0
            add_note(samples, note + octave, offset + beat * .58, 1.1, .082, instrument)
        for beat in range(4):
            add_note(samples, bass[phrase] + (7 if beat % 2 else 0),
                     offset + beat * 1.16, 1.5, .041, "guitar")
    for i, note in enumerate((bass[0] + 12, bass[0] + 19, melody[0])):
        add_note(samples, note, 19.25 + i * .13, 2.5 - i * .13, .058, instrument)
    pcm = array("h")
    for index, sample in enumerate(samples):
        t = index / RATE
        fade = min(1, t / .05, max(0, DURATION - t) / .5)
        pcm.append(round(math.tanh(sample) * fade * 26000))
    if sys.byteorder != "little":
        pcm.byteswap()
    with wave.open(str(AUDIO / f"{name}.wav"), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())


def tile(name):
    source = Image.open(TEXTURES / f"{name}.png").convert("RGBA")
    result = Image.new("RGBA", (256, 256))
    for y in range(0, 256, source.height):
        for x in range(0, 256, source.width):
            result.paste(source, (x, y))
    return result


class Cover:
    def __init__(self, seed):
        self.image = tile("paper")
        self.rng = random.Random(seed)

    def wax(self, color, paint):
        mask = Image.new("L", (256, 256))
        paint(ImageDraw.Draw(mask))
        layer = tile(f"wax-{color}")
        layer.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
        self.image.alpha_composite(layer)

    def pencil(self, points, width=2, closed=False):
        mask = Image.new("L", (256, 256))
        draw = ImageDraw.Draw(mask)
        if closed:
            points = list(points) + [points[0]]
        draw.line(points, fill=255, width=width, joint="curve")
        # A restrained second pass gives pressure changes, not a solid black rim.
        for a, b in zip(points[::2], points[1::2]):
            draw.line([(a[0] + 1, a[1]), (b[0] + 1, b[1])], fill=125, width=1)
        layer = tile("pencil")
        layer.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
        self.image.alpha_composite(layer)

    def save(self, name):
        self.image.convert("RGB").quantize(colors=112, dither=Image.Dither.NONE).save(
            COVERS / f"{name}.png", optimize=True)


def covers():
    c = Cover(SEED + 20)
    c.wax("yellow", lambda d: d.ellipse((142, 48, 197, 104), fill=255))
    c.wax("sage", lambda d: d.polygon([(24, 185), (65, 128), (104, 144), (142, 118), (226, 181), (226, 209), (24, 209)], fill=245))
    c.pencil([(25, 187), (65, 128), (104, 144), (142, 118), (227, 183)])
    c.pencil([(32, 211), (217, 211)])
    c.save("morning")

    c = Cover(SEED + 21)
    c.wax("sky", lambda d: d.rectangle((69, 53, 193, 177), fill=220))
    c.wax("yellow", lambda d: d.ellipse((138, 71, 172, 105), fill=235))
    c.pencil([(66, 50), (195, 50), (194, 179), (66, 179)], closed=True, width=3)
    c.pencil([(130, 51), (130, 180)], width=3)
    c.pencil([(65, 115), (194, 115)], width=3)
    c.pencil([(50, 184), (207, 184)])
    c.wax("sage", lambda d: d.ellipse((59, 153, 92, 185), fill=255))
    c.wax("coral", lambda d: d.polygon([(59, 179), (92, 179), (87, 209), (65, 209)], fill=250))
    c.pencil([(59, 179), (92, 179), (87, 209), (65, 209)], closed=True)
    c.save("window")

    c = Cover(SEED + 22)
    c.wax("sage", lambda d: d.polygon([(49, 183), (76, 117), (87, 161), (111, 91), (132, 139), (171, 92), (169, 160), (206, 144), (190, 197)], fill=240))
    c.pencil([(43, 196), (208, 196)])
    c.pencil([(88, 191), (86, 149), (95, 120)])
    c.pencil([(150, 191), (158, 147), (169, 109)])
    c.pencil([(47, 78), (75, 73), (109, 76), (138, 72), (177, 75)])
    c.pencil([(82, 55), (112, 51), (148, 55), (183, 51)])
    c.wax("sky", lambda d: d.line([(47, 78), (75, 73), (109, 76)], fill=220, width=4))
    c.save("breeze")

    c = Cover(SEED + 23)
    c.wax("lilac", lambda d: d.polygon([(30, 171), (62, 129), (101, 145), (145, 103), (227, 168), (227, 212), (30, 212)], fill=215))
    c.wax("coral", lambda d: d.polygon([(90, 143), (130, 105), (169, 143)], fill=240))
    c.wax("yellow", lambda d: d.rectangle((119, 157, 139, 184), fill=240))
    c.pencil([(85, 146), (130, 105), (175, 146)])
    c.pencil([(97, 139), (97, 192), (163, 192), (163, 139)])
    c.pencil([(119, 157), (139, 157), (139, 193), (119, 193)], closed=True)
    c.pencil([(130, 196), (120, 210), (142, 228)])
    c.save("home")

    c = Cover(SEED + 24)
    c.wax("sky", lambda d: d.polygon([(72, 130), (90, 81), (109, 63), (165, 64), (191, 87), (205, 130)], fill=235))
    arc = [(72, 130), (84, 96), (105, 70), (131, 62), (166, 69), (188, 94), (204, 130)]
    c.pencil(arc, width=3)
    c.pencil([(72, 130), (94, 123), (115, 130), (137, 123), (159, 130), (181, 123), (204, 130)])
    c.pencil([(137, 73), (137, 187), (131, 200), (117, 201), (110, 191)], width=3)
    c.wax("sky", lambda d: [d.line([(x, y), (x - 4, y + 11)], fill=220, width=3)
                           for x, y in ((52, 87), (218, 105), (63, 159), (202, 173), (184, 45))])
    c.save("rain")

    c = Cover(SEED + 25)
    c.wax("yellow", lambda d: d.polygon([(106, 82), (157, 82), (181, 143), (80, 143)], fill=245))
    c.pencil([(106, 82), (157, 82), (181, 143), (80, 143)], closed=True)
    c.pencil([(131, 145), (131, 192)], width=3)
    c.wax("lilac", lambda d: d.ellipse((100, 189, 163, 200), fill=235))
    c.pencil([(97, 201), (168, 201)])
    c.pencil([(66, 210), (194, 210)])
    c.pencil([(131, 60), (131, 47)])
    c.pencil([(80, 75), (69, 65)])
    c.pencil([(183, 75), (194, 65)])
    c.save("lamp")


def main():
    AUDIO.mkdir(parents=True, exist_ok=True)
    COVERS.mkdir(parents=True, exist_ok=True)
    for piece in PIECES:
        make_piece(*piece)
    covers()
    audio_bytes = sum(path.stat().st_size for path in AUDIO.glob("*.wav"))
    cover_bytes = sum(path.stat().st_size for path in COVERS.glob("*.png"))
    assert audio_bytes < 3_000_000, "audio exceeds 3 MB budget"
    assert cover_bytes < 400_000, "covers exceed 400 KB budget"
    for path in sorted(AUDIO.glob("*.wav")):
        with wave.open(str(path)) as source:
            seconds = source.getnframes() / source.getframerate()
            assert seconds == DURATION
            print(f"{path.name}: {seconds:g}s, {path.stat().st_size:,} bytes")
    print(f"Audio total: {audio_bytes:,} bytes; covers total: {cover_bytes:,} bytes")


if __name__ == "__main__":
    main()
