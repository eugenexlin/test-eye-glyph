import React, { useState, useMemo, useCallback } from 'react';
import styles from './ScrollingWindowPage.module.css';
import {
  DEFAULT_WINDOW_SETTINGS,
  MODULO_PRESETS,
  ALPHABET_CHOICES,
  extractInputStreams,
  applyWindowEncoding,
  computeDistributionStats,
  runModuloSweep,
  generateIdentityMapping,
  generateFrequencyMapping,
  generateRandomMapping,
  generateShiftMapping,
  decodeStreamToText,
  scanTextForWords,
  type WindowEncodingSettings,
  type TextWordMatch,
} from '../utils/windowEncodingUtils';
import {
  PRESET_ORIENTATIONS,
  type SixEyePattern,
  type EyeInversionSettings,
} from '../utils/orientationExtractor';
import { MiniArrowShape } from './MiniArrowShape';

interface ScrollingWindowPageProps {
  pattern: SixEyePattern;
  onChangePattern: (pattern: SixEyePattern) => void;
  eyeInversion: EyeInversionSettings;
  onChangeEyeInversion: (inversion: EyeInversionSettings) => void;
  stepMode: 'non_overlapping' | 'overlapping';
  onChangeStepMode: (mode: 'non_overlapping' | 'overlapping') => void;
}

const renderHighlightedText = (text: string, matches: TextWordMatch[]) => {
  if (matches.length === 0) return text;

  // Filter non-overlapping intervals
  const intervals = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const nonOverlapping: TextWordMatch[] = [];
  let curEnd = -1;

  for (const inv of intervals) {
    if (inv.start >= curEnd) {
      nonOverlapping.push(inv);
      curEnd = inv.end;
    }
  }

  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;

  for (let i = 0; i < nonOverlapping.length; i++) {
    const { start, end, word } = nonOverlapping[i];
    if (start > lastIdx) {
      nodes.push(text.slice(lastIdx, start));
    }
    nodes.push(
      <mark key={i} className={styles.matchedWord} title={`English dictionary word: ${word}`}>
        {text.slice(start, end)}
      </mark>
    );
    lastIdx = end;
  }

  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx));
  }

  return nodes;
};

export const ScrollingWindowPage: React.FC<ScrollingWindowPageProps> = ({
  pattern,
  onChangePattern,
  eyeInversion,
  onChangeEyeInversion,
  stepMode,
  onChangeStepMode,
}) => {
  const [settings, setSettings] = useState<WindowEncodingSettings>(DEFAULT_WINDOW_SETTINGS);
  const [activeAlphabetId, setActiveAlphabetId] = useState<string>('english_26');
  const [customAlphabetText, setCustomAlphabetText] = useState<string>('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const [mapping, setMapping] = useState<Record<number, string>>(() =>
    generateIdentityMapping(DEFAULT_WINDOW_SETTINGS.modulo, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
  );
  const [sweepSortBy, setSweepSortBy] = useState<'score' | 'ic' | 'peak' | 'modulo'>('score');
  const [chartSortBy, setChartSortBy] = useState<'index' | 'frequency'>('index');
  const [activeMessageTab, setActiveMessageTab] = useState<'all' | number>('all');
  const [copied, setCopied] = useState<boolean>(false);

  // 1. Extract raw numbers based on active data source configuration
  const inputStreams = useMemo(() => {
    return extractInputStreams(pattern, eyeInversion, stepMode, settings.streamType);
  }, [pattern, eyeInversion, stepMode, settings.streamType]);

  // Active alphabet string
  const activeAlphabetString = useMemo(() => {
    if (activeAlphabetId === 'custom') return customAlphabetText || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const found = ALPHABET_CHOICES.find((a) => a.id === activeAlphabetId);
    return found ? found.characters : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }, [activeAlphabetId, customAlphabetText]);

  // 2. Compute transformed numbers for each message
  const transformedData = useMemo(() => {
    const results: Record<number, number[]> = {};
    let carry = 0;

    for (let mIdx = 1; mIdx <= 9; mIdx++) {
      const input = inputStreams[mIdx] || [];
      const init = settings.resetPerMessage ? 0 : carry;
      const res = applyWindowEncoding(input, settings, init);
      results[mIdx] = res.outputNumbers;
      carry = res.finalCarry;
    }

    return results;
  }, [inputStreams, settings]);

  // Combined numbers based on scope
  const activeNumbers = useMemo(() => {
    if (settings.scope === 'all') {
      let combined: number[] = [];
      for (let mIdx = 1; mIdx <= 9; mIdx++) {
        combined = combined.concat(transformedData[mIdx] || []);
      }
      return combined;
    }
    return transformedData[settings.scope as number] || [];
  }, [transformedData, settings.scope]);

  // 3. Distribution statistics for active modulo
  const stats = useMemo(() => {
    return computeDistributionStats(activeNumbers, settings.modulo);
  }, [activeNumbers, settings.modulo]);

  // 4. Modulo sweep over M = 2..83 (or up to 125)
  const sweepResults = useMemo(() => {
    const maxM = settings.streamType === 'trigram_decimals' ? 83 : 40;
    return runModuloSweep(inputStreams, settings, 2, maxM);
  }, [inputStreams, settings]);

  // Sorted sweep results
  const sortedSweep = useMemo(() => {
    return [...sweepResults].sort((a, b) => {
      if (sweepSortBy === 'score') return b.score - a.score;
      if (sweepSortBy === 'ic') return b.ic - a.ic;
      if (sweepSortBy === 'peak') return b.peakPct - a.peakPct;
      return a.modulo - b.modulo;
    });
  }, [sweepResults, sweepSortBy]);

  // 5. Handlers for mapping modifications
  const handleMapByFrequency = useCallback(() => {
    const newMapping = generateFrequencyMapping(
      stats,
      activeAlphabetString,
      activeAlphabetId === 'english_space_27'
    );
    setMapping(newMapping);
  }, [stats, activeAlphabetString, activeAlphabetId]);

  const handleIdentityMapping = useCallback(() => {
    const newMapping = generateIdentityMapping(settings.modulo, activeAlphabetString);
    setMapping(newMapping);
  }, [settings.modulo, activeAlphabetString]);

  const handleRandomShuffle = useCallback(() => {
    const newMapping = generateRandomMapping(settings.modulo, activeAlphabetString);
    setMapping(newMapping);
  }, [settings.modulo, activeAlphabetString]);

  const handleShiftMapping = useCallback(
    (shift: number) => {
      const newMapping = generateShiftMapping(
        mapping,
        settings.modulo,
        shift,
        activeAlphabetString
      );
      setMapping(newMapping);
    },
    [mapping, settings.modulo, activeAlphabetString]
  );

  const handleSetModulo = (newM: number) => {
    const m = Math.max(2, Math.min(125, newM));
    setSettings((prev) => ({ ...prev, modulo: m }));
    setMapping((prev) => {
      const next: Record<number, string> = { ...prev };
      const alphaLen = activeAlphabetString.length;
      for (let i = 0; i < m; i++) {
        if (!next[i]) {
          next[i] = alphaLen > 0 ? activeAlphabetString[i % alphaLen] : '?';
        }
      }
      return next;
    });
  };

  const handleSingleTileChange = (valIndex: number, newChar: string) => {
    setMapping((prev) => ({
      ...prev,
      [valIndex]: newChar || ' ',
    }));
  };

  // Active preset matching
  const activePreset = useMemo(() => {
    return PRESET_ORIENTATIONS.find(
      (p) =>
        p.pattern[0].join(',') === pattern[0].join(',') &&
        p.pattern[1].join(',') === pattern[1].join(',')
    );
  }, [pattern]);

  // Decoded text stream
  const activeDisplayText = useMemo(() => {
    if (activeMessageTab === 'all') {
      const parts: string[] = [];
      for (let mIdx = 1; mIdx <= 9; mIdx++) {
        const nums = transformedData[mIdx] || [];
        parts.push(`[Message ${mIdx}]\n` + decodeStreamToText(nums, mapping));
      }
      return parts.join('\n\n');
    }
    const nums = transformedData[activeMessageTab] || [];
    return decodeStreamToText(nums, mapping);
  }, [activeMessageTab, transformedData, mapping]);

  // Dictionary words scan
  const wordScanResults = useMemo(() => {
    return scanTextForWords(activeDisplayText, 3);
  }, [activeDisplayText]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(activeDisplayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Prepared chart items
  const chartItems = useMemo(() => {
    const items = Array.from({ length: settings.modulo }, (_, i) => ({
      index: i,
      count: stats.frequencies[i] || 0,
      pct: stats.percentages[i] || 0,
      char: mapping[i] || '?',
    }));

    if (chartSortBy === 'frequency') {
      items.sort((a, b) => b.count - a.count);
    }
    return items;
  }, [settings.modulo, stats, mapping, chartSortBy]);

  const maxPct = Math.max(1, ...stats.percentages);
  const uniformPct = 100 / settings.modulo;

  return (
    <div className={styles.pageContainer}>
      {/* Top Statistical Metrics Strip */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Active Modulo (M)</span>
          <span className={`${styles.metricNumber} ${styles.highlightBlue}`}>
            Mod {settings.modulo}
          </span>
          <span className={styles.metricSub}>
            Offset: {settings.offset} | Active Bins: {stats.activeBins} / {settings.modulo}
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Windowing Mode</span>
          <span className={`${styles.metricNumber} ${styles.highlightCyan}`}>
            {settings.windowMode === 'cumulative' && 'Cumulative Sum'}
            {settings.windowMode === 'sliding_sum' && `Sliding W=${settings.windowSize}`}
            {settings.windowMode === 'sliding_weighted' && `Weighted W=${settings.windowSize}`}
            {settings.windowMode === 'delta' && 'Difference (Delta)'}
            {settings.windowMode === 'autoregressive' && `Feedback a=${settings.decayFactor}`}
            {settings.windowMode === 'alternating_sum' && 'Alternating Sum'}
            {settings.windowMode === 'direct' && 'Direct Modulo'}
          </span>
          <span className={styles.metricSub}>
            {settings.resetPerMessage ? 'Reset on message boundary' : 'Continuous stream'}
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Peak Frequency</span>
          <span className={`${styles.metricNumber} ${styles.highlightGreen}`}>
            {stats.peakPct.toFixed(1)}%
          </span>
          <span className={styles.metricSub}>
            Bin #{stats.peakVal} ('{mapping[stats.peakVal] || '?'}' with {stats.peakCount} hits)
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Shannon Entropy</span>
          <span className={`${styles.metricNumber} ${styles.highlightAmber}`}>
            {stats.shannonEntropy.toFixed(3)} bits
          </span>
          <span className={styles.metricSub}>
            {(stats.entropyRatio * 100).toFixed(1)}% of theoretical max ({stats.maxEntropy.toFixed(3)} bits)
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Index of Coincidence</span>
          <span className={`${styles.metricNumber} ${styles.highlightPurple}`}>
            {stats.indexOfCoincidence.toFixed(5)}
          </span>
          <span className={styles.metricSub}>
            {stats.icRatio.toFixed(2)}x uniform ({stats.uniformIC.toFixed(5)}) | English: 0.0667
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Interest Score</span>
          <span className={`${styles.metricNumber} ${stats.interestingnessScore > 30 ? styles.highlightGreen : styles.highlightBlue}`}>
            {stats.interestingnessScore.toFixed(1)}
          </span>
          <span className={styles.metricSub}>
            Reduced Chi-Sq: {(stats.chiSquare / Math.max(1, settings.modulo - 1)).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Section 1: Data Source Configuration */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>1. Data Source Configuration</h2>
        </div>
        <p className={styles.sectionDesc}>
          Select the physical reading order pattern, observer gaze perspective, and input stream representation. Any adjustment updates the number stream instantaneously.
        </p>

        <div className={styles.sourceGrid}>
          {/* Preset Orientations */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Reading Order Presets:</label>
            <div className={styles.presetsRow}>
              {PRESET_ORIENTATIONS.map((preset) => {
                const isActive = activePreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.presetPill} ${isActive ? styles.active : ''}`}
                    onClick={() => onChangePattern(preset.pattern)}
                    title={preset.description}
                  >
                    <MiniArrowShape pattern={preset.pattern} width={36} height={16} id={`sw-${preset.id}`} />
                    <span className={styles.presetName}>{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observer Perspective / Gaze Inversion */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Gaze Inversion:</label>
            <div className={styles.btnGroup}>
              <button
                type="button"
                className={`${styles.btnToggle} ${eyeInversion.mode === 'none' ? styles.active : ''}`}
                onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'none' })}
              >
                Standard (None)
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${eyeInversion.mode === 'return_only' ? styles.active : ''}`}
                onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'return_only' })}
                title="Invert steps 4, 5, 6 of each 6-eye cell"
              >
                Invert Return (4-6)
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${eyeInversion.mode === 'all' ? styles.active : ''}`}
                onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'all' })}
              >
                Invert All Eyes (180°)
              </button>
            </div>
          </div>

          {/* Stream Type & Step Mode */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Input Stream Type:</label>
            <div className={styles.btnGroup}>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.streamType === 'trigram_decimals' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, streamType: 'trigram_decimals' }))}
                title="Quinary trigram values (0..82 / 0..124)"
              >
                Trigram Decimals
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.streamType === 'raw_digits' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, streamType: 'raw_digits' }))}
                title="Raw eye gaze directions (0..4)"
              >
                Raw Eye Digits (0..4)
              </button>
            </div>
          </div>

          {/* Step Mode */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Step Mode (Trigrams):</label>
            <div className={styles.btnGroup}>
              <button
                type="button"
                className={`${styles.btnToggle} ${stepMode === 'non_overlapping' ? styles.active : ''}`}
                onClick={() => onChangeStepMode('non_overlapping')}
                title="Non-overlapping steps (step 3)"
              >
                Non-overlapping (Step 3)
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${stepMode === 'overlapping' ? styles.active : ''}`}
                onClick={() => onChangeStepMode('overlapping')}
                title="Overlapping steps (step 1)"
              >
                Overlapping (Step 1)
              </button>
            </div>
          </div>
        </div>

        {/* Live Feedback Strip */}
        <div className={styles.feedbackBar}>
          <span className={styles.feedbackLabel}>Current Source:</span>
          <span className={styles.feedbackDetails}>
            Pattern: <code>[[{pattern[0].join(',')}],[{pattern[1].join(',')}]]</code> | Gaze Inversion:{' '}
            <strong>
              {eyeInversion.mode === 'none' && 'Standard'}
              {eyeInversion.mode === 'return_only' && 'Return Loop Only (Steps 4-6)'}
              {eyeInversion.mode === 'all' && 'All Eyes (180°)'}
            </strong>{' '}
            | Step Mode: <code>{stepMode}</code> | Total Input Numbers: <strong>{activeNumbers.length}</strong>
          </span>
        </div>
      </div>

      {/* Section 2: Scrolling Window & Modulo Controls */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>2. Scrolling Window & Modulo Operations</h2>
        </div>
        <p className={styles.sectionDesc}>
          Configure the cumulative running sum, rolling window size, or differential operators. Then adjust Modulo M to wrap values into a finite alphabet range.
        </p>

        <div className={styles.controlsGrid}>
          {/* Operation Mode */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Window Operator:</label>
            <div className={styles.btnGroup}>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.windowMode === 'cumulative' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, windowMode: 'cumulative' }))}
                title="Running cumulative sum: S[i] = (S[i-1] + x[i]) mod M"
              >
                Cumulative Sum
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.windowMode === 'sliding_sum' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, windowMode: 'sliding_sum' }))}
                title="Sum of last W elements: sum(x[i-k]) mod M"
              >
                Sliding Sum (Size W)
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.windowMode === 'sliding_weighted' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, windowMode: 'sliding_weighted' }))}
                title="Weighted rolling sum: sum(w[k] * x[i-k]) mod M"
              >
                Weighted Window
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.windowMode === 'delta' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, windowMode: 'delta' }))}
                title="First difference: (x[i] - x[i-1]) mod M"
              >
                Difference (Delta)
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.windowMode === 'autoregressive' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, windowMode: 'autoregressive' }))}
                title="Leaky feedback accumulator: S[i] = (a * S[i-1] + x[i]) mod M"
              >
                Modulo Feedback
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.windowMode === 'alternating_sum' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, windowMode: 'alternating_sum' }))}
                title="Alternating signs: S[i] = (S[i-1] + (-1)^i * x[i]) mod M"
              >
                Alternating Sum
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.windowMode === 'direct' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, windowMode: 'direct' }))}
                title="Direct modulo without windowing: x[i] mod M"
              >
                Direct Modulo
              </button>
            </div>
          </div>

          {/* Window Size Slider (if sliding or weighted) */}
          {(settings.windowMode === 'sliding_sum' || settings.windowMode === 'sliding_weighted') && (
            <div className={styles.controlBlock}>
              <label className={styles.fieldLabel}>Window Size (W):</label>
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  value={settings.windowSize}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, windowSize: Number(e.target.value) }))
                  }
                  className={styles.sliderInput}
                />
                <span className={styles.sliderValBadge}>{settings.windowSize}</span>
              </div>
            </div>
          )}

          {/* Weight Type (if weighted) */}
          {settings.windowMode === 'sliding_weighted' && (
            <div className={styles.controlBlock}>
              <label className={styles.fieldLabel}>Weight Profile:</label>
              <select
                className={styles.selectDropdown}
                value={settings.weightType}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    weightType: e.target.value as 'uniform' | 'linear' | 'fibonacci' | 'base5',
                  }))
                }
              >
                <option value="uniform">Uniform [1, 1, 1...]</option>
                <option value="linear">Linear [1, 2, 3...]</option>
                <option value="fibonacci">Fibonacci [1, 1, 2, 3, 5...]</option>
                <option value="base5">Powers of 5 [1, 5, 25...]</option>
              </select>
            </div>
          )}

          {/* Decay Factor (if autoregressive) */}
          {settings.windowMode === 'autoregressive' && (
            <div className={styles.controlBlock}>
              <label className={styles.fieldLabel}>Feedback Factor (a):</label>
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  min="1"
                  max={Math.max(2, settings.modulo - 1)}
                  step="1"
                  value={settings.decayFactor}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, decayFactor: Number(e.target.value) }))
                  }
                  className={styles.sliderInput}
                />
                <span className={styles.sliderValBadge}>{settings.decayFactor}</span>
              </div>
            </div>
          )}

          {/* Reset Boundary & Scope */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Boundary & Scope:</label>
            <div className={styles.btnGroup}>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.resetPerMessage ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, resetPerMessage: !s.resetPerMessage }))}
              >
                Reset per Message: {settings.resetPerMessage ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className={`${styles.btnToggle} ${settings.scope === 'all' ? styles.active : ''}`}
                onClick={() => setSettings((s) => ({ ...s, scope: 'all' }))}
              >
                All 9 Messages
              </button>
            </div>
          </div>

          {/* Modulo M Slider & Inputs */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Modulo Amount (M):</label>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min="2"
                max={settings.streamType === 'trigram_decimals' ? 83 : 40}
                step="1"
                value={settings.modulo}
                onChange={(e) => handleSetModulo(Number(e.target.value))}
                className={styles.sliderInput}
              />
              <span className={styles.sliderValBadge}>{settings.modulo}</span>
            </div>
            {/* Quick Modulo Presets */}
            <div className={styles.moduloPresetsRow}>
              {MODULO_PRESETS.map((p) => {
                const isActive = settings.modulo === p.modulo;
                return (
                  <button
                    key={p.modulo}
                    type="button"
                    className={`${styles.moduloPill} ${isActive ? styles.active : ''}`}
                    onClick={() => handleSetModulo(p.modulo)}
                    title={p.description}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Offset / Shift K */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Value Offset (K): (y + K) mod M</label>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min="0"
                max={settings.modulo - 1}
                step="1"
                value={settings.offset}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, offset: Number(e.target.value) }))
                }
                className={styles.sliderInput}
              />
              <span className={styles.sliderValBadge}>+{settings.offset}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Modulo Sweep Scanner */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>3. Modulo Sweep Scanner (Finding the Most Interesting Distribution)</h2>
          <div className={styles.btnGroup}>
            <span className={styles.fieldLabel} style={{ alignSelf: 'center', marginRight: '6px' }}>Sort By:</span>
            <button
              type="button"
              className={`${styles.btnToggle} ${sweepSortBy === 'score' ? styles.active : ''}`}
              onClick={() => setSweepSortBy('score')}
            >
              Interest Score
            </button>
            <button
              type="button"
              className={`${styles.btnToggle} ${sweepSortBy === 'ic' ? styles.active : ''}`}
              onClick={() => setSweepSortBy('ic')}
            >
              Index of Coincidence (IC)
            </button>
            <button
              type="button"
              className={`${styles.btnToggle} ${sweepSortBy === 'peak' ? styles.active : ''}`}
              onClick={() => setSweepSortBy('peak')}
            >
              Peak Freq %
            </button>
            <button
              type="button"
              className={`${styles.btnToggle} ${sweepSortBy === 'modulo' ? styles.active : ''}`}
              onClick={() => setSweepSortBy('modulo')}
            >
              Modulo (2..83)
            </button>
          </div>
        </div>
        <p className={styles.sectionDesc}>
          Automatically runs the current window transformation across all moduli to identify where natural-language-like spikes, high Index of Coincidence, and non-uniform clustering occur. Click any row or the &ldquo;Select&rdquo; button to activate that modulo.
        </p>

        <div className={styles.sweepContainer}>
          <div className={styles.tableWrapper}>
            <table className={styles.sweepTable}>
              <thead>
                <tr>
                  <th onClick={() => setSweepSortBy('modulo')}>Modulo (M)</th>
                  <th>Active Bins</th>
                  <th onClick={() => setSweepSortBy('peak')}>Peak Freq</th>
                  <th>Entropy (bits)</th>
                  <th onClick={() => setSweepSortBy('ic')}>IC (Target ~0.0667)</th>
                  <th>Ratio to Uniform</th>
                  <th>Chi-Square / df</th>
                  <th onClick={() => setSweepSortBy('score')}>Interest Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedSweep.map((item) => {
                  const isCurrent = settings.modulo === item.modulo;
                  const isHigh = item.score > 30;
                  return (
                    <tr
                      key={item.modulo}
                      className={`${styles.sweepRow} ${isCurrent ? styles.selected : ''} ${isHigh ? styles.topScore : ''}`}
                      onClick={() => handleSetModulo(item.modulo)}
                    >
                      <td style={{ fontWeight: 800 }}>Mod {item.modulo}</td>
                      <td>
                        {item.activeBins} / {item.modulo}
                      </td>
                      <td style={{ color: item.peakPct > 15 ? '#34d399' : '#f1f5f9' }}>
                        {item.peakPct.toFixed(1)}% (Bin #{item.peakVal})
                      </td>
                      <td>
                        {item.entropy.toFixed(3)} ({item.entropyPct.toFixed(1)}%)
                      </td>
                      <td style={{ fontWeight: 700, color: item.ic > 0.05 ? '#c084fc' : '#94a3b8' }}>
                        {item.ic.toFixed(5)}
                      </td>
                      <td>{item.icRatio.toFixed(2)}x</td>
                      <td>{(item.chiSquare / Math.max(1, item.modulo - 1)).toFixed(2)}</td>
                      <td>
                        <span
                          className={`${styles.scoreBadge} ${
                            item.score > 35
                              ? styles.scoreHigh
                              : item.score > 15
                              ? styles.scoreMed
                              : styles.scoreLow
                          }`}
                        >
                          {item.score.toFixed(1)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnSelectMini}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetModulo(item.modulo);
                          }}
                        >
                          {isCurrent ? 'Active' : 'Select'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 4: Frequency Distribution Histogram */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            4. Modulo {settings.modulo} Frequency Histogram & Shape
          </h2>
          <div className={styles.btnGroup}>
            <button
              type="button"
              className={`${styles.btnToggle} ${chartSortBy === 'index' ? styles.active : ''}`}
              onClick={() => setChartSortBy('index')}
            >
              Sort by Value (0 .. {settings.modulo - 1})
            </button>
            <button
              type="button"
              className={`${styles.btnToggle} ${chartSortBy === 'frequency' ? styles.active : ''}`}
              onClick={() => setChartSortBy('frequency')}
            >
              Sort by Frequency (Descending)
            </button>
          </div>
        </div>
        <p className={styles.sectionDesc}>
          Visualizing each modulo bin &lsquo;{0} .. {settings.modulo - 1}&rsquo; and its mapped character. Amber dashed line represents uniform baseline ({uniformPct.toFixed(1)}%).
        </p>

        <div className={styles.chartContainer}>
          <div className={styles.barsScrollArea}>
            <div className={styles.barsGrid}>
              {/* Reference Uniform line */}
              <div
                className={styles.refLineUniform}
                style={{
                  bottom: `${Math.min(100, (uniformPct / maxPct) * 140)}px`,
                }}
              >
                <span className={styles.refLineLabel}>Uniform: {uniformPct.toFixed(1)}%</span>
              </div>

              {chartItems.map((item) => {
                const heightPx = Math.max(2, (item.pct / maxPct) * 140);
                const isPeak = item.index === stats.peakVal;
                const isAboveUniform = item.pct > uniformPct * 1.25;

                return (
                  <div
                    key={item.index}
                    className={styles.barCol}
                    title={`Bin #${item.index} ('${item.char}'): ${item.count} hits (${item.pct.toFixed(2)}%)`}
                  >
                    <span className={styles.barCharLabel}>{item.char}</span>
                    <div className={styles.barTrack}>
                      <div
                        className={`${styles.barFill} ${isPeak ? styles.peak : isAboveUniform ? styles.high : ''}`}
                        style={{ height: `${heightPx}px` }}
                      />
                    </div>
                    <span className={styles.barIndexLabel}>#{item.index}</span>
                    <span className={styles.barPctLabel}>{item.pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Letter Mapping Studio */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>5. Letter Mapping Studio (Permutations & Alphabet Substitution)</h2>
          <div className={styles.btnGroup}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleMapByFrequency}
              title="Assign most frequent modulo values to common English letters (E, T, A, O, I, N...)"
            >
              Frequency Match (ETAOIN...)
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleIdentityMapping}
              title="Sequential mapping: 0->A, 1->B, etc."
            >
              Natural Order (A, B, C...)
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleRandomShuffle}
              title="Randomly shuffle letter assignments"
            >
              Random Shuffle
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => handleShiftMapping(1)}
              title="Rotate mapping by +1"
            >
              Shift +1
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => handleShiftMapping(-1)}
              title="Rotate mapping by -1"
            >
              Shift -1
            </button>
          </div>
        </div>
        <p className={styles.sectionDesc}>
          Assign letters to the modulo values. You can click &ldquo;Random Shuffle&rdquo; to test permutations, &ldquo;Frequency Match&rdquo; to rank by English frequency, or edit any tile below directly.
        </p>

        {/* Alphabet Selection */}
        <div className={styles.controlsGrid} style={{ marginBottom: '12px' }}>
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Target Alphabet Preset:</label>
            <select
              className={styles.selectDropdown}
              value={activeAlphabetId}
              onChange={(e) => setActiveAlphabetId(e.target.value)}
            >
              {ALPHABET_CHOICES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              <option value="custom">Custom Character String</option>
            </select>
          </div>

          {activeAlphabetId === 'custom' && (
            <div className={styles.controlBlock}>
              <label className={styles.fieldLabel}>Custom Character Set:</label>
              <input
                type="text"
                value={customAlphabetText}
                onChange={(e) => setCustomAlphabetText(e.target.value)}
                className={styles.selectDropdown}
                placeholder="Type alphabet characters..."
              />
            </div>
          )}
        </div>

        {/* Editable Mapping Tiles Matrix */}
        <div className={styles.mappingGrid}>
          {Array.from({ length: settings.modulo }, (_, i) => {
            const count = stats.frequencies[i] || 0;
            const pct = stats.percentages[i] || 0;
            const char = mapping[i] || '';

            return (
              <div key={i} className={styles.mapTile}>
                <span className={styles.mapTileNum}>#{i}</span>
                <span className={styles.mapTilePct}>{pct.toFixed(1)}%</span>
                <input
                  type="text"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleSingleTileChange(i, e.target.value)}
                  className={styles.mapTileInput}
                  title={`Bin #${i} (${count} hits, ${pct.toFixed(2)}%)`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 6: Decoded Stream & Real-time Dictionary Word Highlighter */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className={styles.sectionTitle}>6. Decoded Output Stream & Dictionary Scan</h2>
            <span className={styles.wordsBadge}>
              English Words Detected: {wordScanResults.totalWords} ({wordScanResults.matches.length} occurrences)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleCopyText}
            >
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          </div>
        </div>
        <p className={styles.sectionDesc}>
          The transformed modulo stream decoded through your active letter mapping. Valid dictionary words (3+ letters) are automatically detected and highlighted in green.
        </p>

        {/* Message Selector Tabs */}
        <div className={styles.msgTabsRow} style={{ marginBottom: '12px' }}>
          <button
            type="button"
            className={`${styles.msgTab} ${activeMessageTab === 'all' ? styles.active : ''}`}
            onClick={() => setActiveMessageTab('all')}
          >
            All Messages (1..9)
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((mIdx) => (
            <button
              key={mIdx}
              type="button"
              className={`${styles.msgTab} ${activeMessageTab === mIdx ? styles.active : ''}`}
              onClick={() => setActiveMessageTab(mIdx)}
            >
              Message {mIdx} ({transformedData[mIdx]?.length || 0})
            </button>
          ))}
        </div>

        {/* Highlighted Stream Box */}
        <div className={styles.streamBox}>
          {renderHighlightedText(activeDisplayText, wordScanResults.matches)}
        </div>
      </div>
    </div>
  );
};
