# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools==4.66.1", "brotli==1.2.0"]
# ///
"""Build the local Anjing Hand UI font from the pinned official LXGW source.

Run: uv run scripts/fetch-font.py
No font request occurs while the application is running.
"""

import argparse
import hashlib
import subprocess
import tempfile
import unicodedata
from pathlib import Path

import brotli
import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent.parent
COMMIT = "a22e2a064f471fffd194af2a69072944bbe218dc"
UPSTREAM = "https://github.com/lxgw/LxgwWenKai"
RAW = f"https://raw.githubusercontent.com/lxgw/LxgwWenKai/{COMMIT}"
FONT_PATH = "fonts/TTF/LXGWWenKai-Regular.ttf"
FONT_SHA256 = "39ad71264b588165b469e35e6afb162a378dacd1f95348160240ba9038ac3009"
LICENSE_SHA256 = "1a25e35da1031c6c3436fde545bb9cb5aca954e9873afe510c834b8b79bd21a0"
MAX_BYTES = 120_000
IDENTITY_NAMES = {
    1: "Anjing Hand",
    2: "Regular",
    3: "Anjing Hand Regular; UI subset",
    4: "Anjing Hand Regular",
    6: "AnjingHand-Regular",
    16: "Anjing Hand",
    17: "Regular",
    18: "Anjing Hand Regular",
    20: "AnjingHand-Regular",
    21: "Anjing Hand",
    22: "Regular",
    25: "AnjingHand",
}


def digest(file: Path) -> str:
    return hashlib.sha256(file.read_bytes()).hexdigest()


def source_file(url: str, destination: Path, expected_hash: str) -> Path:
    if not destination.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(destination.suffix + ".download")
        try:
            subprocess.run(
                [
                    "curl", "--fail", "--silent", "--show-error", "--location",
                    "--retry", "2", "--max-time", "120", url,
                    "--output", str(temporary),
                ],
                check=True,
            )
            if digest(temporary) != expected_hash:
                raise ValueError("Downloaded font source does not match its pinned hash")
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)
    if digest(destination) != expected_hash:
        raise ValueError(f"Pinned source hash mismatch: {destination.name}")
    return destination


def ui_characters() -> str:
    characters = {chr(code) for code in range(0x20, 0x7F)}
    for file in sorted((ROOT / "src").rglob("*")):
        if file.suffix not in {".ts", ".tsx"}:
            continue
        for char in file.read_text(encoding="utf-8"):
            code = ord(char)
            is_han = (
                0x3400 <= code <= 0x4DBF
                or 0x4E00 <= code <= 0x9FFF
                or 0x20000 <= code <= 0x2FA1F
            )
            if is_han or (code > 0x7F and unicodedata.category(char).startswith("P")):
                characters.add(char)
    return "".join(sorted(characters, key=ord))


def rename(font: TTFont) -> None:
    # Keep original copyrights, license, designer and manufacturer records.
    # Rename every primary/typographic/PostScript identity, including legacy ones.
    for record in list(font["name"].names):
        if record.nameID in IDENTITY_NAMES:
            font["name"].setName(
                IDENTITY_NAMES[record.nameID], record.nameID,
                record.platformID, record.platEncID, record.langID,
            )
    for name_id in (1, 2, 3, 4, 6, 16, 17):
        font["name"].setName(IDENTITY_NAMES[name_id], name_id, 3, 1, 0x409)


def build(source: Path, license_file: Path) -> None:
    if digest(source) != FONT_SHA256 or digest(license_file) != LICENSE_SHA256:
        raise ValueError("Font and license must match the pinned official upstream")
    characters = ui_characters()
    with TTFont(source, recalcTimestamp=False) as font:
        original_copyrights = {
            record.toUnicode() for record in font["name"].names if record.nameID == 0
        }
        missing = set(map(ord, characters)) - set(font.getBestCmap())
        if missing:
            raise ValueError("Upstream font is missing UI characters: " + ", ".join(
                f"U+{code:04X}" for code in sorted(missing)
            ))
        options = subset.Options()
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.name_legacy = True
        options.layout_features = ["*"]
        options.hinting = True
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=characters)
        subsetter.subset(font)
        rename(font)
        font.flavor = "woff2"
        with tempfile.TemporaryDirectory(prefix="anjing-hand-") as temporary:
            candidate = Path(temporary) / "anjing-hand.woff2"
            font.save(candidate)
            if candidate.stat().st_size > MAX_BYTES:
                raise ValueError(f"UI font exceeds 120 KB: {candidate.stat().st_size} bytes")
            with TTFont(candidate) as verified:
                if set(map(ord, characters)) - set(verified.getBestCmap()):
                    raise ValueError("Generated font lost a requested UI glyph")
                for record in verified["name"].names:
                    if record.nameID in IDENTITY_NAMES:
                        if record.toUnicode() != IDENTITY_NAMES[record.nameID]:
                            raise ValueError("Generated font retained a reserved primary name")
                kept_copyrights = {
                    record.toUnicode() for record in verified["name"].names if record.nameID == 0
                }
                if original_copyrights != kept_copyrights:
                    raise ValueError("Generated font lost the original copyright notice")
            directory = ROOT / "public/fonts"
            directory.mkdir(parents=True, exist_ok=True)
            output = directory / "anjing-hand.woff2"
            output.write_bytes(candidate.read_bytes())
    (directory / "OFL.txt").write_bytes(license_file.read_bytes())
    (directory / "glyphs.txt").write_text(characters + "\n", encoding="utf-8")
    (directory / "SOURCE.md").write_text(
        "# Anjing Hand 字体来源\n\n"
        "本地 UI 字体由官方 LXGW WenKai Regular 生成静态字符子集；"
        "内部字体名称已改为 Anjing Hand，保留原版权、设计者与 SIL OFL 1.1 许可。"
        "这里只重命名和裁剪字符，未修改字形设计。运行时无需请求字体 CDN。\n\n"
        f"- 上游：[LXGW WenKai]({UPSTREAM})\n"
        f"- 固定提交：`{COMMIT}`\n"
        f"- 原字体：[LXGWWenKai-Regular.ttf]({RAW}/{FONT_PATH})\n"
        f"- 原字体 SHA-256：`{FONT_SHA256}`\n"
        f"- 原许可：[OFL.txt]({RAW}/OFL.txt)；随字体原样附带\n"
        f"- 子集：`src/**/*.ts`、`src/**/*.tsx` 中的汉字和标点，另含可打印 ASCII；"
        f"共 {len(characters)} 个 Unicode 字符，清单为 `glyphs.txt`\n"
        f"- 产物：`anjing-hand.woff2`，{output.stat().st_size} 字节\n"
        f"- 产物 SHA-256：`{digest(output)}`\n"
        f"- 生成工具：fontTools {fontTools.__version__}、Brotli {brotli.__version__}\n"
        "- 重新生成：`uv run scripts/fetch-font.py`；新增静态 UI 文字后执行。"
        "用户输入和子集外字符使用界面的系统字体后备。\n",
        encoding="utf-8",
    )
    print(f"Anjing Hand: {output.stat().st_size} bytes, {len(characters)} characters")
    print(f"SHA-256: {digest(output)}")
    print("Glyph coverage, primary font names and original copyrights verified")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-font", type=Path, help="Use a cached pinned official TTF")
    parser.add_argument("--license", type=Path, help="Use a cached pinned official OFL.txt")
    args = parser.parse_args()
    cache = Path(tempfile.gettempdir()) / "anjing-music-x-font" / COMMIT
    font = args.source_font or source_file(
        f"{RAW}/{FONT_PATH}", cache / "LXGWWenKai-Regular.ttf", FONT_SHA256,
    )
    license_file = args.license or source_file(
        f"{RAW}/OFL.txt", cache / "OFL.txt", LICENSE_SHA256,
    )
    build(font, license_file)


if __name__ == "__main__":
    main()
