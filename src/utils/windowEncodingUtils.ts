import type { EyeGlyph, EyeInversionSettings } from '../types/eye';
import { ALL_EYES } from '../data/allEyes';
import {
  extractMessageEyesWithPattern,
  type SixEyePattern,
} from './orientationExtractor';
import {
  extractDecimalsForDecoder,
  COMMON_ENGLISH_WORDS,
} from './decoderUtils';

export type WindowMode =
  | 'cumulative'
  | 'sliding_sum'
  | 'sliding_weighted'
  | 'delta'
  | 'autoregressive'
  | 'alternating_sum'
  | 'direct';

export interface WindowEncodingSettings {
  streamType: 'trigram_decimals' | 'raw_digits';
  windowMode: WindowMode;
  modulo: number;
  windowSize: number;
  weightType: 'uniform' | 'linear' | 'fibonacci' | 'base5';
  decayFactor: number;
  offset: number;
  resetPerMessage: boolean;
  scope: 'all' | number;
}

export const DEFAULT_WINDOW_SETTINGS: WindowEncodingSettings = {
  streamType: 'trigram_decimals',
  windowMode: 'cumulative',
  modulo: 26,
  windowSize: 3,
  weightType: 'uniform',
  decayFactor: 1,
  offset: 0,
  resetPerMessage: true,
  scope: 'all',
};

// Common modulo presets with contextual notes
export interface ModuloPreset {
  modulo: number;
  label: string;
  description: string;
}

export const MODULO_PRESETS: ModuloPreset[] = [
  { modulo: 5, label: 'Mod 5', description: 'Base-5 quinary digits (direct eye gaze range 0..4)' },
  { modulo: 26, label: 'Mod 26', description: 'Standard English alphabet (A-Z)' },
  { modulo: 27, label: 'Mod 27', description: 'English alphabet (A-Z) + Space delimiter' },
  { modulo: 29, label: 'Mod 29', description: 'English alphabet + Space + Period + Comma' },
  { modulo: 36, label: 'Mod 36', description: 'Alphanumeric range (A-Z, 0-9)' },
  { modulo: 40, label: 'Mod 40', description: 'Eye grid width factor' },
  { modulo: 83, label: 'Mod 83', description: 'Inverted Return observed domain size (0..82)' },
  { modulo: 125, label: 'Mod 125', description: 'Full 3-eye quinary permutation space (5^3)' },
];

// Pre-defined alphabets for mapping
export interface AlphabetChoice {
  id: string;
  name: string;
  characters: string;
}

export const ALPHABET_CHOICES: AlphabetChoice[] = [
  {
    id: 'english_26',
    name: 'English Letters (A-Z, 26)',
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  },
  {
    id: 'english_space_27',
    name: 'English Letters + Space (27)',
    characters: ' ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  },
  {
    id: 'english_punct_29',
    name: 'Letters + Space + Period + Comma (29)',
    characters: ' ABCDEFGHIJKLMNOPQRSTUVWXYZ.,',
  },
  {
    id: 'alphanumeric_36',
    name: 'Alphanumeric (A-Z, 0-9, 36)',
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  },
  {
    id: 'printable_ascii',
    name: 'Printable ASCII (Space to ~, 95)',
    characters: Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join(''),
  },
  {
    id: 'lowercase_26',
    name: 'Lowercase Letters (a-z, 26)',
    characters: 'abcdefghijklmnopqrstuvwxyz',
  },
];

// Standard English letter frequency ranking
export const ENGLISH_FREQ_ORDER = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';
export const ENGLISH_FREQ_WITH_SPACE = ' ETAOINSHRDLCUMWFGYPBVKJXQZ';

// Extract raw numbers from eyes based on pattern & settings
export function extractInputStreams(
  pattern: SixEyePattern,
  inversion: EyeInversionSettings,
  stepMode: 'non_overlapping' | 'overlapping',
  streamType: 'trigram_decimals' | 'raw_digits',
  eyes: EyeGlyph[] = ALL_EYES
): Record<number, number[]> {
  const result: Record<number, number[]> = {};

  if (streamType === 'trigram_decimals') {
    const extracted = extractDecimalsForDecoder(pattern, inversion, stepMode, eyes);
    for (let mIdx = 1; mIdx <= 9; mIdx++) {
      result[mIdx] = extracted[mIdx]?.decimals || [];
    }
  } else {
    for (let mIdx = 1; mIdx <= 9; mIdx++) {
      const msgEyes = extractMessageEyesWithPattern(mIdx, pattern, eyes, inversion);
      result[mIdx] = msgEyes.map((e) => e.val);
    }
  }

  return result;
}

// Generate weights for sliding weighted window
export function getWindowWeights(
  size: number,
  type: 'uniform' | 'linear' | 'fibonacci' | 'base5'
): number[] {
  if (type === 'linear') {
    return Array.from({ length: size }, (_, i) => i + 1);
  }
  if (type === 'base5') {
    return Array.from({ length: size }, (_, i) => Math.pow(5, i));
  }
  if (type === 'fibonacci') {
    const fib = [1, 1];
    while (fib.length < size) {
      fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
    }
    return fib.slice(0, size);
  }
  return Array.from({ length: size }, () => 1);
}

// Transform a numeric array with windowing and modulo
export function applyWindowEncoding(
  inputNumbers: number[],
  settings: WindowEncodingSettings,
  initialCarry = 0
): { outputNumbers: number[]; finalCarry: number } {
  const { windowMode, modulo, windowSize, weightType, decayFactor, offset } = settings;
  const M = Math.max(2, modulo);
  const n = inputNumbers.length;
  if (n === 0) return { outputNumbers: [], finalCarry: 0 };

  const output: number[] = new Array(n);
  let carry = initialCarry;
  const weights = getWindowWeights(windowSize, weightType);

  for (let i = 0; i < n; i++) {
    const x = inputNumbers[i];
    let y = 0;

    switch (windowMode) {
      case 'cumulative': {
        carry = (carry + x) % M;
        y = (carry + offset) % M;
        break;
      }
      case 'sliding_sum': {
        let sum = 0;
        const start = Math.max(0, i - windowSize + 1);
        for (let k = start; k <= i; k++) {
          sum += inputNumbers[k];
        }
        y = (sum + offset) % M;
        break;
      }
      case 'sliding_weighted': {
        let sum = 0;
        for (let k = 0; k < windowSize; k++) {
          const idx = i - k;
          if (idx >= 0) {
            sum += inputNumbers[idx] * weights[k];
          }
        }
        y = (sum + offset) % M;
        break;
      }
      case 'delta': {
        const prev = i > 0 ? inputNumbers[i - 1] : 0;
        let diff = (x - prev) % M;
        if (diff < 0) diff += M;
        y = (diff + offset) % M;
        break;
      }
      case 'autoregressive': {
        const a = Math.max(1, decayFactor % M);
        carry = (a * carry + x) % M;
        y = (carry + offset) % M;
        break;
      }
      case 'alternating_sum': {
        const sign = i % 2 === 0 ? 1 : -1;
        let next = (carry + sign * x) % M;
        if (next < 0) next += M;
        carry = next;
        y = (carry + offset) % M;
        break;
      }
      case 'direct':
      default: {
        y = (x + offset) % M;
        break;
      }
    }

    if (y < 0) y = (y % M) + M;
    output[i] = y;
  }

  return { outputNumbers: output, finalCarry: carry };
}

// Compute frequency, entropy, and IC statistics for an array of numbers mod M
export interface DistributionStats {
  modulo: number;
  totalTokens: number;
  frequencies: number[];
  percentages: number[];
  activeBins: number;
  peakVal: number;
  peakCount: number;
  peakPct: number;
  shannonEntropy: number;
  maxEntropy: number;
  entropyRatio: number;
  indexOfCoincidence: number;
  uniformIC: number;
  icRatio: number;
  chiSquare: number;
  interestingnessScore: number;
}

export function computeDistributionStats(
  outputNumbers: number[],
  modulo: number
): DistributionStats {
  const M = Math.max(2, modulo);
  const N = outputNumbers.length;
  const freqs = new Array(M).fill(0);

  for (let i = 0; i < N; i++) {
    const val = outputNumbers[i];
    if (val >= 0 && val < M) {
      freqs[val]++;
    }
  }

  let activeBins = 0;
  let peakVal = 0;
  let peakCount = 0;
  let entropy = 0;
  let sumPairs = 0;
  const expectedPerBin = N > 0 ? N / M : 0;
  let chiSquare = 0;

  for (let v = 0; v < M; v++) {
    const count = freqs[v];
    if (count > 0) {
      activeBins++;
      if (count > peakCount) {
        peakCount = count;
        peakVal = v;
      }
      const p = count / N;
      entropy -= p * Math.log2(p);
      sumPairs += count * (count - 1);
    }
    if (expectedPerBin > 0) {
      const diff = count - expectedPerBin;
      chiSquare += (diff * diff) / expectedPerBin;
    }
  }

  const pcts = freqs.map((f) => (N > 0 ? (f / N) * 100 : 0));
  const peakPct = N > 0 ? (peakCount / N) * 100 : 0;
  const maxEntropy = Math.log2(M);
  const entropyRatio = maxEntropy > 0 ? entropy / maxEntropy : 1;
  const ic = N > 1 ? sumPairs / (N * (N - 1)) : 0;
  const uniformIC = 1 / M;
  const icRatio = uniformIC > 0 ? ic / uniformIC : 1;

  // Composite interestingness score: higher means peaked, structured, non-uniform
  // IC ratio contributes, deviation from uniform peak contributes, reduced chi-square contributes
  const df = Math.max(1, M - 1);
  const reducedChi = chiSquare / df;
  const peakDeviation = Math.max(0, peakPct - (100 / M));
  const interestingnessScore = Math.max(
    0,
    (icRatio - 1) * 35 + peakDeviation * 1.5 + (reducedChi - 1) * 4
  );

  return {
    modulo: M,
    totalTokens: N,
    frequencies: freqs,
    percentages: pcts,
    activeBins,
    peakVal,
    peakCount,
    peakPct,
    shannonEntropy: entropy,
    maxEntropy,
    entropyRatio,
    indexOfCoincidence: ic,
    uniformIC,
    icRatio,
    chiSquare,
    interestingnessScore,
  };
}

// Modulo sweep result item
export interface ModuloSweepItem {
  modulo: number;
  activeBins: number;
  peakVal: number;
  peakPct: number;
  entropy: number;
  entropyPct: number;
  ic: number;
  icRatio: number;
  chiSquare: number;
  score: number;
}

// Run a fast sweep over moduli minModulo .. maxModulo
export function runModuloSweep(
  inputStreams: Record<number, number[]>,
  settings: WindowEncodingSettings,
  minModulo = 2,
  maxModulo = 83
): ModuloSweepItem[] {
  const items: ModuloSweepItem[] = [];

  for (let m = minModulo; m <= maxModulo; m++) {
    const sweepSettings: WindowEncodingSettings = {
      ...settings,
      modulo: m,
    };

    // Concatenate or process streams based on settings
    let allOutputs: number[] = [];
    if (settings.scope === 'all') {
      let carry = 0;
      for (let mIdx = 1; mIdx <= 9; mIdx++) {
        const input = inputStreams[mIdx] || [];
        const init = settings.resetPerMessage ? 0 : carry;
        const res = applyWindowEncoding(input, sweepSettings, init);
        allOutputs = allOutputs.concat(res.outputNumbers);
        carry = res.finalCarry;
      }
    } else {
      const input = inputStreams[settings.scope as number] || [];
      const res = applyWindowEncoding(input, sweepSettings, 0);
      allOutputs = res.outputNumbers;
    }

    const stats = computeDistributionStats(allOutputs, m);
    items.push({
      modulo: m,
      activeBins: stats.activeBins,
      peakVal: stats.peakVal,
      peakPct: stats.peakPct,
      entropy: stats.shannonEntropy,
      entropyPct: stats.entropyRatio * 100,
      ic: stats.indexOfCoincidence,
      icRatio: stats.icRatio,
      chiSquare: stats.chiSquare,
      score: stats.interestingnessScore,
    });
  }

  return items;
}

// Generate an identity mapping (0 -> A, 1 -> B, ...)
export function generateIdentityMapping(
  modulo: number,
  alphabet: string
): Record<number, string> {
  const mapping: Record<number, string> = {};
  const len = alphabet.length;
  for (let i = 0; i < modulo; i++) {
    mapping[i] = len > 0 ? alphabet[i % len] : '?';
  }
  return mapping;
}

// Generate frequency-ranked mapping: highest frequency bin maps to 'E', 2nd to 'T', etc.
export function generateFrequencyMapping(
  stats: DistributionStats,
  alphabet: string,
  preferSpaceFirst = false
): Record<number, string> {
  const { modulo, frequencies } = stats;
  const mapping: Record<number, string> = {};

  // Sort bin indices descending by frequency
  const sortedBins = Array.from({ length: modulo }, (_, i) => i).sort(
    (a, b) => frequencies[b] - frequencies[a]
  );

  let targetLetters = alphabet;
  if (alphabet.length === 26 || alphabet.length === 27) {
    targetLetters = preferSpaceFirst && alphabet.length === 27
      ? ENGLISH_FREQ_WITH_SPACE
      : ENGLISH_FREQ_ORDER;
  }

  const alphaLen = targetLetters.length;
  for (let rank = 0; rank < modulo; rank++) {
    const bin = sortedBins[rank];
    mapping[bin] = alphaLen > 0 ? targetLetters[rank % alphaLen] : '?';
  }

  return mapping;
}

// Generate a random shuffled mapping
export function generateRandomMapping(
  modulo: number,
  alphabet: string
): Record<number, string> {
  const mapping: Record<number, string> = {};
  const chars = alphabet.split('');
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  for (let i = 0; i < modulo; i++) {
    mapping[i] = chars[i % chars.length] || '?';
  }
  return mapping;
}

// Shift all mapped letters by +shift or -shift
export function generateShiftMapping(
  currentMapping: Record<number, string>,
  modulo: number,
  shift: number,
  alphabet: string
): Record<number, string> {
  const next: Record<number, string> = {};
  const alphaLen = alphabet.length;
  if (alphaLen === 0) return currentMapping;

  for (let i = 0; i < modulo; i++) {
    const char = currentMapping[i] || '?';
    const pos = alphabet.indexOf(char);
    if (pos >= 0) {
      let newPos = (pos + shift) % alphaLen;
      if (newPos < 0) newPos += alphaLen;
      next[i] = alphabet[newPos];
    } else {
      next[i] = char;
    }
  }
  return next;
}

// Decode numeric stream through mapping
export function decodeStreamToText(
  numbers: number[],
  mapping: Record<number, string>
): string {
  return numbers.map((n) => mapping[n] || '?').join('');
}

// Word scan match result
export interface TextWordMatch {
  word: string;
  start: number;
  end: number;
}

// Scan string for occurrences of common dictionary words
export function scanTextForWords(
  text: string,
  minWordLength = 3
): { matches: TextWordMatch[]; totalWords: number } {
  const upper = text.toUpperCase();
  const matches: TextWordMatch[] = [];
  const foundWords = new Set<string>();

  for (const word of COMMON_ENGLISH_WORDS) {
    if (word.length < minWordLength) continue;
    let pos = 0;
    while ((pos = upper.indexOf(word, pos)) !== -1) {
      matches.push({
        word,
        start: pos,
        end: pos + word.length,
      });
      foundWords.add(word);
      pos += 1;
    }
  }

  // Sort matches by start index
  matches.sort((a, b) => a.start - b.start);
  return { matches, totalWords: foundWords.size };
}
