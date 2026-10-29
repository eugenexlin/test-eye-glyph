# Noita Eye Glyphs: Research Progression Workbook

A client-side, serverless web workbench for decoding and analyzing the Noita Eye Messages mystery.

## Features

- **Topic 1: Image Extraction & Raw Mapping**
  - Examines `resources/1x-eyes-east.png` (503x580) and `resources/1x-eyes-west.png` (503x438).
  - Spatial extraction of 3,108 eyeball entities across all 9 messages.
  - Interactive canvas/SVG overlay with 1x, 2x, 4x, and 8x pixel zoom.
  - Number overlay (0-4), SVG geometric shapes (directional triangles and center circle), and bounding box toggles.
  - Interactive opacity slider to smoothly blend the overlay over the raw PNG pixels.
  - Real-time in-browser computer vision pixel extraction benchmark.
  - Cross-reference analysis proving a 100% exact match against `noitaeye.txt` (alternating East and West).
  - Rich 2D spatial data model retaining `(cx, cy)`, grid rows, column coordinates, and image origins.

- **Upcoming Progression Topics**
  - **Topic 2**: Quinary & Frequency Distribution (unigram, bigram, n-gram entropy, base-25/base-125 tests).
  - **Topic 3**: Inter-Message Alignment & Motifs (shared prefixes like `101322330404...` and geometric XOR).
  - **Topic 4**: Cipher Hypotheses & Decoders (substitution, polyalphabetic, and quadgram scoring).

## Development & Build

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Lint
npm run lint

# Build static production bundle
npm run build
```
