import React, { useState, useMemo, useCallback } from 'react';
import styles from './CrossMessageDeltaPage.module.css';
import controls from '../styles/controls.module.css';
import {
  getMessageStreams,
  analyzeMessageDeltas,
  compute9x9PairwiseMatrix,
  scanLagCorrelation,
  decodeDeltasToText,
  scanDeltaTextForWords,
  SYMMETRIC_PAIRS,
  ADJACENT_PAIRS,
  type DeltaOperation,
} from '../utils/deltaAnalysisUtils';
import {
  PRESET_ORIENTATIONS,
  type SixEyePattern,
  type EyeInversionSettings,
} from '../utils/orientationExtractor';
import { MiniArrowShape } from './MiniArrowShape';
import { ALPHABET_CHOICES } from '../utils/windowEncodingUtils';

interface CrossMessageDeltaPageProps {
  pattern: SixEyePattern;
  onChangePattern: (pattern: SixEyePattern) => void;
  eyeInversion: EyeInversionSettings;
  onChangeEyeInversion: (inversion: EyeInversionSettings) => void;
  stepMode: 'non_overlapping' | 'overlapping';
  onChangeStepMode: (mode: 'non_overlapping' | 'overlapping') => void;
}

export const CrossMessageDeltaPage: React.FC<CrossMessageDeltaPageProps> = ({
  pattern,
  onChangePattern,
  eyeInversion,
  onChangeEyeInversion,
  stepMode,
  onChangeStepMode,
}) => {
  const [msgA, setMsgA] = useState<number>(1);
  const [msgB, setMsgB] = useState<number>(9);
  const [streamType, setStreamType] = useState<'raw_digits' | 'trigram_decimals'>('raw_digits');
  const [operation, setOperation] = useState<DeltaOperation>('sub_mod');
  const [modulo, setModulo] = useState<number>(5);
  const [lag, setLag] = useState<number>(0);
  const [reverseB, setReverseB] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'matches' | 'diffs'>('all');
  const [activeAlphabetId, setActiveAlphabetId] = useState<string>('english_26');
  const [copied, setCopied] = useState<boolean>(false);

  // Auto-switch modulo when switching stream type
  const handleStreamTypeChange = (type: 'raw_digits' | 'trigram_decimals') => {
    setStreamType(type);
    if (type === 'raw_digits') {
      setModulo(5);
    } else {
      setModulo(83);
    }
  };

  // 1. Extract message streams based on active orientation & settings
  const streams = useMemo(() => {
    return getMessageStreams(pattern, eyeInversion, stepMode, streamType);
  }, [pattern, eyeInversion, stepMode, streamType]);

  // 2. Compute 9x9 Pairwise Matrix for the entire dataset
  const pairwiseMatrix = useMemo(() => {
    return compute9x9PairwiseMatrix(streams, operation, modulo, reverseB, streamType);
  }, [streams, operation, modulo, reverseB, streamType]);

  // 3. Compute delta analysis for the active pair (msgA, msgB)
  const deltaResult = useMemo(() => {
    const sA = streams[msgA] || [];
    const sB = streams[msgB] || [];
    return analyzeMessageDeltas(sA, sB, msgA, msgB, operation, modulo, lag, reverseB, streamType);
  }, [streams, msgA, msgB, operation, modulo, lag, reverseB, streamType]);

  // 4. Lag cross-correlation scan (-25 to +25)
  const lagScanResults = useMemo(() => {
    const sA = streams[msgA] || [];
    const sB = streams[msgB] || [];
    return scanLagCorrelation(sA, sB, operation, modulo, reverseB, 25);
  }, [streams, msgA, msgB, operation, modulo, reverseB]);

  // Optimal lag
  const optimalLag = useMemo(() => {
    let best = lagScanResults[0] || { lag: 0, matchPct: 0 };
    for (const item of lagScanResults) {
      if (item.matchPct > best.matchPct) {
        best = item;
      }
    }
    return best;
  }, [lagScanResults]);

  // Active alphabet string
  const activeAlphabetString = useMemo(() => {
    const found = ALPHABET_CHOICES.find((a) => a.id === activeAlphabetId);
    return found ? found.characters : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }, [activeAlphabetId]);

  // Decoded text stream from deltas
  const deltaText = useMemo(() => {
    const deltas = deltaResult.items.map((it) => it.delta);
    return decodeDeltasToText(deltas, activeAlphabetString);
  }, [deltaResult, activeAlphabetString]);

  // Dictionary words scan on delta stream
  const deltaWords = useMemo(() => {
    return scanDeltaTextForWords(deltaText, 3);
  }, [deltaText]);

  // Filtered items for display
  const displayedItems = useMemo(() => {
    if (filterMode === 'matches') return deltaResult.items.filter((it) => it.isMatch);
    if (filterMode === 'diffs') return deltaResult.items.filter((it) => !it.isMatch);
    return deltaResult.items;
  }, [deltaResult.items, filterMode]);

  // Active preset match
  const activePreset = useMemo(() => {
    return PRESET_ORIENTATIONS.find(
      (p) =>
        p.pattern[0].join(',') === pattern[0].join(',') &&
        p.pattern[1].join(',') === pattern[1].join(',')
    );
  }, [pattern]);

  // Quick pair selector
  const handleSelectPair = useCallback((a: number, b: number) => {
    setMsgA(a);
    setMsgB(b);
  }, []);

  const handleCopyText = () => {
    navigator.clipboard.writeText(deltaText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCurrentSymmetric = msgA + msgB === 10;
  const maxBinPct = Math.max(1, ...deltaResult.percentages);

  return (
    <div className={styles.pageContainer}>
      {/* Pair Preset Selector Banner */}
      <div className={styles.pairSelectorBar}>
        <div className={styles.selectorHeader}>
          <h2 className={styles.selectorTitle}>Pair Selection & Comparison Presets</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className={`${controls.btnToggle} ${reverseB ? controls.active : ''}`}
              onClick={() => setReverseB(!reverseB)}
              title="Reverse Message B from tail-to-head (tests palindromic / inverted symmetry)"
            >
              Reverse Msg B (Head-to-Tail): {reverseB ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Symmetric Pairs (Sum = 10) */}
        <div>
          <span className={styles.fieldLabel} style={{ display: 'block', marginBottom: '6px' }}>
            Symmetric Inverted Pairs (Sum = 10):
          </span>
          <div className={styles.pairPresetsRow}>
            {SYMMETRIC_PAIRS.map((pair) => {
              const isActive = msgA === pair.msgA && msgB === pair.msgB;
              return (
                <button
                  key={pair.id}
                  type="button"
                  className={`${styles.symmetricPill} ${isActive ? styles.active : ''}`}
                  onClick={() => handleSelectPair(pair.msgA, pair.msgB)}
                  title={pair.description}
                >
                  <span className={styles.pillLabel}>{pair.label}</span>
                  <span className={styles.pillSub}>{pair.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Adjacent / Neighbor Pairs */}
        <div>
          <span className={styles.fieldLabel} style={{ display: 'block', marginBottom: '6px' }}>
            Adjacent Level Pairs (East & West on Same Y Level):
          </span>
          <div className={styles.pairPresetsRow}>
            {ADJACENT_PAIRS.map((pair) => {
              const isActive = msgA === pair.msgA && msgB === pair.msgB;
              return (
                <button
                  key={pair.id}
                  type="button"
                  className={`${styles.symmetricPill} ${isActive ? styles.active : ''}`}
                  onClick={() => handleSelectPair(pair.msgA, pair.msgB)}
                  title={pair.description}
                >
                  <span className={styles.pillLabel}>{pair.label}</span>
                  <span className={styles.pillSub}>{pair.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Pair Dropdowns */}
        <div className={styles.customPairRow}>
          <span className={styles.fieldLabel}>Custom Pair:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            Message A:
            <select
              className={controls.selectDropdown}
              value={msgA}
              onChange={(e) => setMsgA(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  Msg {n} ({n % 2 === 1 ? 'East' : 'West'} {Math.ceil(n / 2)})
                </option>
              ))}
            </select>
          </label>

          <span style={{ fontWeight: 800, color: 'var(--text-dim)' }}>vs</span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            Message B:
            <select
              className={controls.selectDropdown}
              value={msgB}
              onChange={(e) => setMsgB(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  Msg {n} ({n % 2 === 1 ? 'East' : 'West'} {Math.ceil(n / 2)})
                </option>
              ))}
            </select>
          </label>

          {isCurrentSymmetric && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#fbbf24',
                fontWeight: 700,
              }}
            >
              Symmetric Pair (Sum = 10)
            </span>
          )}
        </div>
      </div>

      {/* Top Statistical Metrics Strip */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Compared Pair</span>
          <span className={`${styles.metricNumber} ${styles.highlightBlue}`}>
            Msg {msgA} vs {reverseB ? `rev(Msg ${msgB})` : `Msg ${msgB}`}
          </span>
          <span className={styles.metricSub}>
            Overlap: {deltaResult.overlapLength} symbols (Len A: {deltaResult.lengthA}, Len B: {deltaResult.lengthB})
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Exact Matches (Delta = 0)</span>
          <span className={`${styles.metricNumber} ${styles.highlightGreen}`}>
            {deltaResult.matchPct.toFixed(1)}%
          </span>
          <span className={styles.metricSub}>
            {deltaResult.exactMatches} / {deltaResult.overlapLength} matches (Baseline: {(100 / deltaResult.modulo).toFixed(1)}%)
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Longest Match Streak</span>
          <span className={`${styles.metricNumber} ${deltaResult.longestMatchStreak >= 5 ? styles.highlightGreen : styles.highlightAmber}`}>
            {deltaResult.longestMatchStreak} in a row
          </span>
          <span className={styles.metricSub}>
            Max constant delta streak: {deltaResult.longestConstantDeltaStreak} in a row
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Delta Shannon Entropy</span>
          <span className={`${styles.metricNumber} ${styles.highlightAmber}`}>
            {deltaResult.entropy.toFixed(3)} bits
          </span>
          <span className={styles.metricSub}>
            Max: {Math.log2(deltaResult.modulo).toFixed(3)} bits ({( (deltaResult.entropy / Math.log2(deltaResult.modulo)) * 100 ).toFixed(1)}%)
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Delta IC</span>
          <span className={`${styles.metricNumber} ${styles.highlightPurple}`}>
            {deltaResult.indexOfCoincidence.toFixed(5)}
          </span>
          <span className={styles.metricSub}>
            {deltaResult.icRatio.toFixed(2)}x uniform ({deltaResult.uniformIC.toFixed(5)})
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Optimal Lag Alignment</span>
          <span className={`${styles.metricNumber} ${styles.highlightBlue}`}>
            {optimalLag.lag >= 0 ? `+${optimalLag.lag}` : optimalLag.lag}
          </span>
          <span className={styles.metricSub}>
            Best match: {optimalLag.matchPct.toFixed(1)}% at lag {optimalLag.lag}
          </span>
        </div>
      </div>

      {/* Section 1: 9x9 Pairwise Correlation Matrix */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>1. 9x9 Pairwise Correlation Matrix</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Amber borders = Symmetric pairs (1+9, 2+8, 3+7, 4+6, 5+5)
          </span>
        </div>
        <p className={styles.sectionDesc}>
          Every cell displays the match rate between Message Row and Message Column. Click any cell to immediately select that pair for side-by-side inspection below.
        </p>

        <div className={styles.matrixWrapper}>
          <table className={styles.matrixTable}>
            <thead>
              <tr>
                <th className={styles.matrixHeaderCell}>Msg</th>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((col) => (
                  <th key={col} className={styles.matrixHeaderCell}>
                    M{col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairwiseMatrix.map((row, rowIdx) => {
                const aIdx = rowIdx + 1;
                return (
                  <tr key={aIdx}>
                    <th className={styles.matrixHeaderCell}>M{aIdx}</th>
                    {row.map((cell) => {
                      const isSelected = msgA === cell.msgA && msgB === cell.msgB;
                      const isSelf = cell.msgA === cell.msgB;

                      // Color based on match percentage (0% to 50%+)
                      let bg = 'rgba(255, 255, 255, 0.03)';
                      if (isSelf) {
                        bg = 'rgba(59, 130, 246, 0.15)';
                      } else if (cell.matchPct >= 28) {
                        bg = 'rgba(16, 185, 129, 0.35)';
                      } else if (cell.matchPct >= 22) {
                        bg = 'rgba(16, 185, 129, 0.2)';
                      } else if (cell.matchPct >= 18) {
                        bg = 'rgba(59, 130, 246, 0.2)';
                      }

                      return (
                        <td
                          key={cell.msgB}
                          className={`${styles.matrixCell} ${isSelected ? styles.activePair : ''} ${
                            cell.isSymmetricPair ? styles.symmetricHighlight : ''
                          }`}
                          style={{ backgroundColor: bg }}
                          onClick={() => handleSelectPair(cell.msgA, cell.msgB)}
                          title={`Msg ${cell.msgA} vs Msg ${cell.msgB}: ${cell.matchPct.toFixed(1)}% match (${cell.exactMatches}/${cell.overlapLength} items), IC: ${cell.ic.toFixed(4)}`}
                        >
                          <span
                            className={styles.cellPct}
                            style={{
                              color: isSelf
                                ? '#93c5fd'
                                : cell.matchPct >= 25
                                ? '#34d399'
                                : '#f1f5f9',
                            }}
                          >
                            {cell.matchPct.toFixed(0)}%
                          </span>
                          <span className={styles.cellMatches}>
                            {cell.exactMatches}m
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Data Source & Delta Operator Configuration */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>2. Delta Operators & Alignment Controls</h2>
        </div>
        <p className={styles.sectionDesc}>
          Select whether to compare raw eye gaze directions (0..4) or reconstructed trigram decimals. Adjust the delta operator or slide lag to test phase-shifted alignment.
        </p>

        <div className={styles.configGrid}>
          {/* Stream Representation */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Stream Representation:</label>
            <div className={controls.btnToggleGroup}>
              <button
                type="button"
                className={`${controls.btnToggle} ${streamType === 'raw_digits' ? controls.active : ''}`}
                onClick={() => handleStreamTypeChange('raw_digits')}
                title="Direct 0..4 eye directions (Mod 5)"
              >
                Raw Eye Digits (0..4)
              </button>
              <button
                type="button"
                className={`${controls.btnToggle} ${streamType === 'trigram_decimals' ? controls.active : ''}`}
                onClick={() => handleStreamTypeChange('trigram_decimals')}
                title="Quinary trigram values (0..82 / 0..124)"
              >
                Trigram Decimals
              </button>
            </div>
          </div>

          {/* Delta Operation */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Delta Operator:</label>
            <div className={controls.btnToggleGroup}>
              <button
                type="button"
                className={`${controls.btnToggle} ${operation === 'sub_mod' ? controls.active : ''}`}
                onClick={() => setOperation('sub_mod')}
                title="Modular difference: (A - B) mod M"
              >
                (A - B) mod M
              </button>
              <button
                type="button"
                className={`${controls.btnToggle} ${operation === 'add_mod' ? controls.active : ''}`}
                onClick={() => setOperation('add_mod')}
                title="Modular addition / One-time pad: (A + B) mod M"
              >
                (A + B) mod M
              </button>
              <button
                type="button"
                className={`${controls.btnToggle} ${operation === 'abs_diff' ? controls.active : ''}`}
                onClick={() => setOperation('abs_diff')}
                title="Absolute difference: |A - B|"
              >
                |A - B|
              </button>
              <button
                type="button"
                className={`${controls.btnToggle} ${operation === 'xor' ? controls.active : ''}`}
                onClick={() => setOperation('xor')}
                title="Bitwise XOR"
              >
                A ^ B
              </button>
            </div>
          </div>

          {/* Modulo M */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Modulo (M):</label>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min="2"
                max={streamType === 'raw_digits' ? 10 : 125}
                value={modulo}
                onChange={(e) => setModulo(Number(e.target.value))}
                className={styles.sliderInput}
              />
              <span className={styles.sliderValBadge}>{modulo}</span>
            </div>
          </div>

          {/* Lag / Shift Slider */}
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>
              Alignment Lag / Offset: {lag === 0 ? '0 (Synchronous)' : lag > 0 ? `+${lag} (A leads)` : `${lag} (B leads)`}
            </label>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min="-25"
                max="25"
                value={lag}
                onChange={(e) => setLag(Number(e.target.value))}
                className={styles.sliderInput}
              />
              <span className={styles.sliderValBadge}>{lag}</span>
              <button
                type="button"
                className={controls.btnSm}
                onClick={() => setLag(optimalLag.lag)}
                title="Jump to optimal alignment lag"
              >
                Opt: {optimalLag.lag}
              </button>
            </div>
          </div>
        </div>

        {/* Reading Pattern Selector (for Trigram Decimals) */}
        {streamType === 'trigram_decimals' && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <span className={styles.fieldLabel} style={{ display: 'block', marginBottom: '6px' }}>
                Trigram Reading Pattern:
              </span>
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
                      <MiniArrowShape pattern={preset.pattern} width={36} height={16} id={`delta-${preset.id}`} />
                      <span className={styles.presetName}>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className={styles.controlBlock}>
                <span className={styles.fieldLabel}>Gaze Inversion:</span>
                <div className={controls.btnToggleGroup}>
                  <button
                    type="button"
                    className={`${controls.btnToggle} ${eyeInversion.mode === 'none' ? controls.active : ''}`}
                    onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'none' })}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    className={`${controls.btnToggle} ${eyeInversion.mode === 'return_only' ? controls.active : ''}`}
                    onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'return_only' })}
                  >
                    Invert Return (4-6)
                  </button>
                  <button
                    type="button"
                    className={`${controls.btnToggle} ${eyeInversion.mode === 'all' ? controls.active : ''}`}
                    onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'all' })}
                  >
                    Invert All 180°
                  </button>
                </div>
              </div>

              <div className={styles.controlBlock}>
                <span className={styles.fieldLabel}>Step Mode:</span>
                <div className={controls.btnToggleGroup}>
                  <button
                    type="button"
                    className={`${controls.btnToggle} ${stepMode === 'non_overlapping' ? controls.active : ''}`}
                    onClick={() => onChangeStepMode('non_overlapping')}
                  >
                    Non-overlapping (Step 3)
                  </button>
                  <button
                    type="button"
                    className={`${controls.btnToggle} ${stepMode === 'overlapping' ? controls.active : ''}`}
                    onClick={() => onChangeStepMode('overlapping')}
                  >
                    Overlapping (Step 1)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Delta Frequency Histogram */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            3. Delta Frequency Distribution (Mod {modulo})
          </h2>
        </div>
        <p className={styles.sectionDesc}>
          Distribution of differences between Msg {msgA} and {reverseB ? `rev(Msg ${msgB})` : `Msg ${msgB}`}. Green bar is Delta = 0 (identical symbols).
        </p>

        <div className={styles.chartContainer}>
          <div className={styles.barsScrollArea}>
            <div className={styles.barsGrid}>
              {deltaResult.percentages.map((pct, idx) => {
                const heightPx = Math.max(2, (pct / maxBinPct) * 120);
                const isMatch = idx === 0;

                return (
                  <div
                    key={idx}
                    className={styles.barCol}
                    title={`Delta ${idx}: ${deltaResult.frequencies[idx]} occurrences (${pct.toFixed(1)}%)`}
                  >
                    <div className={styles.barTrack}>
                      <div
                        className={`${styles.barFill} ${isMatch ? styles.match : ''}`}
                        style={{ height: `${heightPx}px` }}
                      />
                    </div>
                    <span className={styles.barLabel}>{idx}</span>
                    <span className={styles.barPct}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Side-by-Side Aligned Stream Inspector */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className={styles.sectionTitle}>4. Synchronous Stream Alignment & Matches</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {displayedItems.length} of {deltaResult.overlapLength} aligned positions
            </span>
          </div>

          <div className={controls.btnToggleGroup}>
            <button
              type="button"
              className={`${controls.btnToggle} ${filterMode === 'all' ? controls.active : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All Items
            </button>
            <button
              type="button"
              className={`${controls.btnToggle} ${filterMode === 'matches' ? controls.active : ''}`}
              onClick={() => setFilterMode('matches')}
            >
              Matches Only (Delta = 0)
            </button>
            <button
              type="button"
              className={`${controls.btnToggle} ${filterMode === 'diffs' ? controls.active : ''}`}
              onClick={() => setFilterMode('diffs')}
            >
              Differences Only
            </button>
          </div>
        </div>
        <p className={styles.sectionDesc}>
          Position-by-position comparison of Message {msgA} and {reverseB ? `rev(Message ${msgB})` : `Message ${msgB}`}. Green highlighted rows represent exact matches.
        </p>

        <div className={styles.streamWrapper}>
          <table className={styles.streamTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Msg {msgA} Val</th>
                <th>Msg {msgB} Val</th>
                <th>Delta</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item) => (
                <tr key={item.index} className={item.isMatch ? styles.streamRowMatch : ''}>
                  <td style={{ color: 'var(--text-dim)' }}>#{item.index}</td>
                  <td style={{ fontWeight: 700, color: '#60a5fa' }}>{item.valA}</td>
                  <td style={{ fontWeight: 700, color: '#c084fc' }}>{item.valB}</td>
                  <td>
                    {item.isMatch ? (
                      <span className={styles.deltaMatchBadge}>0 (Match)</span>
                    ) : (
                      <span className={styles.deltaDiffBadge}>{item.delta}</span>
                    )}
                  </td>
                  <td style={{ color: item.isMatch ? '#34d399' : 'var(--text-muted)' }}>
                    {item.isMatch ? 'Exact Match' : `Diff: ${item.delta}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 5: Decoded Delta Text & Word Scanner */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className={styles.sectionTitle}>5. Decoded Delta Stream & Dictionary Words</h2>
            <span className={styles.wordsBadge}>
              English Words Detected: {deltaWords.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={controls.btnSecondary}
              onClick={handleCopyText}
            >
              {copied ? 'Copied' : 'Copy Delta Text'}
            </button>
          </div>
        </div>
        <p className={styles.sectionDesc}>
          The delta sequence mapped through a substitution alphabet to inspect if relative differences between the two messages spell out intelligible plaintext or words.
        </p>

        <div className={styles.configGrid} style={{ marginBottom: '12px' }}>
          <div className={styles.controlBlock}>
            <label className={styles.fieldLabel}>Mapping Alphabet:</label>
            <select
              className={controls.selectDropdown}
              value={activeAlphabetId}
              onChange={(e) => setActiveAlphabetId(e.target.value)}
            >
              {ALPHABET_CHOICES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.decodedBox}>
          {deltaText}
        </div>
      </div>
    </div>
  );
};
