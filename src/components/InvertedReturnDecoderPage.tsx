import React, { useState, useMemo } from 'react';
import styles from './InvertedReturnDecoderPage.module.css';
import {
  CANDIDATE_ALPHABETS,
  DEFAULT_DECODER_SETTINGS,
  extractDecimalsForDecoder,
  decodeAllMessages,
  scanForDictionaryWords,
  computeCorpusFrequencies,
  getAlphabetString,
  type DecoderSettings,
} from '../utils/decoderUtils';
import {
  PRESET_ORIENTATIONS,
  type SixEyePattern,
  type EyeInversionSettings,
} from '../utils/orientationExtractor';
import { MiniArrowShape } from './MiniArrowShape';
import { ALL_EYES } from '../data/allEyes';

interface InvertedReturnDecoderPageProps {
  onBackToTopicTwo?: () => void;
  pattern: SixEyePattern;
  onChangePattern: (pattern: SixEyePattern) => void;
  eyeInversion: EyeInversionSettings;
  onChangeEyeInversion: (inversion: EyeInversionSettings) => void;
  stepMode: 'non_overlapping' | 'overlapping';
  onChangeStepMode: (mode: 'non_overlapping' | 'overlapping') => void;
}

export const InvertedReturnDecoderPage: React.FC<InvertedReturnDecoderPageProps> = ({
  onBackToTopicTwo,
  pattern,
  onChangePattern,
  eyeInversion,
  onChangeEyeInversion,
  stepMode,
  onChangeStepMode,
}) => {
  const [settings, setSettings] = useState<DecoderSettings>(DEFAULT_DECODER_SETTINGS);
  const [activeTab, setActiveTab] = useState<'all' | number>('all');
  const [viewMode, setViewMode] = useState<'text' | 'tokens' | 'alignment'>('text');
  const [highlightPreamble, setHighlightPreamble] = useState<boolean>(true);
  const [highlightShared, setHighlightShared] = useState<boolean>(true);
  const [highlightWords, setHighlightWords] = useState<boolean>(true);
  const [highlightInverted, setHighlightInverted] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Pre-extracted corpus data based on active pattern, inversion, and step mode
  const corpusData = useMemo(
    () => extractDecimalsForDecoder(pattern, eyeInversion, stepMode, ALL_EYES),
    [pattern, eyeInversion, stepMode]
  );

  // Decoded messages
  const decodedMessages = useMemo(
    () => decodeAllMessages(settings, corpusData),
    [settings, corpusData]
  );

  // Frequency statistics for active corpus
  const freqStats = useMemo(
    () => computeCorpusFrequencies(settings, corpusData),
    [settings, corpusData]
  );

  // Dictionary scan
  const dictScan = useMemo(
    () => scanForDictionaryWords(decodedMessages),
    [decodedMessages]
  );

  // Current active alphabet string
  const activeAlphabet = useMemo(() => getAlphabetString(settings), [settings]);

  // Active preset match
  const activePreset = PRESET_ORIENTATIONS.find((p) => {
    return (
      p.pattern[0][0] === pattern[0][0] &&
      p.pattern[0][1] === pattern[0][1] &&
      p.pattern[0][2] === pattern[0][2] &&
      p.pattern[1][0] === pattern[1][0] &&
      p.pattern[1][1] === pattern[1][1] &&
      p.pattern[1][2] === pattern[1][2]
    );
  });

  // Handle preset selection
  const handleSelectPreset = (presetId: string) => {
    setSettings((prev) => ({
      ...prev,
      alphabetId: presetId,
    }));
  };

  // Handle Caesar shift adjustment
  const handleShiftChange = (delta: number) => {
    const alphaLen = activeAlphabet.length || 83;
    setSettings((prev) => {
      let next = (prev.caesarShift + delta) % alphaLen;
      if (next < 0) next += alphaLen;
      return { ...prev, caesarShift: next };
    });
  };

  // Copy current decoded text to clipboard
  const handleCopyText = () => {
    let textToCopy = '';
    if (activeTab === 'all') {
      textToCopy = Object.entries(decodedMessages)
        .map(([mIdx, msg]) => `=== Message ${mIdx} (length: ${msg.totalTrigrams}) ===\n${msg.text}\n`)
        .join('\n');
    } else {
      const msg = decodedMessages[activeTab];
      textToCopy = msg ? msg.text : '';
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPerimeterInvertedReturn =
    pattern[0][0] === 1 &&
    pattern[0][1] === 2 &&
    pattern[0][2] === 6 &&
    pattern[1][0] === 3 &&
    pattern[1][1] === 5 &&
    pattern[1][2] === 4;

  return (
    <div className={styles.decoderPageContainer}>
      {/* Header Banner */}
      <div className={styles.decoderHeaderCard}>
        <div className={styles.decoderHeaderTitleRow}>
          <div>
            <h1 className={styles.decoderMainTitle}>Reading Order & Gaze Inversion Decoder</h1>
            <p className={styles.decoderSubtitle}>
              Decode and analyze any sequence created in Trigram Analysis, including reading order presets, custom click orders,
              and observer gaze inversion (such as inverting every other trigram on the return path).
            </p>
          </div>
          <div className={styles.decoderHeaderActions}>
            {onBackToTopicTwo && (
              <button className={styles.decoderBtnSecondary} onClick={onBackToTopicTwo}>
                Back to Trigram Analysis
              </button>
            )}
          </div>
        </div>

        {/* High-Level Corpus Metrics for Active Configuration */}
        <div className={styles.decoderMetricsGrid}>
          <div className={styles.decoderMetricCard}>
            <span className={styles.decoderMetricLabel}>Active Pattern</span>
            <div className={styles.decoderMetricPatternVal}>
              <MiniArrowShape pattern={pattern} width={50} height={20} id="decoder-header-mini" />
              <span className={styles.decoderMetricNumber}>
                [[{pattern[0].join(',')}],[{pattern[1].join(',')}]]
              </span>
            </div>
            <span className={styles.decoderMetricSub}>{activePreset ? activePreset.name : 'Custom Clicked Order'}</span>
          </div>

          <div className={styles.decoderMetricCard}>
            <span className={styles.decoderMetricLabel}>Value Range</span>
            <span className={`${styles.decoderMetricNumber} ${styles.highlightBlue}`}>0 .. {freqStats.maxValObserved}</span>
            <span className={styles.decoderMetricSub}>
              {freqStats.maxValObserved === 82 ? '000_5 to 312_5 (Strict 83)' : '000_5 to 444_5 (Full 125)'}
            </span>
          </div>

          <div className={styles.decoderMetricCard}>
            <span className={styles.decoderMetricLabel}>Unique Values Found</span>
            <span className={`${styles.decoderMetricNumber} ${styles.highlightGreen}`}>
              {freqStats.uniqueCount} / {freqStats.domainSize}
            </span>
            <span className={styles.decoderMetricSub}>
              {freqStats.missingCount > 0 ? `${freqStats.missingCount} values unobserved` : 'All 125 values present'}
            </span>
          </div>

          <div className={styles.decoderMetricCard}>
            <span className={styles.decoderMetricLabel}>Shannon Entropy</span>
            <span className={`${styles.decoderMetricNumber} ${styles.highlightAmber}`}>{freqStats.entropy.toFixed(3)} bits</span>
            <span className={styles.decoderMetricSub}>
              Max: {Math.log2(freqStats.domainSize).toFixed(3)} bits ({((freqStats.entropy / Math.log2(freqStats.domainSize)) * 100).toFixed(1)}%)
            </span>
          </div>

          <div className={styles.decoderMetricCard}>
            <span className={styles.decoderMetricLabel}>Index of Coincidence</span>
            <span className={`${styles.decoderMetricNumber} ${styles.highlightPurple}`}>{freqStats.ic.toFixed(5)}</span>
            <span className={styles.decoderMetricSub}>
              Random: {(1 / freqStats.domainSize).toFixed(5)} | English: 0.0667
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Toolbar: Control Pattern, Gaze Inversion & Step Mode right from Decoder */}
      <div className={styles.decoderSectionCard}>
        <div className={styles.decoderSectionHeader}>
          <h2 className={styles.decoderSectionTitle}>Data Source Configuration</h2>
        </div>
        <p className={styles.decoderSectionDesc}>
          Switch between reading patterns, toggle observer perspective / eye inversion, and change step mode. Changes immediately regenerate the decoded stream below.
        </p>

        <div className={styles.decoderSourceGrid}>
          {/* Orientation Presets */}
          <div className={styles.sourceControlBlock}>
            <label className={styles.decoderFieldLabel}>Reading Order Presets:</label>
            <div className={styles.sourcePresetsRow}>
              {PRESET_ORIENTATIONS.map((preset) => {
                const isActive = activePreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.sourcePresetPill} ${isActive ? styles.active : ''}`}
                    onClick={() => onChangePattern(preset.pattern)}
                    title={preset.description}
                  >
                    <MiniArrowShape pattern={preset.pattern} width={36} height={16} id={`src-${preset.id}`} />
                    <span className={styles.sourcePresetName}>{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observer Perspective / Eye Inversion */}
          <div className={styles.sourceControlBlock}>
            <label className={styles.decoderFieldLabel}>Observer Gaze Inversion:</label>
            <div className={styles.sourceInversionRow}>
              <button
                type="button"
                className={`${styles.sourceBtnToggle} ${eyeInversion.mode === 'none' ? styles.active : ''}`}
                onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'none' })}
              >
                Standard (None)
              </button>
              <button
                type="button"
                className={`${styles.sourceBtnToggle} ${eyeInversion.mode === 'return_only' ? styles.active : ''}`}
                onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'return_only' })}
                title="Invert every other trigram (steps 4, 5, 6 of each 6-eye cell)"
              >
                Invert Return Loop (Steps 4-6)
              </button>
              <button
                type="button"
                className={`${styles.sourceBtnToggle} ${eyeInversion.mode === 'all' ? styles.active : ''}`}
                onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'all' })}
                title="Invert eye directions globally across all eyes"
              >
                Invert All Eyes (180°)
              </button>
            </div>
          </div>

          {/* Step Mode Toggle */}
          <div className={`${styles.sourceControlBlock} ${styles.narrow}`}>
            <label className={styles.decoderFieldLabel}>Step Mode:</label>
            <div className={styles.sourceStepRow}>
              <button
                type="button"
                className={`${styles.sourceBtnToggle} ${stepMode === 'non_overlapping' ? styles.active : ''}`}
                onClick={() => onChangeStepMode('non_overlapping')}
              >
                Non-overlapping (Step 3)
              </button>
              <button
                type="button"
                className={`${styles.sourceBtnToggle} ${stepMode === 'overlapping' ? styles.active : ''}`}
                onClick={() => onChangeStepMode('overlapping')}
              >
                Overlapping (Step 1)
              </button>
            </div>
          </div>
        </div>

        {/* Live Transformation Feedback Strip */}
        <div className={styles.sourceFeedbackBar}>
          <span className={styles.feedbackLabel}>Current Configuration:</span>
          <span className={styles.feedbackDetails}>
            Pattern: <code>[[{pattern[0].join(',')}],[{pattern[1].join(',')}]]</code> | Gaze Inversion:{' '}
            <strong className={styles.highlightAmber}>
              {eyeInversion.mode === 'none' && 'Standard (Right-Side Up)'}
              {eyeInversion.mode === 'return_only' && 'Inverting Every Other Trigram (Steps 4-6: Up<->Down, Left<->Right)'}
              {eyeInversion.mode === 'all' && 'Full 180° Inversion (All Eyes: Up<->Down, Left<->Right)'}
            </strong>{' '}
            | Framing: <strong>{stepMode === 'non_overlapping' ? `Non-overlapping Step 3 (${freqStats.totalCount} trigrams)` : `Overlapping Step 1 (${freqStats.totalCount} trigrams)`}</strong>
          </span>
        </div>
      </div>

      {/* Section 1: Mathematical Context & Proof for Active Combination */}
      <div className={styles.decoderSectionCard}>
        <div className={styles.decoderSectionHeader}>
          <h2 className={styles.decoderSectionTitle}>
            Mathematical Domain Analysis ({freqStats.uniqueCount} Unique Values, Max Decimal {freqStats.maxValObserved})
          </h2>
          <span className={styles.decoderSectionBadge}>Structural Boundary Analysis</span>
        </div>

        {isPerimeterInvertedReturn && eyeInversion.mode === 'none' ? (
          <>
            <p className={styles.decoderSectionDesc}>
              When reading <code>[[1, 2, 6], [3, 5, 4]]</code> with standard eye directions:
              <strong> Trigram 1 = (T0, T1, B0)</strong> and <strong>Trigram 2 = (B2, B1, T2)</strong>.
            </p>

            <div className={styles.decoderProofGrid}>
              <div className={styles.decoderProofCard}>
                <div className={styles.decoderProofCardHeader}>
                  <span className={styles.decoderProofPill}>Leading Slot T0 (Trigram 1)</span>
                </div>
                <p className={styles.decoderProofText}>
                  Slot <strong>T0</strong> (row 0, col 0) direction counts across all 3,108 eyes:
                </p>
                <div className={styles.decoderProofBars}>
                  <div className={styles.decoderProofBarRow}>
                    <span className={styles.barLabel}>Val 0 (Center):</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '33.4%' }} /></div>
                    <span className={styles.barCount}>173</span>
                  </div>
                  <div className={styles.decoderProofBarRow}>
                    <span className={styles.barLabel}>Val 1 (Up):</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '28.9%' }} /></div>
                    <span className={styles.barCount}>150</span>
                  </div>
                  <div className={styles.decoderProofBarRow}>
                    <span className={styles.barLabel}>Val 2 (Right):</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '28.9%' }} /></div>
                    <span className={styles.barCount}>150</span>
                  </div>
                  <div className={styles.decoderProofBarRow}>
                    <span className={styles.barLabel}>Val 3 (Down):</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '9.1%' }} /></div>
                    <span className={styles.barCount}>47</span>
                  </div>
                  <div className={`${styles.decoderProofBarRow} ${styles.highlightZero}`}>
                    <span className={styles.barLabel}>Val 4 (Left):</span>
                    <div className={styles.barTrack}><div className={`${styles.barFill} ${styles.zeroFill}`} style={{ width: '0%' }} /></div>
                    <span className={`${styles.barCount} ${styles.boldRed}`}>0 (NEVER OCCURS)</span>
                  </div>
                </div>
              </div>

              <div className={styles.decoderProofCard}>
                <div className={styles.decoderProofCardHeader}>
                  <span className={styles.decoderProofPill}>Leading Slot B2 (Trigram 2)</span>
                </div>
                <p className={styles.decoderProofText}>
                  Slot <strong>B2</strong> (row 1, col 2) direction counts across all 3,108 eyes:
                </p>
                <div className={styles.decoderProofBars}>
                  <div className={styles.decoderProofBarRow}>
                    <span className={styles.barLabel}>Val 0 (Center):</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '27.9%' }} /></div>
                    <span className={styles.barCount}>144</span>
                  </div>
                  <div className={styles.decoderProofBarRow}>
                    <span className={styles.barLabel}>Val 1 (Up):</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '31.4%' }} /></div>
                    <span className={styles.barCount}>162</span>
                  </div>
                  <div className={styles.decoderProofBarRow}>
                    <span className={styles.barLabel}>Val 2 (Right):</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '31.0%' }} /></div>
                    <span className={styles.barCount}>160</span>
                  </div>
                  <div className={styles.decoderProofBarRow}>
                    <span className={styles.barLabel}>Val 3 (Down):</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '9.7%' }} /></div>
                    <span className={styles.barCount}>50</span>
                  </div>
                  <div className={`${styles.decoderProofBarRow} ${styles.highlightZero}`}>
                    <span className={styles.barLabel}>Val 4 (Left):</span>
                    <div className={styles.barTrack}><div className={`${styles.barFill} ${styles.zeroFill}`} style={{ width: '0%' }} /></div>
                    <span className={`${styles.barCount} ${styles.boldRed}`}>0 (NEVER OCCURS)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.decoderProofSummaryBox}>
              <div className={styles.summaryIcon}>i</div>
              <div>
                <strong>83-Value Phenomenon:</strong> Because entry slots T0 and B2 both lack value 4, no trigram starts with 4.
                When the first digit is 3, the subsequent two values never exceed (1, 2).
                Thus, the maximum decimal generated is exactly <strong>312 base 5 = 82</strong>.
                All 83 values from 0 to 82 appear between 3 and 26 times, while 83 through 124 appear exactly 0 times.
              </div>
            </div>
          </>
        ) : isPerimeterInvertedReturn && eyeInversion.mode === 'return_only' ? (
          <div className={`${styles.decoderProofSummaryBox} ${styles.highlightAmberBox}`}>
            <div className={styles.summaryIcon}>i</div>
            <div>
              <strong>Inverting Every Other Trigram (Return Steps 4-6):</strong>
              On the return path (Trigram 2), eyes are viewed upside down: <code>Up (1) &lt;-&gt; Down (3)</code> and{' '}
              <code>Right (2) &lt;-&gt; Left (4)</code>. Slot B2 (which originally contained 160 Right gazes) transforms into 160 Left gazes (value 4).
              Because the return trigram now has leading digit 4, trigrams up to <strong>444 base 5 = 124</strong> appear in the stream.
              This expands the observed vocabulary to the <strong>full 125 trigram states (range 0..124)</strong> with 0 missing trigrams!
            </div>
          </div>
        ) : isPerimeterInvertedReturn && eyeInversion.mode === 'all' ? (
          <div className={styles.decoderProofSummaryBox}>
            <div className={styles.summaryIcon}>i</div>
            <div>
              <strong>Full 180° Inversion:</strong>
              Swapping Up &lt;-&gt; Down and Left &lt;-&gt; Right across all eyes preserves exactly <strong>83 unique values</strong>.
              However, because T0 and B2 originally had 0 'Left' (4) gazes, under inversion they now have 0 'Right' (2) gazes.
              Consequently, no trigram starts with 2, shifting the unobserved band from 83..124 to values starting with 2 (decimals 50..74).
            </div>
          </div>
        ) : (
          <div className={styles.decoderProofSummaryBox}>
            <div className={styles.summaryIcon}>i</div>
            <div>
              <strong>Active Traversal Domain:</strong>
              The current reading order produces {freqStats.totalCount} trigrams across the stones, covering{' '}
              <strong>{freqStats.uniqueCount} unique values</strong> with maximum decimal{' '}
              <strong>{freqStats.maxValObserved}</strong>.
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Interactive Decoder Sandbox */}
      <div className={styles.decoderSectionCard}>
        <div className={styles.decoderSectionHeader}>
          <h2 className={styles.decoderSectionTitle}>Interactive Mapping Sandbox</h2>
          <span className={styles.decoderSectionBadge}>Alphabet Substitution & Modular Shifts</span>
        </div>
        <p className={styles.decoderSectionDesc}>
          Select or configure an alphabet, apply Caesar shifts or affine transformations, and observe the live decoded message streams.
        </p>

        {/* Candidate Alphabet Selector Buttons */}
        <div className={styles.decoderAlphabetSelectorGroup}>
          <label className={styles.decoderFieldLabel}>Candidate Alphabets (83 & 125 Domains):</label>
          <div className={styles.decoderPresetGrid}>
            {CANDIDATE_ALPHABETS.map((alpha) => (
              <button
                key={alpha.id}
                className={`${styles.decoderPresetBtn} ${settings.alphabetId === alpha.id ? styles.active : ''}`}
                onClick={() => handleSelectPreset(alpha.id)}
              >
                <div className={styles.presetBtnName}>{alpha.name}</div>
                <div className={styles.presetBtnDesc}>{alpha.description}</div>
              </button>
            ))}
            <button
              className={`${styles.decoderPresetBtn} ${settings.alphabetId === 'custom' ? styles.active : ''}`}
              onClick={() => handleSelectPreset('custom')}
            >
              <div className={styles.presetBtnName}>Custom Alphabet</div>
              <div className={styles.presetBtnDesc}>User-defined mapping string of any length</div>
            </button>
          </div>
        </div>

        {/* Custom Alphabet Editor (when active) */}
        {settings.alphabetId === 'custom' && (
          <div className={styles.decoderCustomEditorBox}>
            <div className={styles.customEditorHeader}>
              <label className={styles.decoderFieldLabel}>Custom Alphabet String:</label>
              <span className={`${styles.customLengthBadge} ${styles.valid}`}>
                {settings.customAlphabet.length} characters
              </span>
            </div>
            <textarea
              className={styles.decoderCustomTextarea}
              value={settings.customAlphabet}
              rows={2}
              onChange={(e) => setSettings((prev) => ({ ...prev, customAlphabet: e.target.value }))}
              placeholder="Paste or enter custom characters..."
            />
          </div>
        )}

        {/* Transformation Controls */}
        <div className={styles.decoderControlsRow}>
          {/* Caesar Shift Slider */}
          <div className={styles.decoderControlItem}>
            <div className={styles.controlItemHeader}>
              <span className={styles.decoderFieldLabel}>Caesar Shift Modulo {activeAlphabet.length}:</span>
              <span className={`${styles.controlItemValue} ${styles.highlightBlue}`}>+{settings.caesarShift}</span>
            </div>
            <div className={styles.sliderRow}>
              <button className={styles.shiftNudgeBtn} onClick={() => handleShiftChange(-1)}>-1</button>
              <input
                type="range"
                min="0"
                max={Math.max(activeAlphabet.length - 1, 1)}
                value={settings.caesarShift}
                onChange={(e) => setSettings((prev) => ({ ...prev, caesarShift: Number(e.target.value) }))}
                className={styles.decoderSlider}
              />
              <button className={styles.shiftNudgeBtn} onClick={() => handleShiftChange(1)}>+1</button>
              <button
                className={styles.shiftResetBtn}
                onClick={() => setSettings((prev) => ({ ...prev, caesarShift: 0 }))}
                disabled={settings.caesarShift === 0}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Affine Multiplier */}
          <div className={styles.decoderControlItem}>
            <div className={styles.controlItemHeader}>
              <span className={styles.decoderFieldLabel}>Affine Multiplier:</span>
              <span className={`${styles.controlItemValue} ${styles.highlightPurple}`}>a = {settings.affineMultiplier}</span>
            </div>
            <div className={styles.affineBtnRow}>
              {[1, 2, 3, 5, 7, 11, 13, 17, 19, 41].map((mult) => (
                <button
                  key={mult}
                  className={`${styles.affinePill} ${settings.affineMultiplier === mult ? '${styles.active}' : ''}`}
                  onClick={() => setSettings((prev) => ({ ...prev, affineMultiplier: mult }))}
                >
                  x{mult}
                </button>
              ))}
            </div>
          </div>

          {/* Reverse Mapping & Modulo Wrap Toggles */}
          <div className={`${styles.decoderControlItem} ${styles.narrow}`}>
            <span className={styles.decoderFieldLabel}>Mapping Mode:</span>
            <div className={styles.decoderTogglesCol}>
              <button
                className={`${styles.reverseToggleBtn} ${settings.reverseMapping ? styles.active : ''}`}
                onClick={() => setSettings((prev) => ({ ...prev, reverseMapping: !prev.reverseMapping }))}
              >
                {settings.reverseMapping ? 'Reversed' : 'Forward (0 -> N)'}
              </button>
              <label className={styles.decoderWrapCheckbox}>
                <input
                  type="checkbox"
                  checked={settings.wrapModulo}
                  onChange={(e) => setSettings((prev) => ({ ...prev, wrapModulo: e.target.checked }))}
                />
                Wrap Modulo Alphabet Length ({activeAlphabet.length})
              </label>
            </div>
          </div>
        </div>

        {/* Live Dictionary Match Badge */}
        <div className={styles.decoderDictBanner}>
          <div className={styles.dictBannerLeft}>
            <span className={styles.dictBannerTitle}>Automated Dictionary Scanner:</span>
            <span className={`${styles.dictBadge} ${dictScan.totalMatches > 0 ? '${styles.found}' : '${styles.zero}'}`}>
              {dictScan.totalMatches} matches found
            </span>
          </div>
          <div className={styles.dictBannerInfo}>
            {dictScan.totalMatches > 0 ? (
              <span className={styles.dictMatchesList}>
                Words found: {dictScan.matches.map((m) => `"${m.word}" (Msg ${m.messageIndex})`).join(', ')}
              </span>
            ) : (
              <span className={styles.dictZeroNote}>
                No coherent English or Finnish dictionary words detected in the current mapping.
              </span>
            )}
          </div>
        </div>

        {/* Alphabet Mapping Ribbon */}
        <div className={styles.decoderRibbonContainer}>
          <div className={styles.ribbonTitleRow}>
            <span className={styles.ribbonTitle}>
              Current Alphabet Mapping Table ({activeAlphabet.length} Characters, Indices 0 .. {freqStats.domainSize - 1}):
            </span>
            <span className={styles.ribbonSub}>Scroll horizontally to inspect each mapping</span>
          </div>
          <div className={styles.decoderRibbonScroll}>
            {freqStats.frequencies.map((freq) => (
              <div key={freq.val} className={styles.ribbonCell}>
                <span className={styles.cellDec}>{freq.val}</span>
                <span className={styles.cellQui}>{freq.quinary}</span>
                <span className={styles.cellChar}>{freq.char === ' ' ? 'SPC' : freq.char}</span>
                <span className={styles.cellCount}>{freq.count}x</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Decoded Message Viewer */}
      <div className={styles.decoderSectionCard}>
        <div className={styles.decoderSectionHeader}>
          <h2 className={styles.decoderSectionTitle}>Decoded Message Streams</h2>
          <div className={styles.viewerHeaderControls}>
            <div className={styles.viewModeToggle}>
              <button
                className={`${styles.viewBtn} ${viewMode === 'text' ? styles.active : ''}`}
                onClick={() => setViewMode('text')}
              >
                Text View
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === 'tokens' ? styles.active : ''}`}
                onClick={() => setViewMode('tokens')}
              >
                Token Inspector
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === 'alignment' ? styles.active : ''}`}
                onClick={() => setViewMode('alignment')}
              >
                Alignment Comparison
              </button>
            </div>
            <button className={styles.copyBtn} onClick={handleCopyText}>
              {copied ? 'Copied!' : 'Copy Stream'}
            </button>
          </div>
        </div>

        {/* Message Tabs */}
        {viewMode !== 'alignment' && (
          <div className={styles.decoderMessageTabs}>
            <button
              className={`${styles.msgTab} ${activeTab === 'all' ? '${styles.active}' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Messages (1..9)
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((mIdx) => (
              <button
                key={mIdx}
                className={`${styles.msgTab} ${activeTab === mIdx ? '${styles.active}' : ''}`}
                onClick={() => setActiveTab(mIdx)}
              >
                Msg {mIdx} ({decodedMessages[mIdx]?.totalTrigrams ?? 0})
              </button>
            ))}
          </div>
        )}

        {/* Highlighting Options */}
        <div className={styles.decoderHighlightBar}>
          <span className={styles.highlightBarLabel}>Highlight Layers:</span>
          <label className={styles.highlightToggle}>
            <input
              type="checkbox"
              checked={highlightPreamble}
              onChange={(e) => setHighlightPreamble(e.target.checked)}
            />
            <span className={`${styles.legendBox} ${styles.preambleBg}`} />
            Universal Preamble (Trigrams 1-2)
          </label>
          <label className={styles.highlightToggle}>
            <input
              type="checkbox"
              checked={highlightShared}
              onChange={(e) => setHighlightShared(e.target.checked)}
            />
            <span className={`${styles.legendBox} ${styles.sharedBg}`} />
            Shared Substrings (Msgs 1-3 & 7-9)
          </label>
          <label className={styles.highlightToggle}>
            <input
              type="checkbox"
              checked={highlightWords}
              onChange={(e) => setHighlightWords(e.target.checked)}
            />
            <span className={`${styles.legendBox} ${styles.headerBg}`} />
            Message Header (Trigram 0)
          </label>
          <label className={styles.highlightToggle}>
            <input
              type="checkbox"
              checked={highlightInverted}
              onChange={(e) => setHighlightInverted(e.target.checked)}
            />
            <span className={`${styles.legendBox} ${styles.invertedBg}`} />
            Inverted Return Tokens
          </label>
        </div>

        {/* View Mode 1: Plain Monospace Text */}
        {viewMode === 'text' && (
          <div className={styles.decoderTextDisplayBox}>
            {activeTab === 'all' ? (
              Object.entries(decodedMessages).map(([mIdx, msg]) => (
                <div key={mIdx} className={styles.msgTextBlock}>
                  <div className={styles.msgTextHeader}>
                    <span className={styles.msgTitle}>Message {mIdx}</span>
                    <span className={styles.msgInfo}>
                      {msg.totalTrigrams} trigrams | Header Byte: <code>{msg.firstTrigramHeader}</code>
                    </span>
                  </div>
                  <pre className={styles.msgPreText}>{msg.text}</pre>
                </div>
              ))
            ) : (
              <div className={styles.msgTextBlock}>
                <div className={styles.msgTextHeader}>
                  <span className={styles.msgTitle}>Message {activeTab}</span>
                  <span className={styles.msgInfo}>
                    {decodedMessages[activeTab]?.totalTrigrams} trigrams | Header Byte:{' '}
                    <code>{decodedMessages[activeTab]?.firstTrigramHeader}</code>
                  </span>
                </div>
                <pre className={styles.msgPreText}>{decodedMessages[activeTab]?.text}</pre>
              </div>
            )}
          </div>
        )}

        {/* View Mode 2: Token Inspector */}
        {viewMode === 'tokens' && (
          <div className={styles.decoderTokensDisplayBox}>
            {(activeTab === 'all'
              ? Object.values(decodedMessages).flatMap((m) => m.items)
              : decodedMessages[activeTab]?.items || []
            ).map((item, idx) => {
              const isHeader = item.index === 0 && highlightWords;
              const isPreamble = item.isHeaderPreamble && highlightPreamble;
              const isShared = item.isSharedPrefix && highlightShared;
              const isInvertedItem = item.isInverted && highlightInverted;

              let extraClass = '';
              if (isHeader) extraClass = 'token-header';
              else if (isPreamble) extraClass = 'token-preamble';
              else if (isShared) extraClass = 'token-shared';
              else if (isInvertedItem) extraClass = 'token-inverted-item';

              return (
                <div key={`${item.messageIndex}-${item.index}-${idx}`} className={`${styles.tokenBadge} ${extraClass}`}>
                  <span className={styles.tokenChar}>{item.char === ' ' ? 'SPC' : item.char}</span>
                  <span className={styles.tokenDec}>{item.trigramDecimal}</span>
                  <span className={styles.tokenQui}>{item.quinaryCode}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* View Mode 3: Alignment Comparison */}
        {viewMode === 'alignment' && (
          <div className={styles.decoderAlignmentBox}>
            <div className={styles.alignmentSection}>
              <h3 className={styles.alignmentTitle}>Cluster 1: Messages 1, 2, 3</h3>
              <p className={styles.alignmentDesc}>
                Aligned comparison of the first 25 trigrams across Messages 1, 2, and 3:
              </p>
              <div className={styles.alignmentTableWrapper}>
                <table className={styles.alignmentTable}>
                  <thead>
                    <tr>
                      <th>Idx</th>
                      {Array.from({ length: 25 }, (_, i) => (
                        <th key={i}>{i}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((mIdx) => {
                      const msg = decodedMessages[mIdx];
                      return (
                        <tr key={mIdx}>
                          <td className={styles.rowMsgLabel}>Msg {mIdx}</td>
                          {msg?.items.slice(0, 25).map((item) => (
                            <td
                              key={item.index}
                              className={`${styles.alignCell} ${
                                item.index === 0
                                  ? styles.cellHeader
                                  : item.index <= 2
                                  ? styles.cellPreamble
                                  : styles.cellShared
                              }`}
                            >
                              <div className={styles.cellValChar}>{item.char}</div>
                              <div className={styles.cellValDec}>{item.trigramDecimal}</div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.alignmentSection}>
              <h3 className={styles.alignmentTitle}>Cluster 2: Messages 7, 8, 9</h3>
              <p className={styles.alignmentDesc}>
                Aligned comparison of the first 21 trigrams across Messages 7, 8, and 9:
              </p>
              <div className={styles.alignmentTableWrapper}>
                <table className={styles.alignmentTable}>
                  <thead>
                    <tr>
                      <th>Idx</th>
                      {Array.from({ length: 21 }, (_, i) => (
                        <th key={i}>{i}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[7, 8, 9].map((mIdx) => {
                      const msg = decodedMessages[mIdx];
                      return (
                        <tr key={mIdx}>
                          <td className={styles.rowMsgLabel}>Msg {mIdx}</td>
                          {msg?.items.slice(0, 21).map((item) => (
                            <td
                              key={item.index}
                              className={`${styles.alignCell} ${
                                item.index === 0
                                  ? styles.cellHeader
                                  : item.index <= 2
                                  ? styles.cellPreamble
                                  : styles.cellSharedCluster2
                              }`}
                            >
                              <div className={styles.cellValChar}>{item.char}</div>
                              <div className={styles.cellValDec}>{item.trigramDecimal}</div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Cryptanalytic Evaluation for Active Combination */}
      <div className={styles.decoderSectionCard}>
        <div className={styles.decoderSectionHeader}>
          <h2 className={styles.decoderSectionTitle}>Cryptanalytic Evaluation for Active Configuration</h2>
          <span className={styles.verdictPillRuledOut}>Verdict: Obvious Straight Mapping Ruled Out</span>
        </div>
        <p className={styles.decoderSectionDesc}>
          Statistical characteristics of the stream generated by this pattern and gaze inversion:
        </p>

        <div className={styles.verdictPillarsGrid}>
          <div className={styles.verdictPillarCard}>
            <div className={styles.pillarNum}>1</div>
            <h4 className={styles.pillarTitle}>Flat Shannon Entropy ({freqStats.entropy.toFixed(3)} bits)</h4>
            <p className={styles.pillarBody}>
              The corpus entropy is <strong>{freqStats.entropy.toFixed(3)} bits</strong>, nearly matching the uniform theoretical ceiling of{' '}
              <strong>{Math.log2(freqStats.domainSize).toFixed(3)} bits</strong> ({((freqStats.entropy / Math.log2(freqStats.domainSize)) * 100).toFixed(1)}%).
              Natural language plaintext has entropy around 4.0 - 4.5 bits due to letter clustering. A straight monoalphabetic mapping preserves entropy identically.
            </p>
          </div>

          <div className={styles.verdictPillarCard}>
            <div className={styles.pillarNum}>2</div>
            <h4 className={styles.pillarTitle}>Random-Level Index of Coincidence ({freqStats.ic.toFixed(5)})</h4>
            <p className={styles.pillarBody}>
              The Index of Coincidence (IC) is <strong>{freqStats.ic.toFixed(5)}</strong>, matching uniform randomness (
              <code>1/{freqStats.domainSize} = {(1 / freqStats.domainSize).toFixed(5)}</code>). Natural English IC is ~0.0667, and Finnish is ~0.0740.
              Because monoalphabetic substitution cannot alter IC, simple straight translation into words is ruled out.
            </p>
          </div>

          <div className={styles.verdictPillarCard}>
            <div className={styles.pillarNum}>3</div>
            <h4 className={styles.pillarTitle}>Lexical Matching</h4>
            <p className={styles.pillarBody}>
              Automated scans across English and Finnish vocabularies produced at most {dictScan.totalMatches} matches, consistent with random noise expectation.
            </p>
          </div>

          <div className={styles.verdictPillarCard}>
            <div className={styles.pillarNum}>4</div>
            <h4 className={styles.pillarTitle}>Multi-Layered Architecture</h4>
            <p className={styles.pillarBody}>
              The structural alignment (variable header byte at index 0 followed by invariant preamble and long aligned blocks) indicates
              a multi-layered cipher (e.g., polyalphabetic Vigenère keyed by index 0, running key, or bitwise quinary subtraction).
            </p>
          </div>
        </div>

        {/* Value Frequency Distribution Chart */}
        <div className={styles.decoderFreqChartBox}>
          <div className={styles.freqChartHeader}>
            <h4 className={styles.freqChartTitle}>
              Frequency Distribution of Values (0 to {freqStats.domainSize - 1}):
            </h4>
            <span className={styles.freqChartSub}>
              Total Trigrams: {freqStats.totalCount} | Min Count: {freqStats.minCount} | Max Count: {freqStats.maxCount}
            </span>
          </div>
          <div className={styles.freqBarsContainer}>
            {freqStats.frequencies.map((item) => {
              const heightPct = freqStats.maxCount > 0 ? (item.count / freqStats.maxCount) * 100 : 0;
              return (
                <div
                  key={item.val}
                  className={styles.freqBarCol}
                  title={`Val ${item.val} (${item.quinary}): count ${item.count} (${item.pct.toFixed(1)}%) -> '${item.char}'`}
                >
                  <div className={styles.barTrackVertical}>
                    <div className={styles.barFillVertical} style={{ height: `${heightPct}%` }} />
                  </div>
                  <span className={styles.barColLabel}>{item.val}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
