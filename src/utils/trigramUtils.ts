import type { EyeGlyph, EyeMessageSummary, EyeInversionSettings } from '../types/eye';
import { ALL_EYES } from '../data/allEyes';
import { getMessageSummaries } from '../data/eyeDataset';

export interface TrigramInfo {
  code: string; // e.g. "010"
  decimal: number; // 0 to 124
  d1: number;
  d2: number;
  d3: number;
  count: number;
  frequency: number; // percentage 0 to 100
  expectedRatio: number; // count / expected
  messageCounts: Record<number, number>; // messageIndex (1..9) -> count
}

export interface TrigramAnalysisOptions {
  mode: 'overlapping' | 'non_overlapping';
  messageFilter: 'all' | number; // 'all' or message 1..9
  eyeInversion?: EyeInversionSettings;
}

export interface TrigramAnalysisResult {
  totalTrigrams: number;
  uniqueCount: number;
  missingTrigrams: string[];
  maxCount: number;
  minCount: number;
  meanCount: number;
  entropy: number; // Shannon entropy in bits
  maxEntropy: number; // log2(125) ~ 6.9658
  trigrams: TrigramInfo[]; // All 125 trigrams with counts and metadata
}

// Generate all 125 possible quinary trigrams in numerical order (000 to 444)
export function getAll125TrigramCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 125; i++) {
    const d1 = Math.floor(i / 25);
    const d2 = Math.floor((i % 25) / 5);
    const d3 = i % 5;
    codes.push(`${d1}${d2}${d3}`);
  }
  return codes;
}

// Convert a quinary trigram string (e.g. "201") to decimal (0 to 124)
export function trigramToDecimal(code: string): number {
  if (code.length !== 3) return 0;
  const d1 = Number(code[0]);
  const d2 = Number(code[1]);
  const d3 = Number(code[2]);
  return d1 * 25 + d2 * 5 + d3;
}

// Convert a decimal number (0 to 124) to a quinary trigram string (e.g. 51 -> "201")
export function decimalToTrigram(dec: number): string {
  const d1 = Math.floor(dec / 25);
  const d2 = Math.floor((dec % 25) / 5);
  const d3 = dec % 5;
  return `${d1}${d2}${d3}`;
}

// Analyze all 125 trigrams across the dataset or a specific message
export function analyzeTrigrams(options: TrigramAnalysisOptions): TrigramAnalysisResult {
  const { mode, messageFilter } = options;
  const summaries = getMessageSummaries();

  const messagesToAnalyze =
    messageFilter === 'all'
      ? summaries
      : summaries.filter((s) => s.messageIndex === messageFilter);

  // Initialize all 125 trigram containers
  const countsMap = new Map<string, { count: number; messageCounts: Record<number, number> }>();
  for (const code of getAll125TrigramCodes()) {
    countsMap.set(code, {
      count: 0,
      messageCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    });
  }

  let totalTrigrams = 0;
  const step = mode === 'non_overlapping' ? 3 : 1;

  for (const msg of messagesToAnalyze) {
    const str = msg.rawString;
    for (let i = 0; i <= str.length - 3; i += step) {
      const tri = str.slice(i, i + 3);
      const entry = countsMap.get(tri);
      if (entry) {
        entry.count++;
        entry.messageCounts[msg.messageIndex] = (entry.messageCounts[msg.messageIndex] || 0) + 1;
        totalTrigrams++;
      }
    }
  }

  const expectedPerTrigram = totalTrigrams > 0 ? totalTrigrams / 125 : 0;
  const missingTrigrams: string[] = [];
  let uniqueCount = 0;
  let maxCount = 0;
  let minCount = totalTrigrams > 0 ? totalTrigrams : 0;

  // Shannon entropy calculation
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
    maxEntropy: Math.log2(125), // ~6.9658
    trigrams,
  };
}

// ---------------- Section 1 Text Formatter ----------------
export type EyeTextOrder = 'noitaeye' | 'east_west' | 'west_east' | 'concatenated';
export type EyeTextSpacing = 'none' | 'triplet' | 'quinary_group' | 'newlines' | 'double_newlines';
export type EyeTextArrangement = 'real_rows' | 'real_rows_staggered' | 'flat';

export interface EyeTextFormatOptions {
  order: EyeTextOrder;
  showLabels: boolean;
  spacing: EyeTextSpacing;
  arrangement?: EyeTextArrangement;
  showRowNumbers?: boolean;
  messageFilter: 'all' | number;
}

/**
 * Format eyes of a single message into lines according to their actual row arrangement on the stone.
 */
export function formatMessageEyesAsRows(
  eyes: EyeGlyph[],
  applySpacing: (digits: string) => string,
  isStaggered: boolean,
  showRowNumbers: boolean
): string {
  const rowMap = new Map<number, EyeGlyph[]>();
  for (const eye of eyes) {
    let row = rowMap.get(eye.rowIndex);
    if (!row) {
      row = [];
      rowMap.set(eye.rowIndex, row);
    }
    row.push(eye);
  }

  const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
  const lines: string[] = [];

  for (const rIdx of sortedRowIndices) {
    const rowEyes = rowMap.get(rIdx) || [];
    rowEyes.sort((a, b) => a.colIndex - b.colIndex || a.cx - b.cx);
    const rowDigits = rowEyes.map((e) => e.val).join('');
    const spaced = applySpacing(rowDigits);

    let prefix = '';
    if (showRowNumbers) {
      prefix = `Row ${rIdx}: `;
    }
    if (isStaggered && rIdx % 2 === 1) {
      prefix = ' ' + prefix;
    }
    lines.push(`${prefix}${spaced}`);
  }

  return lines.join('\n');
}

export function formatRawEyeText(options: EyeTextFormatOptions): string {
  const summaries = getMessageSummaries();
  let orderedSummaries: EyeMessageSummary[] = [];

  if (options.messageFilter !== 'all') {
    orderedSummaries = summaries.filter((s) => s.messageIndex === options.messageFilter);
  } else if (options.order === 'noitaeye') {
    // Interleaved East 1, West 1, East 2, West 2... (messages 1..9)
    orderedSummaries = [...summaries].sort((a, b) => a.messageIndex - b.messageIndex);
  } else if (options.order === 'east_west') {
    // All East messages (1, 3, 5, 7, 9) then all West messages (2, 4, 6, 8)
    const east = summaries.filter((s) => s.source === 'east').sort((a, b) => a.messageIndex - b.messageIndex);
    const west = summaries.filter((s) => s.source === 'west').sort((a, b) => a.messageIndex - b.messageIndex);
    orderedSummaries = [...east, ...west];
  } else if (options.order === 'west_east') {
    // All West messages (2, 4, 6, 8) then all East messages (1, 3, 5, 7, 9)
    const west = summaries.filter((s) => s.source === 'west').sort((a, b) => a.messageIndex - b.messageIndex);
    const east = summaries.filter((s) => s.source === 'east').sort((a, b) => a.messageIndex - b.messageIndex);
    orderedSummaries = [...west, ...east];
  } else {
    // concatenated
    orderedSummaries = [...summaries].sort((a, b) => a.messageIndex - b.messageIndex);
  }

  // Format digit sequence with spacing
  const applySpacing = (digits: string): string => {
    if (options.spacing === 'triplet') {
      const chunks: string[] = [];
      for (let i = 0; i < digits.length; i += 3) {
        chunks.push(digits.slice(i, i + 3));
      }
      return chunks.join(' ');
    }
    if (options.spacing === 'quinary_group') {
      const chunks: string[] = [];
      for (let i = 0; i < digits.length; i += 5) {
        chunks.push(digits.slice(i, i + 5));
      }
      return chunks.join(' ');
    }
    return digits;
  };

  const isRealRows = options.arrangement === 'real_rows' || options.arrangement === 'real_rows_staggered';
  const isStaggered = options.arrangement === 'real_rows_staggered';
  const showRowNumbers = options.showRowNumbers ?? false;

  // Single Continuous Stream mode
  if (options.order === 'concatenated' && options.messageFilter === 'all') {
    if (isRealRows) {
      const allRowsText = orderedSummaries
        .map((s) => formatMessageEyesAsRows(s.eyes, applySpacing, isStaggered, showRowNumbers))
        .join('\n');
      if (options.showLabels) {
        return `// All 9 Eye Messages Concatenated (3,108 glyphs in real stone rows)\n${allRowsText}`;
      }
      return allRowsText;
    }

    const combinedDigits = orderedSummaries.map((s) => s.rawString).join('');
    if (options.showLabels) {
      return `// All 9 Eye Messages Concatenated (3108 glyphs)\n${applySpacing(combinedDigits)}`;
    }
    return applySpacing(combinedDigits);
  }

  const sectionsText = orderedSummaries.map((s) => {
    const formattedBody = isRealRows
      ? formatMessageEyesAsRows(s.eyes, applySpacing, isStaggered, showRowNumbers)
      : applySpacing(s.rawString);

    if (!options.showLabels) {
      return formattedBody;
    }

    const rowInfo = isRealRows ? ` (${s.rowCount} rows)` : '';
    const label = `// Message ${s.messageIndex} (${s.sectionName.toUpperCase()}) - ${s.charCount} glyphs${rowInfo}`;
    return `${label}\n${formattedBody}`;
  });

  const delimiter = (isRealRows || options.spacing === 'double_newlines') ? '\n\n' : '\n';
  return sectionsText.join(delimiter);
}

// ---------------- Section 2 Spatial Entity Formatter ----------------
export type SpatialFormatMode = 'json_pretty' | 'json_compact' | 'tuples' | 'csv';

export interface SpatialEntitiesFormatOptions {
  scope: 'all' | 'east' | 'west' | number; // 'all', 'east', 'west', or message 1..9
  format: SpatialFormatMode;
}

export function formatSpatialEntities(options: SpatialEntitiesFormatOptions): string {
  let eyes: EyeGlyph[] = ALL_EYES;

  if (options.scope === 'east' || options.scope === 'west') {
    eyes = ALL_EYES.filter((e) => e.source === options.scope);
  } else if (typeof options.scope === 'number') {
    eyes = ALL_EYES.filter((e) => e.messageIndex === options.scope);
  }

  if (options.format === 'json_pretty') {
    return JSON.stringify(eyes, null, 2);
  }

  if (options.format === 'json_compact') {
    return '[\n' + eyes.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n]';
  }

  if (options.format === 'tuples') {
    // Compact coordinate array: [cx, cy, val]
    return '[\n' + eyes.map((e) => `  [${e.cx}, ${e.cy}, ${e.val}]`).join(',\n') + '\n]';
  }

  if (options.format === 'csv') {
    const header = 'id,source,sectionName,messageIndex,rowIndex,colIndex,charIndex,cx,cy,val,dir';
    const rows = eyes.map(
      (e) =>
        `${e.id},${e.source},"${e.sectionName}",${e.messageIndex},${e.rowIndex},${e.colIndex},${e.charIndex},${e.cx},${e.cy},${e.val},${e.dir}`
    );
    return [header, ...rows].join('\n');
  }

  return '';
}

// ---------------- Section 3 Trigrams Formatter ----------------
export type TrigramOutputOrder =
  | 'freq_desc'
  | 'freq_asc'
  | 'quinary'
  | 'stream'
  | 'decimal_stream'
  | 'tsv_table';

export interface TrigramFormatOptions {
  mode: 'overlapping' | 'non_overlapping';
  messageFilter: 'all' | number;
  order: TrigramOutputOrder;
  includeZeroCounts: boolean;
}

export function formatTrigramsOutput(options: TrigramFormatOptions): string {
  const result = analyzeTrigrams({
    mode: options.mode,
    messageFilter: options.messageFilter,
  });

  if (options.order === 'stream') {
    // Consecutive stream of trigrams separated by spaces
    const summaries = getMessageSummaries();
    const messages =
      options.messageFilter === 'all'
        ? summaries
        : summaries.filter((s) => s.messageIndex === options.messageFilter);

    const step = options.mode === 'non_overlapping' ? 3 : 1;
    const allTrigrams: string[] = [];

    for (const msg of messages) {
      const str = msg.rawString;
      for (let i = 0; i <= str.length - 3; i += step) {
        allTrigrams.push(str.slice(i, i + 3));
      }
    }

    return allTrigrams.join(' ');
  }

  if (options.order === 'decimal_stream') {
    // Consecutive stream of base-10 decimals (0..124)
    const summaries = getMessageSummaries();
    const messages =
      options.messageFilter === 'all'
        ? summaries
        : summaries.filter((s) => s.messageIndex === options.messageFilter);

    const step = options.mode === 'non_overlapping' ? 3 : 1;
    const decimals: number[] = [];

    for (const msg of messages) {
      const str = msg.rawString;
      for (let i = 0; i <= str.length - 3; i += step) {
        decimals.push(trigramToDecimal(str.slice(i, i + 3)));
      }
    }

    return decimals.join(' ');
  }

  // Work with list of 125 trigrams
  let list = [...result.trigrams];

  if (!options.includeZeroCounts) {
    list = list.filter((t) => t.count > 0);
  }

  if (options.order === 'freq_desc') {
    list.sort((a, b) => b.count - a.count || a.decimal - b.decimal);
  } else if (options.order === 'freq_asc') {
    list.sort((a, b) => a.count - b.count || a.decimal - b.decimal);
  } else {
    // quinary numerical order (000 to 444)
    list.sort((a, b) => a.decimal - b.decimal);
  }

  if (options.order === 'tsv_table') {
    const header = 'Trigram\tDecimal\tCount\tFrequency%\tRatioToUniform';
    const rows = list.map(
      (t) => `${t.code}\t${t.decimal}\t${t.count}\t${t.frequency.toFixed(2)}%\t${t.expectedRatio.toFixed(2)}x`
    );
    return [header, ...rows].join('\n');
  }

  // Standard line output: "010 (dec: 5): 58 (1.88%) [2.35x uniform]"
  const lines = list.map((t) => {
    return `${t.code}  (dec: ${String(t.decimal).padStart(3, ' ')}) : count = ${String(t.count).padStart(3, ' ')}  (${t.frequency.toFixed(2)}%)  [${t.expectedRatio.toFixed(2)}x uniform]`;
  });

  const headerNotice = `// Quinary Trigrams (${options.mode}, ${options.messageFilter === 'all' ? 'All Messages' : `Message ${options.messageFilter}`})\n// Total Trigrams: ${result.totalTrigrams} | Unique: ${result.uniqueCount}/125 | Missing: ${result.missingTrigrams.join(', ') || 'None'}\n\n`;

  return headerNotice + lines.join('\n');
}
