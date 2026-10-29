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

export type DeltaOperation =
  | 'sub_mod'      // (a - b) mod M
  | 'add_mod'      // (a + b) mod M
  | 'abs_diff'     // |a - b|
  | 'signed_diff'  // a - b
  | 'xor';         // a ^ b

export interface SymmetricPairInfo {
  id: string;
  msgA: number;
  msgB: number;
  label: string;
  description: string;
}

export const SYMMETRIC_PAIRS: SymmetricPairInfo[] = [
  { id: '1-9', msgA: 1, msgB: 9, label: 'Pair 1 & 9', description: 'Outer symmetric pair (East 1 vs East 5)' },
  { id: '2-8', msgA: 2, msgB: 8, label: 'Pair 2 & 8', description: 'Secondary pair (West 1 vs West 4)' },
  { id: '3-7', msgA: 3, msgB: 7, label: 'Pair 3 & 7', description: 'Tertiary pair (East 2 vs East 4)' },
  { id: '4-6', msgA: 4, msgB: 6, label: 'Pair 4 & 6', description: 'Inner pair (West 2 vs West 3)' },
  { id: '5-5', msgA: 5, msgB: 5, label: 'Pivot 5 (Self)', description: 'Center pivot message (East 3)' },
];

export const ADJACENT_PAIRS: SymmetricPairInfo[] = [
  { id: '1-2', msgA: 1, msgB: 2, label: 'Pair 1 & 2', description: 'Level 1 pair (East 1 & West 1)' },
  { id: '3-4', msgA: 3, msgB: 4, label: 'Pair 3 & 4', description: 'Level 2 pair (East 2 & West 2)' },
  { id: '5-6', msgA: 5, msgB: 6, label: 'Pair 5 & 6', description: 'Level 3 pair (East 3 & West 3)' },
  { id: '7-8', msgA: 7, msgB: 8, label: 'Pair 7 & 8', description: 'Level 4 pair (East 4 & West 4)' },
];

export interface DeltaItem {
  index: number;
  valA: number;
  valB: number;
  delta: number;
  isMatch: boolean;
}

export interface DeltaAnalysisResult {
  msgA: number;
  msgB: number;
  streamType: 'trigram_decimals' | 'raw_digits';
  operation: DeltaOperation;
  modulo: number;
  lag: number;
  reverseB: boolean;
  lengthA: number;
  lengthB: number;
  overlapLength: number;
  items: DeltaItem[];
  exactMatches: number;
  matchPct: number;
  longestMatchStreak: number;
  longestConstantDeltaStreak: number;
  frequencies: number[];
  percentages: number[];
  entropy: number;
  indexOfCoincidence: number;
  uniformIC: number;
  icRatio: number;
  chiSquare: number;
}

// Extract streams for delta analysis
export function getMessageStreams(
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

// Compute pairwise comparison between two message streams
export function analyzeMessageDeltas(
  streamA: number[],
  streamB: number[],
  msgA: number,
  msgB: number,
  operation: DeltaOperation,
  modulo: number,
  lag = 0,
  reverseB = false,
  streamType: 'trigram_decimals' | 'raw_digits' = 'raw_digits'
): DeltaAnalysisResult {
  const M = Math.max(2, modulo);
  const arrB = reverseB ? [...streamB].reverse() : streamB;

  // Compute aligned slice based on lag
  // If lag > 0, compare streamA[i + lag] with arrB[i]
  // If lag < 0, compare streamA[i] with arrB[i - lag]
  const startA = lag > 0 ? lag : 0;
  const startB = lag < 0 ? -lag : 0;
  const maxOverlap = Math.min(streamA.length - startA, arrB.length - startB);
  const N = Math.max(0, maxOverlap);

  const items: DeltaItem[] = [];
  const freqs = new Array(M).fill(0);
  let exactMatches = 0;
  let curMatchStreak = 0;
  let maxMatchStreak = 0;
  let curDeltaStreak = 0;
  let maxDeltaStreak = 0;
  let prevDelta = -9999;

  for (let i = 0; i < N; i++) {
    const idxA = startA + i;
    const idxB = startB + i;
    const a = streamA[idxA];
    const b = arrB[idxB];

    let d = 0;
    switch (operation) {
      case 'sub_mod': {
        let diff = (a - b) % M;
        if (diff < 0) diff += M;
        d = diff;
        break;
      }
      case 'add_mod': {
        d = (a + b) % M;
        break;
      }
      case 'abs_diff': {
        d = Math.abs(a - b) % M;
        break;
      }
      case 'signed_diff': {
        d = a - b;
        break;
      }
      case 'xor': {
        d = (a ^ b) % M;
        break;
      }
    }

    const isMatch = a === b;
    if (isMatch) {
      exactMatches++;
      curMatchStreak++;
      if (curMatchStreak > maxMatchStreak) maxMatchStreak = curMatchStreak;
    } else {
      curMatchStreak = 0;
    }

    // Delta streak
    if (d === prevDelta) {
      curDeltaStreak++;
      if (curDeltaStreak > maxDeltaStreak) maxDeltaStreak = curDeltaStreak;
    } else {
      curDeltaStreak = 1;
      prevDelta = d;
    }

    // Tally frequency for modulo domain (0..M-1)
    if (d >= 0 && d < M) {
      freqs[d]++;
    }

    items.push({
      index: i,
      valA: a,
      valB: b,
      delta: d,
      isMatch,
    });
  }

  // Statistics
  let entropy = 0;
  let sumPairs = 0;
  const expectedPerBin = N > 0 ? N / M : 0;
  let chiSquare = 0;

  for (let v = 0; v < M; v++) {
    const count = freqs[v];
    if (count > 0 && N > 0) {
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
  const matchPct = N > 0 ? (exactMatches / N) * 100 : 0;
  const ic = N > 1 ? sumPairs / (N * (N - 1)) : 0;
  const uniformIC = 1 / M;
  const icRatio = uniformIC > 0 ? ic / uniformIC : 1;

  return {
    msgA,
    msgB,
    streamType,
    operation,
    modulo: M,
    lag,
    reverseB,
    lengthA: streamA.length,
    lengthB: streamB.length,
    overlapLength: N,
    items,
    exactMatches,
    matchPct,
    longestMatchStreak: maxMatchStreak,
    longestConstantDeltaStreak: maxDeltaStreak,
    frequencies: freqs,
    percentages: pcts,
    entropy,
    indexOfCoincidence: ic,
    uniformIC,
    icRatio,
    chiSquare,
  };
}

// 9x9 Pairwise Matrix cell result
export interface PairwiseMatrixCell {
  msgA: number;
  msgB: number;
  matchPct: number;
  exactMatches: number;
  overlapLength: number;
  ic: number;
  entropy: number;
  longestStreak: number;
  isSymmetricPair: boolean;
  isAdjacentPair: boolean;
}

// Compute the complete 9x9 Pairwise Correlation Matrix
export function compute9x9PairwiseMatrix(
  streams: Record<number, number[]>,
  operation: DeltaOperation,
  modulo: number,
  reverseB = false,
  streamType: 'trigram_decimals' | 'raw_digits' = 'raw_digits'
): PairwiseMatrixCell[][] {
  const matrix: PairwiseMatrixCell[][] = [];

  for (let a = 1; a <= 9; a++) {
    const row: PairwiseMatrixCell[] = [];
    const sA = streams[a] || [];

    for (let b = 1; b <= 9; b++) {
      const sB = streams[b] || [];
      const res = analyzeMessageDeltas(sA, sB, a, b, operation, modulo, 0, reverseB, streamType);

      const isSymmetricPair = a + b === 10;
      const isAdjacentPair =
        (a % 2 === 1 && b === a + 1) || (b % 2 === 1 && a === b + 1);

      row.push({
        msgA: a,
        msgB: b,
        matchPct: res.matchPct,
        exactMatches: res.exactMatches,
        overlapLength: res.overlapLength,
        ic: res.indexOfCoincidence,
        entropy: res.entropy,
        longestStreak: res.longestMatchStreak,
        isSymmetricPair,
        isAdjacentPair,
      });
    }
    matrix.push(row);
  }

  return matrix;
}

// Lag Cross-Correlation item
export interface LagScanItem {
  lag: number;
  matchPct: number;
  exactMatches: number;
  overlapLength: number;
  ic: number;
  entropy: number;
}

// Scan across offsets (lags -maxLag to +maxLag) to find peak alignment
export function scanLagCorrelation(
  streamA: number[],
  streamB: number[],
  operation: DeltaOperation,
  modulo: number,
  reverseB = false,
  maxLag = 25
): LagScanItem[] {
  const items: LagScanItem[] = [];

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const res = analyzeMessageDeltas(streamA, streamB, 1, 2, operation, modulo, lag, reverseB);
    items.push({
      lag,
      matchPct: res.matchPct,
      exactMatches: res.exactMatches,
      overlapLength: res.overlapLength,
      ic: res.indexOfCoincidence,
      entropy: res.entropy,
    });
  }

  return items;
}

// Map delta numbers to characters using an alphabet
export function decodeDeltasToText(
  deltas: number[],
  alphabet: string
): string {
  const len = alphabet.length;
  if (len === 0) return '';
  return deltas.map((d) => (d >= 0 && d < len ? alphabet[d] : '?')).join('');
}

// Search text for occurrences of common English dictionary words
export function scanDeltaTextForWords(
  text: string,
  minWordLength = 3
): { word: string; start: number; end: number }[] {
  const upper = text.toUpperCase();
  const matches: { word: string; start: number; end: number }[] = [];

  for (const word of COMMON_ENGLISH_WORDS) {
    if (word.length < minWordLength) continue;
    let pos = 0;
    while ((pos = upper.indexOf(word, pos)) !== -1) {
      matches.push({ word, start: pos, end: pos + word.length });
      pos += 1;
    }
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}
