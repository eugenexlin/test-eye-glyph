import React, { useState, useMemo, useEffect, useRef } from 'react';
import styles from './TrigramAnalysisPage.module.css';
import controls from '../styles/controls.module.css';
import {
  analyzeTrigramsForOrientation,
  getSampleTrigramProof,
  compareAllPresetPatterns,
  generateAll720SlotPermutations,
  buildPackedBlocks,
  evaluateSinglePermutation,
  type SixEyePattern,
  type PatternComparisonMetrics,
  type EyeInversionSettings,
  DEFAULT_EYE_INVERSION,
} from '../utils/orientationExtractor';
import { OrientationSelector } from './OrientationSelector';
import { MiniArrowShape } from './MiniArrowShape';
import type { TrigramInfo } from '../utils/trigramUtils';
import { DIR_COLORS, DIR_NAMES } from '../data/eyeConstants';
import { ALL_EYES } from '../data/allEyes';

interface TrigramAnalysisPageProps {
  onBackToTopicOne?: () => void;
  onSelectTopic?: (topicId: string) => void;
  pattern?: SixEyePattern;
  onChangePattern?: (pattern: SixEyePattern) => void;
  eyeInversion?: EyeInversionSettings;
  onChangeEyeInversion?: (inversion: EyeInversionSettings) => void;
  stepMode?: 'non_overlapping' | 'overlapping';
  onChangeStepMode?: (mode: 'non_overlapping' | 'overlapping') => void;
}

// Mini SVG icon for a single gaze direction
const renderMiniShape = (val: number, size = 12) => {
  const color = DIR_COLORS[val] || '#94a3b8';
  const half = size / 2;

  if (val === 0) {
    return (
      <svg width={size} height={size} viewBox={`-${half} -${half} ${size} ${size}`}>
        <circle cx="0" cy="0" r={half * 0.75} fill={color} stroke="#000000" strokeWidth="0.8" />
        <circle cx="0" cy="0" r={half * 0.28} fill="#ffffff" />
      </svg>
    );
  }

  let points = '';
  const r = half * 0.85;
  if (val === 1) points = `0,-${r} -${r * 0.9},${r * 0.75} ${r * 0.9},${r * 0.75}`;
  else if (val === 2) points = `${r},0 -${r * 0.75},-${r * 0.9} -${r * 0.75},${r * 0.9}`;
  else if (val === 3) points = `0,${r} -${r * 0.9},-${r * 0.75} ${r * 0.9},-${r * 0.75}`;
  else if (val === 4) points = `-${r},0 ${r * 0.75},-${r * 0.9} ${r * 0.75},${r * 0.9}`;

  return (
    <svg width={size} height={size} viewBox={`-${half} -${half} ${size} ${size}`}>
      <polygon points={points} fill={color} stroke="#000000" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
};

// Render 3 mini glyphs for a trigram string like "010"
const renderTrigramGlyphs = (code: string, size = 14) => {
  if (code.length !== 3) return null;
  const d1 = Number(code[0]);
  const d2 = Number(code[1]);
  const d3 = Number(code[2]);

  return (
    <span className={styles.trigramGlyphsCombo}>
      {renderMiniShape(d1, size)}
      {renderMiniShape(d2, size)}
      {renderMiniShape(d3, size)}
    </span>
  );
};

export const TrigramAnalysisPage: React.FC<TrigramAnalysisPageProps> = ({
  onBackToTopicOne: _onBackToTopicOne,
  onSelectTopic,
  pattern: propPattern,
  onChangePattern: propOnChangePattern,
  eyeInversion: propInversion,
  onChangeEyeInversion: propOnChangeInversion,
  stepMode: propStepMode,
  onChangeStepMode: propOnChangeStepMode,
}) => {
  // Reading order pattern state (supports shared state from App.tsx or internal fallback)
  const [internalPattern, setInternalPattern] = useState<SixEyePattern>([
    [1, 3, 5],
    [2, 4, 6],
  ]);
  const pattern = propPattern ?? internalPattern;
  const setPattern = propOnChangePattern ?? setInternalPattern;

  // Step mode state
  const [internalStepMode, setInternalStepMode] = useState<'overlapping' | 'non_overlapping'>('non_overlapping');
  const stepMode = propStepMode ?? internalStepMode;
  const setStepMode = propOnChangeStepMode ?? setInternalStepMode;

  // Observer Perspective & Gaze Direction Inversion State
  const [internalInversion, setInternalInversion] = useState<EyeInversionSettings>(DEFAULT_EYE_INVERSION);
  const eyeInversion = propInversion ?? internalInversion;
  const setEyeInversion = propOnChangeInversion ?? setInternalInversion;

  const [activeTab, setActiveTab] = useState<'grid' | 'table' | 'compare'>('grid');
  const [messageFilter, setMessageFilter] = useState<'all' | number>('all');
  const [selectedTrigram, setSelectedTrigram] = useState<TrigramInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'rank' | 'code' | 'decimal' | 'count'>('rank');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Permutation Scanner State for "Compare Orientations" tab
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [hasScannedAll, setHasScannedAll] = useState<boolean>(false);
  const [scannedPermutations, setScannedPermutations] = useState<PatternComparisonMetrics[]>([]);
  const [filterViableOnly, setFilterViableOnly] = useState<boolean>(true);

  // Sorting state for Comparison Table
  const [compareSortField, setCompareSortField] = useState<
    'pattern' | 'totalTrigrams' | 'uniqueCount' | 'missingCount' | 'entropy' | 'topCount' | 'chiSquare'
  >('entropy');
  const [compareSortAsc, setCompareSortAsc] = useState<boolean>(true);

  // Pre-packed blocks and all 720 permutations
  const packedBlocks = useMemo(() => buildPackedBlocks(ALL_EYES), []);
  const all720Perms = useMemo(() => generateAll720SlotPermutations(), []);

  // Timer ref for progressive permutation scanner
  const scanTimerRef = useRef<number | null>(null);
  const scanIndexRef = useRef<number>(0);

  // Sample verification coordinates from Message 1
  const sampleProofs = useMemo(() => {
    return getSampleTrigramProof(pattern, 1, 6, ALL_EYES, eyeInversion);
  }, [pattern, eyeInversion]);

  // Compute full statistical results based on the chosen reading order
  const analysisResult = useMemo(() => {
    return analyzeTrigramsForOrientation(pattern, {
      mode: stepMode,
      messageFilter,
      eyeInversion,
    });
  }, [pattern, stepMode, messageFilter, eyeInversion]);

  // Default initial rows: 4 curated presets
  const presetRows = useMemo(() => {
    return compareAllPresetPatterns(stepMode, ALL_EYES, eyeInversion);
  }, [stepMode, eyeInversion]);

  // Progressive scanner: runs batches of permutations slowly to populate the table smoothly
  const handleStartProgressiveScan = () => {
    if (isScanning) return;

    setIsScanning(true);
    setScanProgress(0);
    setScannedPermutations([]);
    scanIndexRef.current = 0;

    const total = all720Perms.length;
    const batchSize = 30; // 30 permutations per 45ms tick (~1.1 seconds total)
    const accumulated: PatternComparisonMetrics[] = [];

    const runBatch = () => {
      const startIdx = scanIndexRef.current;
      const endIdx = Math.min(startIdx + batchSize, total);

      for (let i = startIdx; i < endIdx; i++) {
        const perm = all720Perms[i];
        const res = evaluateSinglePermutation(perm, packedBlocks, stepMode, eyeInversion);
        accumulated.push(res);
      }

      scanIndexRef.current = endIdx;
      const progress = Math.round((endIdx / total) * 100);
      setScanProgress(progress);
      setScannedPermutations([...accumulated]);

      if (endIdx < total) {
        scanTimerRef.current = window.setTimeout(runBatch, 45);
      } else {
        setIsScanning(false);
        setHasScannedAll(true);
      }
    };

    scanTimerRef.current = window.setTimeout(runBatch, 10);
  };

  const handleStopScan = () => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setIsScanning(false);
  };

  // Instant scan option
  const handleInstantScan = () => {
    handleStopScan();
    const results = all720Perms.map((perm) => evaluateSinglePermutation(perm, packedBlocks, stepMode));
    setScannedPermutations(results);
    setScanProgress(100);
    setHasScannedAll(true);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  // Sorted and filtered rows for the comparison table
  const displayedCompareRows = useMemo(() => {
    let source = hasScannedAll || scannedPermutations.length > 0 ? scannedPermutations : presetRows;

    if (filterViableOnly) {
      source = source.filter((r) => r.isViablePartialBlock);
    }

    const list = [...source];
    list.sort((a, b) => {
      let diff = 0;
      if (compareSortField === 'entropy') {
        diff = a.entropy - b.entropy;
      } else if (compareSortField === 'missingCount') {
        diff = a.missingCount - b.missingCount;
      } else if (compareSortField === 'uniqueCount') {
        diff = a.uniqueCount - b.uniqueCount;
      } else if (compareSortField === 'totalTrigrams') {
        diff = a.totalTrigrams - b.totalTrigrams;
      } else if (compareSortField === 'topCount') {
        diff = a.topCount - b.topCount;
      } else if (compareSortField === 'chiSquare') {
        diff = a.chiSquare - b.chiSquare;
      } else if (compareSortField === 'pattern') {
        const strA = a.pattern[0].join('') + a.pattern[1].join('');
        const strB = b.pattern[0].join('') + b.pattern[1].join('');
        diff = strA.localeCompare(strB);
      }
      return compareSortAsc ? diff : -diff;
    });

    return list;
  }, [hasScannedAll, scannedPermutations, presetRows, filterViableOnly, compareSortField, compareSortAsc]);

  // Set default selected trigram to the most frequent one
  const sortedTrigrams = useMemo(() => {
    return [...analysisResult.trigrams].sort((a, b) => b.count - a.count || a.decimal - b.decimal);
  }, [analysisResult]);

  const activeInspect = selectedTrigram || sortedTrigrams[0] || null;

  // Filtered and sorted list for the Table view
  const tableList = useMemo(() => {
    let list = [...analysisResult.trigrams];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((t) => {
        return (
          t.code.includes(q) ||
          String(t.decimal) === q ||
          DIR_NAMES[t.d1]?.toLowerCase().includes(q) ||
          DIR_NAMES[t.d2]?.toLowerCase().includes(q) ||
          DIR_NAMES[t.d3]?.toLowerCase().includes(q)
        );
      });
    }

    if (sortBy === 'code') {
      list.sort((a, b) => (sortAsc ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code)));
    } else if (sortBy === 'decimal') {
      list.sort((a, b) => (sortAsc ? a.decimal - b.decimal : b.decimal - a.decimal));
    } else if (sortBy === 'count') {
      list.sort((a, b) => (sortAsc ? a.count - b.count : b.count - a.count));
    } else {
      list.sort((a, b) => {
        if (sortAsc) {
          return a.count - b.count || a.decimal - b.decimal;
        }
        return b.count - a.count || a.decimal - b.decimal;
      });
    }

    return list;
  }, [analysisResult, searchQuery, sortBy, sortAsc]);

  // Heatmap color generator
  const getHeatmapColor = (t: TrigramInfo): string => {
    if (t.count === 0) return 'rgba(239, 68, 68, 0.12)';
    const ratio = t.expectedRatio;
    if (ratio < 0.5) return 'rgba(59, 130, 246, 0.15)';
    if (ratio < 0.8) return 'rgba(59, 130, 246, 0.28)';
    if (ratio < 1.2) return 'rgba(16, 185, 129, 0.22)';
    if (ratio < 1.6) return 'rgba(16, 185, 129, 0.45)';
    return 'rgba(245, 158, 11, 0.5)';
  };

  const getHeatmapBorder = (t: TrigramInfo): string => {
    if (t.count === 0) return 'rgba(239, 68, 68, 0.3)';
    const ratio = t.expectedRatio;
    if (ratio < 0.5) return 'rgba(59, 130, 246, 0.25)';
    if (ratio < 0.8) return 'rgba(59, 130, 246, 0.4)';
    if (ratio < 1.2) return 'rgba(16, 185, 129, 0.35)';
    if (ratio < 1.6) return 'rgba(16, 185, 129, 0.6)';
    return 'rgba(245, 158, 11, 0.7)';
  };

  // Helper for column sort header in comparison table
  const renderSortableTh = (
    field: typeof compareSortField,
    label: string,
    width?: string
  ) => {
    const isActive = compareSortField === field;
    return (
      <th
        style={{ width, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => {
          if (compareSortField === field) {
            setCompareSortAsc(!compareSortAsc);
          } else {
            setCompareSortField(field);
            // Default ascending for entropy and missing; descending for counts
            setCompareSortAsc(field === 'entropy' || field === 'missingCount');
          }
        }}
      >
        <span className={styles.thSortLabel}>
          {label} {isActive ? (compareSortAsc ? '▲' : '▼') : ''}
        </span>
      </th>
    );
  };

  return (
    <div className={`${styles.trigramAnalysisPage} topic-page`}>
      <header className="topic-header">
        <h1 className="topic-main-title">Trigram Orientation & Frequency Analysis</h1>
        <p className="topic-main-desc">
          Test reading order orientations across the staggered hexagonal rows to prove which geometric sequence produces the strongest linguistic or structural signals.
        </p>
      </header>

      {/* TOP COMPONENT: Interactive 6-Eye Orientation Selector & Coordinate Proof */}
      <OrientationSelector
        pattern={pattern}
        onChangePattern={setPattern}
        sampleProofs={sampleProofs}
        eyeInversion={eyeInversion}
        onChangeEyeInversion={setEyeInversion}
      />

      {pattern[0][0] === 1 &&
        pattern[0][1] === 2 &&
        pattern[0][2] === 6 &&
        pattern[1][0] === 3 &&
        pattern[1][1] === 5 &&
        pattern[1][2] === 4 &&
        onSelectTopic && (
          <div className={styles.invertedReturnPromoBanner}>
            <div className={styles.promoBannerContent}>
              <span className={styles.promoBadge}>Key Discovery</span>
              <div className={styles.promoTextWrap}>
                <strong className={styles.promoTitle}>Perimeter Inverted Return Pattern [[1,2,6],[3,5,4]]</strong>
                <p className={styles.promoDesc}>
                  {eyeInversion.mode === 'none' &&
                    'Standard Gaze: Trigram decimals strictly terminate at 312 base 5 (decimal 82). Exactly 83 continuous unique values occur (0..82) with 0 occurrences in 83..124.'}
                  {eyeInversion.mode === 'return_only' &&
                    'Upside-Down Return: Inverting eyes on return steps (4-6) introduces value 4 to slot B2, causing all 125 trigram states to appear in the corpus.'}
                  {eyeInversion.mode === 'all' &&
                    'Full 180° Inversion: Preserves 83 unique values while shifting the absent band from 83..124 to values starting with 2 (50..74).'}
                </p>
              </div>
            </div>
            <button
              className={styles.promoActionBtn}
              onClick={() => onSelectTopic('topic-3')}
            >
              Open Inverted Return Decoder (Topic 3)
            </button>
          </div>
        )}

      {/* Statistical Summary Metric Cards for Selected Pattern */}
      <div className={styles.trigramMetricsRow}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>TOTAL TRIGRAMS</div>
          <div className={styles.metricBigVal}>{analysisResult.totalTrigrams.toLocaleString()}</div>
          <div className={styles.metricSub}>
            {stepMode === 'overlapping' ? 'Overlapping (Step 1)' : 'Non-overlapping (Step 3)'}
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>UNIQUE OBSERVED</div>
          <div className={styles.metricBigVal}>
            {analysisResult.uniqueCount} <span className={styles.metricDenom}>/ 125</span>
          </div>
          <div className={styles.metricSub}>
            {((analysisResult.uniqueCount / 125) * 100).toFixed(1)}% of 5^3 states
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>MISSING (0 COUNT)</div>
          <div className={`${styles.metricBigVal} font-mono`}>
            {analysisResult.missingTrigrams.length > 0
              ? `${analysisResult.missingTrigrams.length} trigrams`
              : 'None'}
          </div>
          <div className={`${styles.metricSub} font-mono`}>
            {analysisResult.missingTrigrams.slice(0, 4).join(', ')}
            {analysisResult.missingTrigrams.length > 4 ? '...' : ''}
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>MOST FREQUENT</div>
          <div className={`${styles.metricBigVal} font-mono`}>
            {sortedTrigrams[0]?.code}{' '}
            <span className={styles.metricDenom}>({sortedTrigrams[0]?.count}x)</span>
          </div>
          <div className={styles.metricSub}>
            {sortedTrigrams[0]?.frequency.toFixed(2)}% ({sortedTrigrams[0]?.expectedRatio.toFixed(2)}x uniform)
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>SHANNON ENTROPY</div>
          <div className={`${styles.metricBigVal} font-mono`}>
            {analysisResult.entropy.toFixed(3)}
          </div>
          <div className={styles.metricSub}>
            Max: {analysisResult.maxEntropy.toFixed(3)} bits (lower = more structure)
          </div>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className={styles.trigramFilterBar}>
        <div className="subtab-nav" style={{ margin: 0, border: 'none', padding: 0 }}>
          <button
            type="button"
            className={`subtab-btn ${activeTab === 'grid' ? 'active' : ''}`}
            onClick={() => setActiveTab('grid')}
          >
            125-Matrix Heatmap
          </button>
          <button
            type="button"
            className={`subtab-btn ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            Rankings & Frequency Table
          </button>
          <button
            type="button"
            className={`subtab-btn ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            Orientation Comparison ({displayedCompareRows.length} patterns)
          </button>
        </div>

        <div className={styles.filterGroup} style={{ marginLeft: 'auto' }}>
          <span className={styles.filterLabel}>Mode:</span>
          <div className={controls.btnToggleGroup}>
            <button
              type="button"
              className={`${controls.btnToggle} ${stepMode === 'non_overlapping' ? controls.active : ''}`}
              onClick={() => setStepMode('non_overlapping')}
            >
              Non-overlapping (Words)
            </button>
            <button
              type="button"
              className={`${controls.btnToggle} ${stepMode === 'overlapping' ? controls.active : ''}`}
              onClick={() => setStepMode('overlapping')}
            >
              Overlapping (Transitions)
            </button>
          </div>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Scope:</span>
          <select
            className={controls.selectDropdown}
            value={messageFilter}
            onChange={(e) => {
              const val = e.target.value;
              setMessageFilter(val === 'all' ? 'all' : Number(val));
            }}
          >
            <option value="all">All 9 Messages</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <option key={num} value={num}>
                Message {num}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SUBTAB 1: 125-Matrix Heatmap for Selected Orientation */}
      {activeTab === 'grid' && (
        <div className={styles.trigramGridLayout}>
          {/* Left: 5 blocks of 5x5 subgrids (125 total cells) */}
          <div className={styles.trigramMatrixContainer}>
            {[0, 1, 2, 3, 4].map((d1) => (
              <div key={d1} className={styles.trigramBlockCard}>
                <div className={styles.trigramBlockHeader}>
                  <span className={styles.blockPrefix}>First Digit = {d1}</span>
                  <span className={`${styles.blockName} font-mono`}>{DIR_NAMES[d1]}</span>
                  <span className={styles.blockRange}>(Dec: {d1 * 25} to {d1 * 25 + 24})</span>
                </div>

                <div className={styles.trigramCellGrid}>
                  {[0, 1, 2, 3, 4].map((d2) =>
                    [0, 1, 2, 3, 4].map((d3) => {
                      const dec = d1 * 25 + d2 * 5 + d3;
                      const code = `${d1}${d2}${d3}`;
                      const info = analysisResult.trigrams[dec];
                      const isSelected = activeInspect?.code === code;
                      const bgColor = getHeatmapColor(info);
                      const borderColor = getHeatmapBorder(info);

                      return (
                        <button
                          key={code}
                          type="button"
                          className={`${styles.trigramCellBtn} ${isSelected ? styles.selected : ''}`}
                          style={{
                            backgroundColor: bgColor,
                            borderColor: isSelected ? '#60a5fa' : borderColor,
                          }}
                          onClick={() => setSelectedTrigram(info)}
                        >
                          <span className={`${styles.cellCode} font-mono`}>{code}</span>
                          <span className={styles.cellCount}>{info.count}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Inspector Details Panel */}
          <div className={styles.trigramInspectorSidebar}>
            {activeInspect ? (
              <div className={styles.trigramInspectCard}>
                <div className={styles.inspectHeaderRow}>
                  <div className={styles.inspectTitle}>TRIGRAM INSPECTOR</div>
                  <span className={`${styles.inspectDecBadge} font-mono`}>
                    Dec: {activeInspect.decimal} / 124
                  </span>
                </div>

                <div className={styles.inspectMainDisplay}>
                  <div className={`${styles.inspectCode} font-mono`}>{activeInspect.code}</div>
                  <div className={styles.inspectGlyphsRow}>
                    {renderTrigramGlyphs(activeInspect.code, 20)}
                  </div>
                  <div className={styles.inspectDirsText}>
                    {DIR_NAMES[activeInspect.d1]} - {DIR_NAMES[activeInspect.d2]} - {DIR_NAMES[activeInspect.d3]}
                  </div>
                </div>

                <div className={styles.inspectStatGrid}>
                  <div className={styles.inspectStatItem}>
                    <span className={styles.statLabel}>Total Count</span>
                    <span className={`${styles.statVal} font-mono`}>{activeInspect.count}</span>
                  </div>
                  <div className={styles.inspectStatItem}>
                    <span className={styles.statLabel}>Frequency</span>
                    <span className={`${styles.statVal} font-mono`}>{activeInspect.frequency.toFixed(2)}%</span>
                  </div>
                  <div className={styles.inspectStatItem}>
                    <span className={styles.statLabel}>Uniform Ratio</span>
                    <span className={`${styles.statVal} font-mono`}>
                      {activeInspect.expectedRatio.toFixed(2)}x
                    </span>
                  </div>
                  <div className={styles.inspectStatItem}>
                    <span className={styles.statLabel}>Status</span>
                    <span
                      className={styles.statVal}
                      style={{
                        color:
                          activeInspect.count === 0
                            ? '#ef4444'
                            : activeInspect.expectedRatio >= 1.2
                            ? '#10b981'
                            : '#94a3b8',
                      }}
                    >
                      {activeInspect.count === 0
                        ? 'Missing (0)'
                        : activeInspect.expectedRatio >= 1.2
                        ? 'High Frequency'
                        : activeInspect.expectedRatio <= 0.6
                        ? 'Low Frequency'
                        : 'Near Uniform'}
                    </span>
                  </div>
                </div>

                {/* Occurrence Breakdown across the 9 messages */}
                <div className={styles.inspectBreakdown}>
                  <div className={styles.breakdownTitle}>Occurrences Across Messages:</div>
                  <div className={styles.breakdownList}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((mIdx) => {
                      const count = activeInspect.messageCounts[mIdx] || 0;
                      const isEast = mIdx % 2 === 1;
                      const label = isEast ? `East ${Math.ceil(mIdx / 2)}` : `West ${Math.ceil(mIdx / 2)}`;

                      return (
                        <div key={mIdx} className={styles.breakdownRow}>
                          <span className={styles.breakdownLabel}>
                            Msg {mIdx} ({label}):
                          </span>
                          <span className={`${styles.breakdownVal} font-mono`}>
                            {count > 0 ? <strong>{count}</strong> : <span className="text-dim">0</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Heatmap Legend */}
                <div className={styles.heatmapLegendBox}>
                  <div className={styles.legendLabel}>Color Key (vs Uniform):</div>
                  <div className={styles.legendPills}>
                    <span className={`${styles.legendPill} ${styles.pillZero}`}>0 (Missing)</span>
                    <span className={`${styles.legendPill} ${styles.pillLow}`}>&lt;0.8x</span>
                    <span className={`${styles.legendPill} ${styles.pillMid}`}>~1.0x</span>
                    <span className={`${styles.legendPill} ${styles.pillHigh}`}>&gt;1.5x</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.trigramInspectCard}>
                <p>Click any trigram in the grid to inspect its details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: Full Table & Rankings for Selected Orientation */}
      {activeTab === 'table' && (
        <div className={styles.trigramTableContainer}>
          <div className={styles.tableHeaderControls}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search code (e.g. 010, 22, Up)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className={styles.tableSortActions}>
              <span className={styles.sortLabel}>Sort By:</span>
              <button
                type="button"
                className={`${controls.btnSm} ${sortBy === 'rank' ? controls.active : ''}`}
                onClick={() => {
                  if (sortBy === 'rank') setSortAsc(!sortAsc);
                  else {
                    setSortBy('rank');
                    setSortAsc(false);
                  }
                }}
              >
                Frequency {sortBy === 'rank' ? (sortAsc ? '(Low to High)' : '(High to Low)') : ''}
              </button>
              <button
                type="button"
                className={`${controls.btnSm} ${sortBy === 'code' ? controls.active : ''}`}
                onClick={() => {
                  if (sortBy === 'code') setSortAsc(!sortAsc);
                  else {
                    setSortBy('code');
                    setSortAsc(true);
                  }
                }}
              >
                Code (000-444)
              </button>
              <button
                type="button"
                className={`${controls.btnSm} ${sortBy === 'decimal' ? controls.active : ''}`}
                onClick={() => {
                  if (sortBy === 'decimal') setSortAsc(!sortAsc);
                  else {
                    setSortBy('decimal');
                    setSortAsc(true);
                  }
                }}
              >
                Decimal
              </button>
            </div>
          </div>

          <div className={styles.tableScrollWrapper}>
            <table className={styles.trigramTable}>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Rank</th>
                  <th style={{ width: '80px' }}>Trigram</th>
                  <th style={{ width: '90px' }}>Glyphs</th>
                  <th style={{ width: '80px' }}>Decimal</th>
                  <th style={{ width: '90px' }}>Count</th>
                  <th style={{ width: '100px' }}>Frequency</th>
                  <th style={{ width: '110px' }}>Ratio (vs Uniform)</th>
                  <th>Distribution Bar</th>
                </tr>
              </thead>
              <tbody>
                {tableList.map((t, index) => {
                  const maxCount = sortedTrigrams[0]?.count || 1;
                  const barWidth = Math.max(3, (t.count / maxCount) * 100);

                  return (
                    <tr
                      key={t.code}
                      className={activeInspect?.code === t.code ? 'row-selected' : ''}
                      onClick={() => setSelectedTrigram(t)}
                    >
                      <td className="font-mono text-muted">#{index + 1}</td>
                      <td className="font-mono font-bold">{t.code}</td>
                      <td>{renderTrigramGlyphs(t.code, 13)}</td>
                      <td className="font-mono text-muted">{t.decimal}</td>
                      <td className="font-mono">
                        {t.count === 0 ? (
                          <span className={styles.badgeMissing}>0</span>
                        ) : (
                          <strong>{t.count}</strong>
                        )}
                      </td>
                      <td className="font-mono">{t.frequency.toFixed(2)}%</td>
                      <td className="font-mono">
                        <span
                          style={{
                            color:
                              t.count === 0
                                ? '#ef4444'
                                : t.expectedRatio >= 1.3
                                ? '#10b981'
                                : t.expectedRatio <= 0.6
                                ? '#60a5fa'
                                : '#cbd5e1',
                          }}
                        >
                          {t.expectedRatio.toFixed(2)}x
                        </span>
                      </td>
                      <td>
                        <div className={styles.miniBarTrack}>
                          <div
                            className={styles.miniBarFill}
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor:
                                t.count === 0
                                ? '#ef4444'
                                : t.expectedRatio >= 1.3
                                ? '#10b981'
                                : '#3b82f6',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Compare Orientations Table with Node & Arrows & Permutation Runner */}
      {activeTab === 'compare' && (
        <div className={styles.orientationComparisonView}>
          <div className={styles.comparisonIntroCard}>
            <div className={styles.comparisonCardHeader}>
              <div>
                <h3>Orientation Benchmark & Exhaustive Permutation Explorer</h3>
                <p>
                  Displaying the node and arrow trajectory for each orientation pattern.
                  Click column headers to sort by Entropy, Missing counts, or Chi-Square non-uniformity.
                </p>
              </div>

              {/* Permutation Scanner Controls */}
              <div className={styles.scannerControlBox}>
                {isScanning ? (
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={handleStopScan}
                  >
                    Stop Scan
                  </button>
                ) : (
                  <div className={styles.btnGroupScan}>
                    <button
                      type="button"
                      className={styles.btnActionHighlight}
                      onClick={handleStartProgressiveScan}
                    >
                      {hasScannedAll ? 'Re-run 720 Scan (Slowly)' : 'Run 720 Scan (Progressive)'}
                    </button>
                    <button
                      type="button"
                      className={controls.btnSm}
                      onClick={handleInstantScan}
                      title="Evaluate all 720 permutations immediately"
                    >
                      Fast Scan
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Scan Progress Bar */}
            {isScanning && (
              <div className={styles.scanProgressWrapper}>
                <div className={styles.progressInfo}>
                  <span>Evaluating permutations batch by batch...</span>
                  <span className="font-mono">{scanProgress}% (720 total)</span>
                </div>
                <div className={styles.progressBarTrack}>
                  <div className={styles.progressBarFill} style={{ width: `${scanProgress}%` }} />
                </div>
              </div>
            )}

            {/* Filter Toggle */}
            <div className={styles.comparisonFilterBar}>
              <label className={styles.rawCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={filterViableOnly}
                  onChange={(e) => setFilterViableOnly(e.target.checked)}
                />
                <span>
                  Filter: Viable partial blocks only (excludes 3-in-a-row: 648 permutations)
                </span>
              </label>

              <span className="text-muted font-mono" style={{ marginLeft: 'auto', fontSize: '11px' }}>
                Showing {displayedCompareRows.length} patterns | Active: [[{pattern[0].join(',')}],[{pattern[1].join(',')}]]
              </span>
            </div>
          </div>

          <div className={styles.comparisonTableWrapper}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Node & Arrows</th>
                  {renderSortableTh('pattern', 'Matrix', '110px')}
                  {renderSortableTh('totalTrigrams', 'Total', '70px')}
                  {renderSortableTh('uniqueCount', 'Unique', '85px')}
                  {renderSortableTh('missingCount', 'Missing (0x)', '95px')}
                  {renderSortableTh('entropy', 'Shannon Entropy', '130px')}
                  {renderSortableTh('topCount', 'Top Trigram', '120px')}
                  {renderSortableTh('chiSquare', 'Chi-Square', '95px')}
                  <th style={{ width: '90px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedCompareRows.map((row) => {
                  const isCurrent =
                    row.pattern[0][0] === pattern[0][0] &&
                    row.pattern[0][1] === pattern[0][1] &&
                    row.pattern[0][2] === pattern[0][2] &&
                    row.pattern[1][0] === pattern[1][0] &&
                    row.pattern[1][1] === pattern[1][1] &&
                    row.pattern[1][2] === pattern[1][2];

                  return (
                    <tr
                      key={row.id}
                      className={isCurrent ? 'row-selected' : ''}
                      onClick={() => setPattern(row.pattern)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Node and arrows visual diagram replacing text name */}
                      <td>
                        <div className={styles.tableArrowThumb}>
                          <MiniArrowShape pattern={row.pattern} id={row.id} width={78} height={30} />
                        </div>
                      </td>
                      <td className="font-mono text-muted">
                        [[{row.pattern[0].join(',')}],[{row.pattern[1].join(',')}]]
                      </td>
                      <td className="font-mono">{row.totalTrigrams}</td>
                      <td className="font-mono">{row.uniqueCount} / 125</td>
                      <td className="font-mono">
                        {row.missingCount > 0 ? (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>{row.missingCount}</span>
                        ) : (
                          <span className="text-dim">0</span>
                        )}
                      </td>
                      <td className="font-mono">
                        <strong>{row.entropy.toFixed(3)}</strong> bits
                      </td>
                      <td className="font-mono">
                        <span style={{ color: '#60a5fa', fontWeight: 700 }}>{row.topTrigram}</span> ({row.topCount}x)
                      </td>
                      <td className="font-mono">{row.chiSquare.toFixed(1)}</td>
                      <td>
                        <button
                          type="button"
                          className={`${controls.btnSm} ${isCurrent ? controls.active : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPattern(row.pattern);
                          }}
                        >
                          {isCurrent ? 'Active' : 'Use'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
