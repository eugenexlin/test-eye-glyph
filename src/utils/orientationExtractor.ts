import type { EyeGlyph, PupilDirection, EyeInversionMode, EyeInversionSettings } from '../types/eye';
import { DEFAULT_EYE_INVERSION } from '../types/eye';
import { ALL_EYES } from '../data/allEyes';
import {
  getAll125TrigramCodes,
  decimalToTrigram,
  trigramToDecimal,
  type TrigramAnalysisOptions,
  type TrigramAnalysisResult,
  type TrigramInfo,
  type TrigramFormatOptions,
} from './trigramUtils';

export type { EyeInversionMode, EyeInversionSettings };
export { DEFAULT_EYE_INVERSION };

export function transformEyeValue(
  val: number,
  swapUpDown = true,
  swapLeftRight = true
): { val: number; dir: PupilDirection } {
  let nextVal = val;
  if (swapUpDown) {
    if (nextVal === 1) nextVal = 3; // Up -> Down
    else if (nextVal === 3) nextVal = 1; // Down -> Up
  }
  if (swapLeftRight) {
    if (nextVal === 2) nextVal = 4; // Right -> Left
    else if (nextVal === 4) nextVal = 2; // Left -> Right
  }

  const dirMap: Record<number, PupilDirection> = {
    0: 'center',
    1: 'up',
    2: 'right',
    3: 'down',
    4: 'left',
  };

  return { val: nextVal, dir: dirMap[nextVal] || 'center' };
}

export type SixEyePattern = [[number, number, number], [number, number, number]];

export interface PresetOrientation {
  id: string;
  name: string;
  pattern: SixEyePattern;
  description: string;
}

// 4 Curated presets that respect 3-eye partial block endings
export const PRESET_ORIENTATIONS: PresetOrientation[] = [
  {
    id: 'zigzag_down_up',
    name: 'Zigzag Down-Up',
    pattern: [
      [1, 3, 5],
      [2, 4, 6],
    ],
    description: 'Alternates top and bottom (T0 -> B0 -> T1 -> B1 -> T2 -> B2).',
  },
  {
    id: 'zigzag_variant',
    name: 'Zigzag Inverted Return',
    pattern: [
      [1, 3, 5],
      [2, 6, 4],
    ],
    description: 'Zigzag for Trigram 1 (T0, B0, T1), then inverted return (B2, T2, B1).',
  },
  {
    id: 'loop_perimeter',
    name: 'Perimeter Loop',
    pattern: [
      [1, 2, 6],
      [3, 4, 5],
    ],
    description: 'Top pair then bottom (T0, T1, B0), then bottom return (B1, B2, T2).',
  },
  {
    id: 'loop_variant',
    name: 'Loop Inverted Return',
    pattern: [
      [1, 2, 6],
      [3, 5, 4],
    ],
    description: 'Top pair then bottom (T0, T1, B0), then zig-return (B2, B1, T2).',
  },
];

// Helper: Given a 6-eye pattern, return the 6 slots in visit order (1 to 6)
export function getSlotOrderFromPattern(pattern: SixEyePattern): { rOffset: number; cOffset: number; order: number }[] {
  const slots: { rOffset: number; cOffset: number; order: number }[] = [];
  for (let step = 1; step <= 6; step++) {
    for (let c = 0; c < 3; c++) {
      if (pattern[0][c] === step) {
        slots.push({ rOffset: 0, cOffset: c, order: step });
      }
      if (pattern[1][c] === step) {
        slots.push({ rOffset: 1, cOffset: c, order: step });
      }
    }
  }
  return slots;
}

// Extract eyes for a specific message using the 6-eye repeating pattern
export function extractMessageEyesWithPattern(
  messageIndex: number,
  pattern: SixEyePattern,
  eyes: EyeGlyph[] = ALL_EYES,
  inversion: EyeInversionSettings = DEFAULT_EYE_INVERSION
): EyeGlyph[] {
  const msgEyes = eyes.filter((e) => e.messageIndex === messageIndex);
  if (msgEyes.length === 0) return [];

  const rowMap: Record<number, EyeGlyph[]> = {};
  for (const e of msgEyes) {
    if (!rowMap[e.rowIndex]) rowMap[e.rowIndex] = [];
    rowMap[e.rowIndex][e.colIndex] = e;
  }

  const rowIndices = Object.keys(rowMap)
    .map(Number)
    .sort((a, b) => a - b);
  const slotOrder = getSlotOrderFromPattern(pattern);
  const result: EyeGlyph[] = [];

  for (let rIdx = 0; rIdx < rowIndices.length; rIdx += 2) {
    const r0 = rowMap[rowIndices[rIdx]] || [];
    const r1 = rowMap[rowIndices[rIdx + 1]] || [];
    const maxCol = Math.max(r0.length, r1.length);

    for (let col = 0; col < maxCol; col += 3) {
      for (const slot of slotOrder) {
        const rowArr = slot.rOffset === 0 ? r0 : r1;
        const eye = rowArr[col + slot.cOffset];
        if (eye) {
          let eyeToPush = eye;
          const shouldInvert =
            inversion.mode === 'all' ||
            (inversion.mode === 'return_only' && slot.order >= 4);

          if (shouldInvert && (inversion.swapUpDown || inversion.swapLeftRight)) {
            const transformed = transformEyeValue(
              eye.val,
              inversion.swapUpDown,
              inversion.swapLeftRight
            );
            eyeToPush = {
              ...eye,
              val: transformed.val,
              dir: transformed.dir,
            };
          }
          result.push(eyeToPush);
        }
      }
    }
  }

  return result;
}

// Extract all messages or filtered messages using a 6-eye pattern
export function extractAllMessagesWithPattern(
  pattern: SixEyePattern,
  messageFilter: 'all' | number = 'all',
  eyes: EyeGlyph[] = ALL_EYES,
  inversion: EyeInversionSettings = DEFAULT_EYE_INVERSION
): Record<number, EyeGlyph[]> {
  const messageIndices =
    messageFilter === 'all' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [messageFilter];

  const result: Record<number, EyeGlyph[]> = {};
  for (const mIdx of messageIndices) {
    result[mIdx] = extractMessageEyesWithPattern(mIdx, pattern, eyes, inversion);
  }
  return result;
}

// Sample verification: returns the first few extracted trigrams with their indices and coordinates
export interface SampleTrigramProof {
  trigramIndex: number;
  blockIndex: number;
  label: string;
  indicesStr: string;
  coordsStr: string;
  valuesStr: string;
  trigramCode: string;
  eyes: EyeGlyph[];
  isReturnTrigram?: boolean;
  isInverted?: boolean;
}

export function getSampleTrigramProof(
  pattern: SixEyePattern,
  messageIndex = 1,
  sampleCount = 6,
  eyes: EyeGlyph[] = ALL_EYES,
  inversion: EyeInversionSettings = DEFAULT_EYE_INVERSION
): SampleTrigramProof[] {
  const orderedEyes = extractMessageEyesWithPattern(messageIndex, pattern, eyes, inversion);
  const proofs: SampleTrigramProof[] = [];

  for (let i = 0; i <= orderedEyes.length - 3 && proofs.length < sampleCount; i += 3) {
    const trio = [orderedEyes[i], orderedEyes[i + 1], orderedEyes[i + 2]];
    const blockIdx = Math.floor(i / 6);
    const triIdx = Math.floor(i / 3) + 1;
    const isReturnTrigram = (i % 6) === 3;
    const isInverted =
      inversion.mode === 'all' || (inversion.mode === 'return_only' && isReturnTrigram);

    const indicesStr = `(${trio[0].charIndex}, ${trio[1].charIndex}, ${trio[2].charIndex})`;
    const coordsStr = `[(${trio[0].cx},${trio[0].cy}) (${trio[1].cx},${trio[1].cy}) (${trio[2].cx},${trio[2].cy})]`;
    const valuesStr = `[${trio[0].val}, ${trio[1].val}, ${trio[2].val}]`;
    const trigramCode = `${trio[0].val}${trio[1].val}${trio[2].val}`;

    proofs.push({
      trigramIndex: triIdx,
      blockIndex: blockIdx,
      label: `Trigram #${triIdx} (Block ${blockIdx + 1})`,
      indicesStr,
      coordsStr,
      valuesStr,
      trigramCode,
      eyes: trio,
      isReturnTrigram,
      isInverted,
    });
  }

  return proofs;
}

// Frequency Analysis on any orientation pattern
export function analyzeTrigramsForOrientation(
  pattern: SixEyePattern,
  options: TrigramAnalysisOptions,
  eyes: EyeGlyph[] = ALL_EYES
): TrigramAnalysisResult {
  const { mode, messageFilter, eyeInversion = DEFAULT_EYE_INVERSION } = options;
  const messageData = extractAllMessagesWithPattern(pattern, messageFilter, eyes, eyeInversion);

  const countsMap = new Map<string, { count: number; messageCounts: Record<number, number> }>();
  for (const code of getAll125TrigramCodes()) {
    countsMap.set(code, {
      count: 0,
      messageCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    });
  }

  let totalTrigrams = 0;
  const step = mode === 'non_overlapping' ? 3 : 1;

  for (const [mIdxStr, mEyes] of Object.entries(messageData)) {
    const mIdx = Number(mIdxStr);
    const digits = mEyes.map((e) => e.val).join('');

    for (let i = 0; i <= digits.length - 3; i += step) {
      const tri = digits.slice(i, i + 3);
      const entry = countsMap.get(tri);
      if (entry) {
        entry.count++;
        entry.messageCounts[mIdx] = (entry.messageCounts[mIdx] || 0) + 1;
        totalTrigrams++;
      }
    }
  }

  const expectedPerTrigram = totalTrigrams > 0 ? totalTrigrams / 125 : 0;
  const missingTrigrams: string[] = [];
  let uniqueCount = 0;
  let maxCount = 0;
  let minCount = totalTrigrams > 0 ? totalTrigrams : 0;
  let entropy = 0;
  const trigrams: TrigramInfo[] = [];

  for (let dec = 0; dec < 125; dec++) {
    const code = decimalToTrigram(dec);
    const entry = countsMap.get(code)!;
    const count = entry.count;
    const freq = totalTrigrams > 0 ? (count / totalTrigrams) * 100 : 0;
    const expectedRatio = expectedPerTrigram > 0 ? count / expectedPerTrigram : 0;

    if (count > 0) {
      uniqueCount++;
      const p = count / totalTrigrams;
      entropy -= p * Math.log2(p);
    } else {
      missingTrigrams.push(code);
    }

    if (count > maxCount) maxCount = count;
    if (count < minCount) minCount = count;

    trigrams.push({
      code,
      decimal: dec,
      d1: Math.floor(dec / 25),
      d2: Math.floor((dec % 25) / 5),
      d3: dec % 5,
      count,
      frequency: freq,
      expectedRatio,
      messageCounts: entry.messageCounts,
    });
  }

  return {
    totalTrigrams,
    uniqueCount,
    missingTrigrams,
    maxCount,
    minCount,
    meanCount: expectedPerTrigram,
    entropy,
    maxEntropy: Math.log2(125),
    trigrams,
  };
}

// Comparison metrics row
export interface PatternComparisonMetrics {
  id: string;
  name?: string;
  pattern: SixEyePattern;
  totalTrigrams: number;
  uniqueCount: number;
  missingCount: number;
  entropy: number;
  topTrigram: string;
  topCount: number;
  topFrequency: number;
  chiSquare: number;
  isViablePartialBlock: boolean;
}

export function compareAllPresetPatterns(
  mode: 'overlapping' | 'non_overlapping' = 'non_overlapping',
  eyes: EyeGlyph[] = ALL_EYES,
  inversion: EyeInversionSettings = DEFAULT_EYE_INVERSION
): PatternComparisonMetrics[] {
  return PRESET_ORIENTATIONS.map((preset) => {
    const res = analyzeTrigramsForOrientation(
      preset.pattern,
      { mode, messageFilter: 'all', eyeInversion: inversion },
      eyes
    );
    const sorted = [...res.trigrams].sort((a, b) => b.count - a.count);
    const top = sorted[0];

    let chiSquare = 0;
    const expected = res.meanCount;
    if (expected > 0) {
      for (const t of res.trigrams) {
        chiSquare += Math.pow(t.count - expected, 2) / expected;
      }
    }

    return {
      id: preset.id,
      name: preset.name,
      pattern: preset.pattern,
      totalTrigrams: res.totalTrigrams,
      uniqueCount: res.uniqueCount,
      missingCount: res.missingTrigrams.length,
      entropy: res.entropy,
      topTrigram: top ? top.code : '',
      topCount: top ? top.count : 0,
      topFrequency: top ? top.frequency : 0,
      chiSquare,
      isViablePartialBlock: true,
    };
  });
}

// ---------------- Exhaustive Permutation Engine (All 720 Permutations) ----------------

// Generate all 720 permutations of [0, 1, 2, 3, 4, 5]
export function generateAll720SlotPermutations(): number[][] {
  function permute(arr: number[]): number[][] {
    if (arr.length === 0) return [[]];
    const res: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = permute(arr.slice(0, i).concat(arr.slice(i + 1)));
      for (const r of rest) res.push([arr[i], ...r]);
    }
    return res;
  }
  return permute([0, 1, 2, 3, 4, 5]);
}

// Convert slot permutation [0..5] to SixEyePattern
export function slotPermutationToPattern(perm: number[]): SixEyePattern {
  const pattern: SixEyePattern = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let s = 0; s < 6; s++) {
    const slot = perm[s];
    const r = slot < 3 ? 0 : 1;
    const c = slot < 3 ? slot : slot - 3;
    pattern[r][c] = s + 1;
  }
  return pattern;
}

// Pre-packed blocks for ultra-fast permutation evaluation
export interface PackedBlock {
  mIdx: number;
  vals: [number, number, number, number, number, number]; // -1 if empty
}

export function buildPackedBlocks(eyes: EyeGlyph[] = ALL_EYES): PackedBlock[] {
  const msgMap: Record<number, Record<number, number[]>> = {};
  for (const e of eyes) {
    if (!msgMap[e.messageIndex]) msgMap[e.messageIndex] = {};
    if (!msgMap[e.messageIndex][e.rowIndex]) msgMap[e.messageIndex][e.rowIndex] = [];
    msgMap[e.messageIndex][e.rowIndex][e.colIndex] = e.val;
  }

  const blocks: PackedBlock[] = [];
  for (const mIdxStr of Object.keys(msgMap)) {
    const mIdx = Number(mIdxStr);
    const rows = msgMap[mIdx];
    const rowIndices = Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b);

    for (let rIdx = 0; rIdx < rowIndices.length; rIdx += 2) {
      const r0 = rows[rowIndices[rIdx]] || [];
      const r1 = rows[rowIndices[rIdx + 1]] || [];
      const maxCol = Math.max(r0.length, r1.length);

      for (let col = 0; col < maxCol; col += 3) {
        blocks.push({
          mIdx,
          vals: [
            r0[col] !== undefined ? r0[col] : -1,
            r0[col + 1] !== undefined ? r0[col + 1] : -1,
            r0[col + 2] !== undefined ? r0[col + 2] : -1,
            r1[col] !== undefined ? r1[col] : -1,
            r1[col + 1] !== undefined ? r1[col + 1] : -1,
            r1[col + 2] !== undefined ? r1[col + 2] : -1,
          ],
        });
      }
    }
  }

  return blocks;
}

// Evaluate single permutation on pre-packed blocks in <0.05ms
export function evaluateSinglePermutation(
  perm: number[],
  blocks: PackedBlock[],
  mode: 'overlapping' | 'non_overlapping' = 'non_overlapping',
  inversion: EyeInversionSettings = DEFAULT_EYE_INVERSION
): PatternComparisonMetrics {
  const pattern = slotPermutationToPattern(perm);
  const isViablePartialBlock = !(
    (perm[0] < 3 && perm[1] < 3 && perm[2] < 3) ||
    (perm[0] >= 3 && perm[1] >= 3 && perm[2] >= 3)
  );

  const counts = new Uint16Array(125);
  let totalTrigrams = 0;
  const step = mode === 'non_overlapping' ? 3 : 1;
  const doInvert = inversion.mode !== 'none' && (inversion.swapUpDown || inversion.swapLeftRight);

  for (let b = 0; b < blocks.length; b++) {
    const blk = blocks[b].vals;
    const seq: number[] = [];
    for (let s = 0; s < 6; s++) {
      let v = blk[perm[s]];
      if (v !== -1) {
        if (doInvert) {
          if (inversion.mode === 'all' || (inversion.mode === 'return_only' && s >= 3)) {
            v = transformEyeValue(v, inversion.swapUpDown, inversion.swapLeftRight).val;
          }
        }
        seq.push(v);
      }
    }
    for (let i = 0; i <= seq.length - 3; i += step) {
      const dec = seq[i] * 25 + seq[i + 1] * 5 + seq[i + 2];
      counts[dec]++;
      totalTrigrams++;
    }
  }

  let entropy = 0;
  let missingCount = 0;
  let uniqueCount = 0;
  let maxCount = 0;
  let topDecimal = 0;
  let chiSquare = 0;
  const expected = totalTrigrams / 125;

  for (let dec = 0; dec < 125; dec++) {
    const c = counts[dec];
    if (c === 0) {
      missingCount++;
    } else {
      uniqueCount++;
      const p = c / totalTrigrams;
      entropy -= p * Math.log2(p);
      if (c > maxCount) {
        maxCount = c;
        topDecimal = dec;
      }
    }
    if (expected > 0) {
      chiSquare += Math.pow(c - expected, 2) / expected;
    }
  }

  const topTrigram = decimalToTrigram(topDecimal);
  const topFrequency = totalTrigrams > 0 ? (maxCount / totalTrigrams) * 100 : 0;
  const id = `perm-${perm.join('-')}`;

  return {
    id,
    pattern,
    totalTrigrams,
    uniqueCount,
    missingCount,
    entropy,
    topTrigram,
    topCount: maxCount,
    topFrequency,
    chiSquare,
    isViablePartialBlock,
  };
}

// Format trigrams raw output text for any chosen orientation pattern
export function formatTrigramsOutputWithOrientation(
  pattern: SixEyePattern,
  options: TrigramFormatOptions,
  eyes: EyeGlyph[] = ALL_EYES,
  inversion: EyeInversionSettings = DEFAULT_EYE_INVERSION
): string {
  const result = analyzeTrigramsForOrientation(pattern, {
    mode: options.mode,
    messageFilter: options.messageFilter,
    eyeInversion: inversion,
  }, eyes);

  const messageData = extractAllMessagesWithPattern(pattern, options.messageFilter, eyes, inversion);
  const step = options.mode === 'non_overlapping' ? 3 : 1;

  if (options.order === 'stream') {
    const allTrigrams: string[] = [];
    for (const mEyes of Object.values(messageData)) {
      const digits = mEyes.map((e) => e.val).join('');
      for (let i = 0; i <= digits.length - 3; i += step) {
        allTrigrams.push(digits.slice(i, i + 3));
      }
    }
    return allTrigrams.join(' ');
  }

  if (options.order === 'decimal_stream') {
    const decimals: number[] = [];
    for (const mEyes of Object.values(messageData)) {
      const digits = mEyes.map((e) => e.val).join('');
      for (let i = 0; i <= digits.length - 3; i += step) {
        decimals.push(trigramToDecimal(digits.slice(i, i + 3)));
      }
    }
    return decimals.join(' ');
  }

  let list = [...result.trigrams];
  if (!options.includeZeroCounts) {
    list = list.filter((t) => t.count > 0);
  }

  if (options.order === 'freq_desc') {
    list.sort((a, b) => b.count - a.count || a.decimal - b.decimal);
  } else if (options.order === 'freq_asc') {
    list.sort((a, b) => a.count - b.count || a.decimal - b.decimal);
  } else {
    list.sort((a, b) => a.decimal - b.decimal);
  }

  if (options.order === 'tsv_table') {
    const header = 'Trigram\tDecimal\tCount\tFrequency%\tRatioToUniform';
    const rows = list.map(
      (t) => `${t.code}\t${t.decimal}\t${t.count}\t${t.frequency.toFixed(2)}%\t${t.expectedRatio.toFixed(2)}x`
    );
    return [header, ...rows].join('\n');
  }

  const lines = list.map((t) => {
    return `${t.code}  (dec: ${String(t.decimal).padStart(3, ' ')}) : count = ${String(t.count).padStart(3, ' ')}  (${t.frequency.toFixed(2)}%)  [${t.expectedRatio.toFixed(2)}x uniform]`;
  });

  const matrixStr = `[[${pattern[0].join(',')}],[${pattern[1].join(',')}]]`;
  const headerNotice = `// Quinary Trigrams (Pattern: ${matrixStr}, ${options.mode}, ${options.messageFilter === 'all' ? 'All Messages' : `Message ${options.messageFilter}`})\n// Total Trigrams: ${result.totalTrigrams} | Unique: ${result.uniqueCount}/125 | Missing: ${result.missingTrigrams.join(', ') || 'None'}\n\n`;

  return headerNotice + lines.join('\n');
}
