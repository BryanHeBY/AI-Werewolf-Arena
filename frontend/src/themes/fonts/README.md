# Local Noto fonts

These files are the complete Simplified Chinese variable fonts from the official
[Noto CJK repository](https://github.com/notofonts/noto-cjk), pinned to commit
`f8d157532fbfaeda587e826d4cd5b21a49186f7c`.

- Noto Sans SC 2.004: weight axis 100–900.
- Noto Serif SC 2.003: weight axis 200–900.

The official TTF files were converted with `woff2_compress` for transport. No
glyphs, outlines, font names or copyright records were edited or subsetted.
The preserved upstream family names match the Web CSS and video `FontFace`
registration. Web CSS uses the `AWA Web Noto ...` aliases for these same bytes,
so its CSS-connected faces cannot override an explicitly supplied project font
in the video on the same page. The fonts provide Chinese and Latin text; arbitrary emoji or
other writing systems are not claimed as covered.

Both fonts use SIL Open Font License 1.1. The upstream licenses are distributed
beside the fonts as `OFL-NotoSans.txt` and `OFL-NotoSerif.txt`. Original copyright:

- © 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.
- © 2017-2024 Adobe (http://www.adobe.com/).

`manifest.json` records original download URLs, exact versions, source and WOFF2
SHA256 digests, file sizes, license URLs and the compression tool fingerprint.
It is the provenance record for these bundled bytes, not a runtime download
list. Fonts load from the application bundle; no external font service or OS
font copy is required.

Project `fonts` explicitly replace bundled faces with the same family name.
Keep the license and provenance of any replacement; video rendering waits for
all required faces and stops on loading failure.
