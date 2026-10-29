import type { EyeGlyph, EyeInversionSettings } from '../types/eye';
import { DEFAULT_EYE_INVERSION } from '../types/eye';
import { ALL_EYES } from '../data/allEyes';
import {
  extractAllMessagesWithPattern,
  type SixEyePattern,
} from './orientationExtractor';

// The Perimeter Inverted Return pattern [[1, 2, 6], [3, 5, 4]]
export const INVERTED_RETURN_PATTERN: SixEyePattern = [
  [1, 2, 6],
  [3, 5, 4],
];

// 83-character Candidate Alphabets
export interface CandidateAlphabet {
  id: string;
  name: string;
  category: 'ascii' | 'alphanumeric' | 'orthography' | 'frequency' | 'base83' | 'custom';
  description: string;
  characters: string;
}

export const CANDIDATE_ALPHABETS: CandidateAlphabet[] = [
  {
    id: 'ascii_32_114',
    name: 'Printable ASCII (32-114, 83 Chars)',
    category: 'ascii',
    description: 'ASCII characters from space (32) to "r" (114). Maps 0 -> " ", 1 -> "!", ..., 82 -> "r".',
    characters: Array.from({ length: 83 }, (_, i) => String.fromCharCode(32 + i)).join(''),
  },
  {
    id: 'ascii_33_115',
    name: 'Printable ASCII Non-Space (33-115, 83 Chars)',
    category: 'ascii',
    description: 'ASCII characters from "!" (33) to "s" (115), avoiding initial leading whitespace.',
    characters: Array.from({ length: 83 }, (_, i) => String.fromCharCode(33 + i)).join(''),
  },
  {
    id: 'ascii_extended_125',
    name: 'Printable ASCII Extended (125 Chars)',
    category: 'ascii',
    description: 'ASCII 32 (space) to 126 (~, 95 chars) plus 30 extended Latin symbols (161-190). Full 1-to-1 mapping for all 125 trigrams.',
    characters: Array.from({ length: 125 }, (_, i) => String.fromCharCode(i < 95 ? 32 + i : 161 + (i - 95))).join(''),
  },
  {
    id: 'alphanumeric_83',
    name: 'Alphanumeric + 21 Punctuation (83 Chars)',
    category: 'alphanumeric',
    description: 'A-Z (26), a-z (26), 0-9 (10), followed by 21 standard punctuation marks.',
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?\'"-_()[]{}<>=',
  },
  {
    id: 'alphanumeric_125',
    name: 'Alphanumeric + Extended Symbols (125 Chars)',
    category: 'alphanumeric',
    description: 'A-Z (26), a-z (26), 0-9 (10), plus 63 punctuation and symbol characters to cover all 125 trigram states.',
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?\'"-_()[]{}<>=+/*\\|~`@#$%^&!¡¢£¤¥§©«®±µ¶·»¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍ',
  },
  {
    id: 'finnish_83',
    name: 'Finnish Orthography (83 Chars)',
    category: 'orthography',
    description: 'Finnish uppercase (A-Ö, 29), lowercase (a-ö, 29), digits (0-9, 10), and 15 symbols.',
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖabcdefghijklmnopqrstuvwxyzåäö0123456789 .,:;!?\'"-_()=',
  },
  {
    id: 'finnish_extended_125',
    name: 'Finnish Orthography Extended (125 Chars)',
    category: 'orthography',
    description: 'Finnish letters (A-Ö, 29), lowercase (a-ö, 29), digits (0-9, 10), and 57 symbols/accented characters.',
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖabcdefghijklmnopqrstuvwxyzåäö0123456789 .,:;!?\'"-_()=+/*\\|~`@#$%^&!¡¢£¤¥§©«®±µ¶·»¿ÀÁÂÃÈÉÊËÌÍ',
  },
  {
    id: 'blurhash_base83',
    name: 'BlurHash / RFC Base83 (83 Chars)',
    category: 'base83',
    description: 'Standard 83-symbol alphabet used in Base83 encoding (0-9, A-Z, a-z, and 21 symbols).',
    characters: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-:;=?@[]^_{|}~',
  },
  {
    id: 'english_frequency_83',
    name: 'English ETAOIN Frequency Ranked (83 Chars)',
    category: 'frequency',
    description: 'Ranked by standard English letter frequency: top trigrams map to common vowels and consonants.',
    characters: 'ETAOINSHRDLCUMWFGYPBVKJXQZetaoinshrdlcumwfgypbvkjxqz0123456789 .,:;!?\'"-_()[]{}<>=',
  },
  {
    id: 'finnish_frequency_83',
    name: 'Finnish AITESN Frequency Ranked (83 Chars)',
    category: 'frequency',
    description: 'Ranked by standard Finnish letter frequency (A, I, T, E, S, N, L, K, O, U, Ä...).',
    characters: 'AITESNLKOUÄMVRJHYPDÖGBFCWÅZQXaitesnlkouämvrjhypdögbfcwåzqx0123456789 .,:;!?\'"-_()=',
  },
];

export interface DecodedItem {
  index: number;
  messageIndex: number;
  trigramDecimal: number;
  quinaryCode: string;
  rawValues: [number, number, number];
  char: string;
  eyeIds: [string, string, string];
  isHeaderPreamble: boolean;
  isSharedPrefix: boolean;
  isInverted?: boolean;
}

export interface DecodedMessageResult {
  messageIndex: number;
  items: DecodedItem[];
  rawDecimals: number[];
  text: string;
  totalTrigrams: number;
  firstTrigramHeader: number;
  hasStandardPreamble: boolean;
}

export interface DecoderSettings {
  alphabetId: string;
  customAlphabet: string;
  caesarShift: number; // 0..alphaLen - 1
  affineMultiplier: number; // 1..alphaLen
  reverseMapping: boolean;
  wrapModulo: boolean;
  caseSensitive: boolean;
  eyeInversion: EyeInversionSettings;
}

export const DEFAULT_DECODER_SETTINGS: DecoderSettings = {
  alphabetId: 'ascii_32_114',
  customAlphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?\'"-_()[]{}<>=',
  caesarShift: 0,
  affineMultiplier: 1,
  reverseMapping: false,
  wrapModulo: true,
  caseSensitive: true,
  eyeInversion: DEFAULT_EYE_INVERSION,
};

// Word lists for testing
export const COMMON_ENGLISH_WORDS = [
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'ANY', 'CAN',
  'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM',
  'HIS', 'HOW', 'MAN', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO',
  'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'THAT',
  'WITH', 'HAVE', 'THIS', 'WILL', 'YOUR', 'FROM', 'THEY', 'KNOW', 'WANT',
  'BEEN', 'GOOD', 'MUCH', 'SOME', 'TIME', 'EYES', 'NOITA', 'CAVE', 'MINE',
  'GOLD', 'WAND', 'SPELL', 'WATER', 'FIRE', 'ACID', 'BLOOD', 'SECRET',
  'PORTAL', 'LIGHT', 'DARK', 'TREE', 'ORB', 'TEMPLE', 'HOLY', 'MOUNTAIN'
];

export const COMMON_FINNISH_WORDS = [
  'ETTÄ', 'JOKA', 'KUN', 'KUIN', 'MUTTA', 'KAIKKI', 'MYÖS', 'TÄMÄ', 'VAIN',
  'HEIDÄN', 'OLUT', 'TULI', 'VESI', 'KULTA', 'NOITA', 'KIVI', 'METSÄ',
  'SALAINEN', 'TAIKA', 'SILMÄ', 'KIRJA', 'PORTTI', 'HÄNEN', 'MINUN', 'SINUN',
  'SIINÄ', 'MISSÄ', 'JOTKA', 'TIETO', 'VOIMA', 'VALO', 'PIMEÄ', 'MAA',
  'ILMA', 'LUMI', 'VUORI', 'PYHÄ', 'SYVÄ'
];

// Extract decimals for any reading order pattern, eye inversion, and step mode
export function extractDecimalsForDecoder(
  pattern: SixEyePattern = INVERTED_RETURN_PATTERN,
  inversion: EyeInversionSettings = DEFAULT_EYE_INVERSION,
  stepMode: 'non_overlapping' | 'overlapping' = 'non_overlapping',
  eyes: EyeGlyph[] = ALL_EYES
): Record<number, { decimals: number[]; items: Omit<DecodedItem, 'char'>[] }> {
  const msgEyes = extractAllMessagesWithPattern(pattern, 'all', eyes, inversion);
  const result: Record<number, { decimals: number[]; items: Omit<DecodedItem, 'char'>[] }> = {};
  const step = stepMode === 'non_overlapping' ? 3 : 1;

  for (let mIdx = 1; mIdx <= 9; mIdx++) {
    const ordered = msgEyes[mIdx] || [];
    const decimals: number[] = [];
    const items: Omit<DecodedItem, 'char'>[] = [];

    for (let i = 0; i <= ordered.length - 3; i += step) {
      const trio = [ordered[i], ordered[i + 1], ordered[i + 2]] as const;
      const dec = trio[0].val * 25 + trio[1].val * 5 + trio[2].val;
      const quinaryCode = `${trio[0].val}${trio[1].val}${trio[2].val}`;
      const trigramIdx = Math.floor(i / step);

      const isReturnTrigram = (i % 6) === 3;
      const isInverted =
        inversion.mode === 'all' || (inversion.mode === 'return_only' && isReturnTrigram);

      const isHeaderPreamble = trigramIdx === 1 || trigramIdx === 2; // [66, 5]
      const isSharedPrefix =
        (mIdx <= 3 && trigramIdx >= 1 && trigramIdx <= 24) ||
        (mIdx >= 7 && trigramIdx >= 1 && trigramIdx <= 20);

      decimals.push(dec);
      items.push({
        index: trigramIdx,
        messageIndex: mIdx,
        trigramDecimal: dec,
        quinaryCode,
        rawValues: [trio[0].val, trio[1].val, trio[2].val],
        eyeIds: [trio[0].id, trio[1].id, trio[2].id],
        isHeaderPreamble,
        isSharedPrefix,
        isInverted,
      });
    }

    result[mIdx] = { decimals, items };
  }

  return result;
}

// Backward-compatible alias
export function extractInvertedReturnDecimals(
  eyes: EyeGlyph[] = ALL_EYES,
  inversion: EyeInversionSettings = DEFAULT_EYE_INVERSION,
  stepMode: 'non_overlapping' | 'overlapping' = 'non_overlapping'
) {
  return extractDecimalsForDecoder(INVERTED_RETURN_PATTERN, inversion, stepMode, eyes);
}

// Get the resolved alphabet string (guaranteed length >= 83 or whatever is specified)
export function getAlphabetString(settings: DecoderSettings): string {
  if (settings.alphabetId === 'custom') {
    const raw = settings.customAlphabet || '';
    if (raw.length >= 1) return raw;
    return '?'.repeat(83);
  }
  const found = CANDIDATE_ALPHABETS.find((a) => a.id === settings.alphabetId);
  return found ? found.characters : CANDIDATE_ALPHABETS[0].characters;
}

// Map a single decimal (0..124) through the decoder pipeline
export function decodeDecimal(decimal: number, settings: DecoderSettings, alphabet: string): string {
  if (decimal < 0) return '?';
  const alphaLen = alphabet.length;
  if (alphaLen === 0) return '?';

  let val = decimal;
  if (val >= alphaLen) {
    if (settings.wrapModulo) {
      val = val % alphaLen;
    } else {
      return '?';
    }
  }

  if (settings.reverseMapping) {
    val = alphaLen - 1 - val;
  }

  // Affine transform: (a * val + b) mod alphaLen
  const a = settings.affineMultiplier || 1;
  const b = settings.caesarShift || 0;
  val = (a * val + b) % alphaLen;
  if (val < 0) val += alphaLen;

  return alphabet[val] ?? '?';
}

// Decode all messages with current settings
export function decodeAllMessages(
  settings: DecoderSettings,
  corpusData = extractInvertedReturnDecimals()
): Record<number, DecodedMessageResult> {
  const alphabet = getAlphabetString(settings);
  const results: Record<number, DecodedMessageResult> = {};

  for (let mIdx = 1; mIdx <= 9; mIdx++) {
    const msgData = corpusData[mIdx];
    if (!msgData) continue;

    const items: DecodedItem[] = msgData.items.map((item) => ({
      ...item,
      char: decodeDecimal(item.trigramDecimal, settings, alphabet),
    }));

    const text = items.map((it) => it.char).join('');
    const firstTrigramHeader = items[0]?.trigramDecimal ?? -1;
    const hasStandardPreamble = items.length > 2 && items[1].trigramDecimal === 66 && items[2].trigramDecimal === 5;

    results[mIdx] = {
      messageIndex: mIdx,
      items,
      rawDecimals: msgData.decimals,
      text,
      totalTrigrams: items.length,
      firstTrigramHeader,
      hasStandardPreamble,
    };
  }

  return results;
}

// Dictionary scan result
export interface DictionaryMatch {
  word: string;
  language: 'English' | 'Finnish';
  messageIndex: number;
  position: number;
}

export function scanForDictionaryWords(
  decodedMessages: Record<number, DecodedMessageResult>
): { matches: DictionaryMatch[]; totalMatches: number } {
  const matches: DictionaryMatch[] = [];

  for (let mIdx = 1; mIdx <= 9; mIdx++) {
    const msg = decodedMessages[mIdx];
    if (!msg) continue;
    const upperText = msg.text.toUpperCase();

    for (const w of COMMON_ENGLISH_WORDS) {
      if (w.length < 3) continue;
      let pos = 0;
      while ((pos = upperText.indexOf(w, pos)) !== -1) {
        matches.push({ word: w, language: 'English', messageIndex: mIdx, position: pos });
        pos += 1;
      }
    }

    for (const w of COMMON_FINNISH_WORDS) {
      if (w.length < 3) continue;
      let pos = 0;
      while ((pos = upperText.indexOf(w, pos)) !== -1) {
        matches.push({ word: w, language: 'Finnish', messageIndex: mIdx, position: pos });
        pos += 1;
      }
    }
  }

  return { matches, totalMatches: matches.length };
}

// Compute frequency statistics for the active value domain (83 or 125)
export interface ValueFrequency {
  val: number;
  quinary: string;
  count: number;
  pct: number;
  char: string;
}

export function computeCorpusFrequencies(
  settings: DecoderSettings,
  corpusData: Record<number, { decimals: number[]; items: Omit<DecodedItem, 'char'>[] }> = extractInvertedReturnDecimals()
): {
  frequencies: ValueFrequency[];
  totalCount: number;
  uniqueCount: number;
  missingCount: number;
  entropy: number;
  ic: number;
  minCount: number;
  maxCount: number;
  maxValObserved: number;
  domainSize: number;
} {
  const alphabet = getAlphabetString(settings);
  let maxValObserved = 0;
  for (let m = 1; m <= 9; m++) {
    const decs = corpusData[m]?.decimals || [];
    for (const d of decs) {
      if (d > maxValObserved) maxValObserved = d;
    }
  }

  // Size domain to 83 if <= 82, or 125 if higher
  const domainSize = Math.max(maxValObserved + 1, 83);
  const counts = new Array<number>(domainSize).fill(0);
  let totalCount = 0;

  for (let m = 1; m <= 9; m++) {
    const decs = corpusData[m]?.decimals || [];
    for (const d of decs) {
      if (d >= 0 && d < domainSize) {
        counts[d]++;
        totalCount++;
      }
    }
  }

  // Shannon entropy & Index of coincidence
  let entropy = 0;
  let sumCoinc = 0;
  let uniqueCount = 0;
  let missingCount = 0;

  for (const c of counts) {
    if (c > 0) {
      uniqueCount++;
      const p = c / totalCount;
      entropy -= p * Math.log2(p);
      sumCoinc += c * (c - 1);
    } else {
      missingCount++;
    }
  }
  const ic = totalCount > 1 ? sumCoinc / (totalCount * (totalCount - 1)) : 0;

  const frequencies: ValueFrequency[] = counts.map((count, val) => {
    const d0 = Math.floor(val / 25);
    const d1 = Math.floor((val % 25) / 5);
    const d2 = val % 5;
    return {
      val,
      quinary: `${d0}${d1}${d2}`,
      count,
      pct: totalCount > 0 ? (count / totalCount) * 100 : 0,
      char: decodeDecimal(val, settings, alphabet),
    };
  });

  const activeCounts = counts.filter((c) => c > 0);
  return {
    frequencies,
    totalCount,
    uniqueCount,
    missingCount,
    entropy,
    ic,
    minCount: activeCounts.length > 0 ? Math.min(...activeCounts) : 0,
    maxCount: Math.max(...counts, 0),
    maxValObserved,
    domainSize,
  };
}
