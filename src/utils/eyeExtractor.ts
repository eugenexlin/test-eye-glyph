import type { EyeGlyph, PupilDirection } from '../types/eye';
import { SECTION_CONFIGS } from '../data/eyeDataset';

const DIR_MAP: Record<number, PupilDirection> = {
  0: 'center',
  1: 'up',
  2: 'right',
  3: 'down',
  4: 'left',
};

export interface ExtractionResult {
  source: 'east' | 'west';
  eyes: EyeGlyph[];
  durationMs: number;
  totalExtracted: number;
}

export function extractEyesFromCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  source: 'east' | 'west'
): ExtractionResult {
  const startTime = performance.now();
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const isDark = (px: number, py: number): boolean => {
    if (px < 0 || px >= width || py < 0 || py >= height) return false;
    const idx = (py * width + px) * 4;
    // Eye black pixel threshold
    return data[idx] < 100 && data[idx + 3] > 128;
  };

  const getEyeVal = (cx: number, cy: number): number => {
    if (isDark(cx, cy - 1) && !isDark(cx, cy + 1)) return 1; // Up
    if (isDark(cx + 1, cy) && !isDark(cx - 1, cy)) return 2; // Right
    if (isDark(cx, cy + 1) && !isDark(cx, cy - 1)) return 3; // Down
    if (isDark(cx - 1, cy) && !isDark(cx + 1, cy)) return 4; // Left
    return 0; // Center
  };

  const relevantSections = SECTION_CONFIGS.filter(s => s.source === source);
  const extractedEyes: EyeGlyph[] = [];

  for (const sec of relevantSections) {
    let rowIndex = 0;
    let charIndex = 0;

    for (let y = sec.startY; y <= sec.endY; y++) {
      const rowCenters: number[] = [];

      for (let cx = 10; cx < width - 10; cx++) {
        // Match eye top/bottom outline caps at cy-3 and cy+3
        if (
          isDark(cx - 1, y - 3) &&
          isDark(cx, y - 3) &&
          isDark(cx + 1, y - 3) &&
          !isDark(cx - 2, y - 3) &&
          !isDark(cx + 2, y - 3) &&
          isDark(cx - 1, y + 3) &&
          isDark(cx, y + 3) &&
          isDark(cx + 1, y + 3)
        ) {
          rowCenters.push(cx);
        }
      }

      if (rowCenters.length >= 10) {
        for (let colIndex = 0; colIndex < rowCenters.length; colIndex++) {
          const cx = rowCenters[colIndex];
          const val = getEyeVal(cx, y);

          extractedEyes.push({
            id: `${source}-${sec.messageIndex}-${charIndex}`,
            source,
            sectionName: sec.sectionName,
            messageIndex: sec.messageIndex,
            rowIndex,
            colIndex,
            charIndex,
            cx,
            cy: y,
            val,
            dir: DIR_MAP[val],
          });

          charIndex++;
        }
        rowIndex++;
      }
    }
  }

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    source,
    eyes: extractedEyes,
    durationMs,
    totalExtracted: extractedEyes.length,
  };
}
