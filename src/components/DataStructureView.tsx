import React, { useState, useMemo } from 'react';
import styles from './DataStructureView.module.css';
import controls from '../styles/controls.module.css';
import {
  formatRawEyeText,
  formatSpatialEntities,
  type EyeTextOrder,
  type EyeTextSpacing,
  type EyeTextArrangement,
  type SpatialFormatMode,
  type TrigramOutputOrder,
} from '../utils/trigramUtils';
import {
  PRESET_ORIENTATIONS,
  analyzeTrigramsForOrientation,
  formatTrigramsOutputWithOrientation,
  type SixEyePattern,
} from '../utils/orientationExtractor';
import { ALL_EYES } from '../data/allEyes';

interface DataStructureViewProps {
  onGoToTrigramAnalysis?: () => void;
}

export const DataStructureView: React.FC<DataStructureViewProps> = ({ onGoToTrigramAnalysis }) => {
  // Section 1 State: Raw Eye Text
  const [textArrangement, setTextArrangement] = useState<EyeTextArrangement>('real_rows');
  const [textOrder, setTextOrder] = useState<EyeTextOrder>('noitaeye');
  const [textSpacing, setTextSpacing] = useState<EyeTextSpacing>('none');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showRowNumbers, setShowRowNumbers] = useState<boolean>(false);
  const [textMessageFilter, setTextMessageFilter] = useState<'all' | number>('all');
  const [textCopied, setTextCopied] = useState<boolean>(false);

  // Section 2 State: Spatial Entities
  const [spatialScope, setSpatialScope] = useState<'all' | 'east' | 'west' | number>('all');
  const [spatialFormat, setSpatialFormat] = useState<SpatialFormatMode>('json_pretty');
  const [spatialCopied, setSpatialCopied] = useState<boolean>(false);

  // Section 3 State: Trigrams & Orientation
  const [trigramOrientationId, setTrigramOrientationId] = useState<string>('zigzag_down_up');
  const [trigramOrder, setTrigramOrder] = useState<TrigramOutputOrder>('freq_desc');
  const [trigramMode, setTrigramMode] = useState<'overlapping' | 'non_overlapping'>('non_overlapping');
  const [trigramMessageFilter, setTrigramMessageFilter] = useState<'all' | number>('all');
  const [includeZeroCounts, setIncludeZeroCounts] = useState<boolean>(true);
  const [trigramCopied, setTrigramCopied] = useState<boolean>(false);

  const activeOrientation = useMemo(() => {
    return (
      PRESET_ORIENTATIONS.find((p) => p.id === trigramOrientationId) || PRESET_ORIENTATIONS[0]
    );
  }, [trigramOrientationId]);

  const activePattern: SixEyePattern = activeOrientation.pattern;

  // Computed data for Section 1
  const rawEyeText = useMemo(() => {
    return formatRawEyeText({
      order: textOrder,
      spacing: textSpacing,
      arrangement: textArrangement,
      showRowNumbers,
      showLabels,
      messageFilter: textMessageFilter,
    });
  }, [textOrder, textSpacing, textArrangement, showRowNumbers, showLabels, textMessageFilter]);

  // Computed data for Section 2
  const spatialText = useMemo(() => {
    return formatSpatialEntities({
      scope: spatialScope,
      format: spatialFormat,
    });
  }, [spatialScope, spatialFormat]);

  // Computed data for Section 3 (orientation-aware!)
  const trigramText = useMemo(() => {
    return formatTrigramsOutputWithOrientation(activePattern, {
      mode: trigramMode,
      messageFilter: trigramMessageFilter,
      order: trigramOrder,
      includeZeroCounts,
    });
  }, [activePattern, trigramMode, trigramMessageFilter, trigramOrder, includeZeroCounts]);

  const trigramStats = useMemo(() => {
    return analyzeTrigramsForOrientation(activePattern, {
      mode: trigramMode,
      messageFilter: trigramMessageFilter,
    });
  }, [activePattern, trigramMode, trigramMessageFilter]);

  // Copy helper
  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download helper
  const handleDownload = (text: string, filename: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.rawDataPage}>
      {/* SECTION 1: Raw Text of Eye Sections */}
      <section className={styles.rawSectionCard}>
        <div className={styles.rawSectionHeader}>
          <div>
            <h2 className={styles.rawSectionTitle}>1. Raw Eye Digit Sequences</h2>
            <p className={styles.rawSectionDesc}>
              Extracted quinary digits (0, 1, 2, 3, 4) representing eye gaze directions from the stone inscriptions.
              Output digits formatted with newlines matching the physical 2D rows of the real eye stones, or as flat 1D sequences.
            </p>
          </div>
          <div className={styles.rawActions}>
            <button
              type="button"
              className={`${styles.btnActionCopy} ${textCopied ? styles.copied : ''}`}
              onClick={() => handleCopy(rawEyeText, setTextCopied)}
            >
              {textCopied ? 'Copied' : 'Copy Text'}
            </button>
            <button
              type="button"
              className={styles.btnActionDownload}
              onClick={() => handleDownload(rawEyeText, 'noita_eyes_raw_digits.txt', 'text/plain')}
            >
              Download (.txt)
            </button>
          </div>
        </div>

        {/* Section 1 Controls Toolbar */}
        <div className={styles.rawControlsBar}>
          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Arrangement:</span>
            <select
              className={controls.selectDropdown}
              value={textArrangement}
              onChange={(e) => setTextArrangement(e.target.value as EyeTextArrangement)}
            >
              <option value="real_rows">Real Eye Rows (Newlines as on stone)</option>
              <option value="real_rows_staggered">Real Eye Rows (Staggered hex grid)</option>
              <option value="flat">Flat Stream (1 line per message)</option>
            </select>
          </div>

          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Order:</span>
            <select
              className={controls.selectDropdown}
              value={textOrder}
              onChange={(e) => setTextOrder(e.target.value as EyeTextOrder)}
            >
              <option value="noitaeye">noitaeye.txt (Interleaved East/West)</option>
              <option value="east_west">Stone Order (East 1..5, West 1..4)</option>
              <option value="west_east">West First (West 1..4, East 1..5)</option>
              <option value="concatenated">Single Continuous Stream</option>
            </select>
          </div>

          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Scope:</span>
            <select
              className={controls.selectDropdown}
              value={textMessageFilter}
              onChange={(e) => {
                const val = e.target.value;
                setTextMessageFilter(val === 'all' ? 'all' : Number(val));
              }}
            >
              <option value="all">All 9 Messages (3,108 glyphs)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <option key={num} value={num}>
                  Message {num} ({num % 2 === 1 ? `East ${Math.ceil(num / 2)}` : `West ${Math.ceil(num / 2)}`})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Grouping:</span>
            <select
              className={controls.selectDropdown}
              value={textSpacing}
              onChange={(e) => setTextSpacing(e.target.value as EyeTextSpacing)}
            >
              <option value="none">None (Continuous digits)</option>
              <option value="triplet">Quinary Triplets (Groups of 3)</option>
              <option value="quinary_group">Groups of 5</option>
              {textArrangement === 'flat' && (
                <option value="double_newlines">Double Newlines between messages</option>
              )}
            </select>
          </div>

          <label className={styles.rawCheckboxLabel}>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            <span>Show Section Headers</span>
          </label>

          {(textArrangement === 'real_rows' || textArrangement === 'real_rows_staggered') && (
            <label className={styles.rawCheckboxLabel}>
              <input
                type="checkbox"
                checked={showRowNumbers}
                onChange={(e) => setShowRowNumbers(e.target.checked)}
              />
              <span>Show Row Numbers</span>
            </label>
          )}
        </div>

        {/* Section 1 Scrollable Textbox */}
        <div className={styles.rawTextboxWrapper}>
          <textarea
            readOnly
            className={`${styles.rawTextbox} font-mono`}
            value={rawEyeText}
            rows={14}
            spellCheck={false}
          />
          <div className={styles.rawTextboxFooter}>
            <span>
              Length: <strong>{rawEyeText.length}</strong> characters | Digits: <strong>3,108</strong> total | Format: Base-5 | Layout: <strong>{textArrangement === 'flat' ? 'Flat Stream' : (textArrangement === 'real_rows_staggered' ? 'Real Eye Rows (Staggered Hex Grid)' : 'Real Eye Rows (Stone Matrix Rows)')}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 2: Spatial Entities (2D Coordinates) */}
      <section className={styles.rawSectionCard}>
        <div className={styles.rawSectionHeader}>
          <div>
            <h2 className={styles.rawSectionTitle}>2. Spatial Entities & Geometric Coordinates</h2>
            <p className={styles.rawSectionDesc}>
              Geometric coordinate objects (EyeGlyph) containing pixel centroids (cx, cy), hexagonal grid rows and columns,
              direction vectors, stone boundaries, and line indices.
            </p>
          </div>
          <div className={styles.rawActions}>
            <button
              type="button"
              className={`${styles.btnActionCopy} ${spatialCopied ? styles.copied : ''}`}
              onClick={() => handleCopy(spatialText, setSpatialCopied)}
            >
              {spatialCopied ? 'Copied' : 'Copy Data'}
            </button>
            <button
              type="button"
              className={styles.btnActionDownload}
              onClick={() =>
                handleDownload(
                  spatialText,
                  spatialFormat === 'csv' ? 'noita_eyes_spatial.csv' : 'noita_eyes_spatial.json',
                  spatialFormat === 'csv' ? 'text/csv' : 'application/json'
                )
              }
            >
              Download ({spatialFormat === 'csv' ? '.csv' : '.json'})
            </button>
          </div>
        </div>

        {/* Section 2 Controls Toolbar */}
        <div className={styles.rawControlsBar}>
          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Scope:</span>
            <select
              className={controls.selectDropdown}
              value={spatialScope}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all' || val === 'east' || val === 'west') {
                  setSpatialScope(val);
                } else {
                  setSpatialScope(Number(val));
                }
              }}
            >
              <option value="all">All 3,108 Glyphs</option>
              <option value="east">East Stone Only (1,661 glyphs)</option>
              <option value="west">West Stone Only (1,447 glyphs)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <option key={num} value={num}>
                  Message {num} ({num % 2 === 1 ? `East ${Math.ceil(num / 2)}` : `West ${Math.ceil(num / 2)}`})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Format:</span>
            <select
              className={controls.selectDropdown}
              value={spatialFormat}
              onChange={(e) => setSpatialFormat(e.target.value as SpatialFormatMode)}
            >
              <option value="json_pretty">JSON (Formatted 2-space)</option>
              <option value="json_compact">JSON (Compact one-line per entity)</option>
              <option value="tuples">Coordinate Tuples [cx, cy, val]</option>
              <option value="csv">CSV (Comma-separated values)</option>
            </select>
          </div>
        </div>

        {/* Section 2 Scrollable Textbox */}
        <div className={styles.rawTextboxWrapper}>
          <textarea
            readOnly
            className={`${styles.rawTextbox} font-mono`}
            value={spatialText}
            rows={12}
            spellCheck={false}
          />
          <div className={styles.rawTextboxFooter}>
            <span>
              Total Dataset: <strong>{ALL_EYES.length}</strong> glyphs | Size: ~<strong>{(spatialText.length / 1024).toFixed(1)} KB</strong>
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 3: Quinary Trigrams */}
      <section className={styles.rawSectionCard}>
        <div className={styles.rawSectionHeader}>
          <div>
            <h2 className={styles.rawSectionTitle}>3. Quinary Trigrams (Orientation-Aware)</h2>
            <p className={styles.rawSectionDesc}>
              All 125 possible quinary permutations (000 to 444) mapped to base-10 decimals (0 to 124).
              Extracted using 6-eye staggered unit-cell patterns (such as zigzag across 2 rows).
            </p>
          </div>
          <div className={styles.rawActions}>
            {onGoToTrigramAnalysis && (
              <button
                type="button"
                className={styles.btnActionHighlight}
                onClick={onGoToTrigramAnalysis}
              >
                Open Trigram Analysis Tab
              </button>
            )}
            <button
              type="button"
              className={`${styles.btnActionCopy} ${trigramCopied ? styles.copied : ''}`}
              onClick={() => handleCopy(trigramText, setTrigramCopied)}
            >
              {trigramCopied ? 'Copied' : 'Copy Trigrams'}
            </button>
            <button
              type="button"
              className={styles.btnActionDownload}
              onClick={() => handleDownload(trigramText, 'noita_eyes_trigrams.txt', 'text/plain')}
            >
              Download (.txt)
            </button>
          </div>
        </div>

        {/* Section 3 Controls Toolbar */}
        <div className={styles.rawControlsBar}>
          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Orientation:</span>
            <select
              className={controls.selectDropdown}
              value={trigramOrientationId}
              onChange={(e) => setTrigramOrientationId(e.target.value)}
            >
              {PRESET_ORIENTATIONS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} [[{preset.pattern[0].join(',')}] / [{preset.pattern[1].join(',')}]]
                </option>
              ))}
            </select>
          </div>

          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Ordering / Format:</span>
            <select
              className={controls.selectDropdown}
              value={trigramOrder}
              onChange={(e) => setTrigramOrder(e.target.value as TrigramOutputOrder)}
            >
              <option value="freq_desc">Frequency: Highest to Lowest</option>
              <option value="freq_asc">Frequency: Lowest to Highest</option>
              <option value="quinary">Numerical Base-5 Order (000 to 444)</option>
              <option value="stream">Sequential Trigram Stream (space-separated)</option>
              <option value="decimal_stream">Decimal Stream (0 to 124)</option>
              <option value="tsv_table">TSV Table (Tab-separated values)</option>
            </select>
          </div>

          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Window:</span>
            <select
              className={controls.selectDropdown}
              value={trigramMode}
              onChange={(e) => setTrigramMode(e.target.value as 'overlapping' | 'non_overlapping')}
            >
              <option value="non_overlapping">Non-overlapping (Step 3 - words)</option>
              <option value="overlapping">Overlapping (Step 1 - all transitions)</option>
            </select>
          </div>

          <div className={styles.rawControlItem}>
            <span className={styles.rawControlLabel}>Scope:</span>
            <select
              className={controls.selectDropdown}
              value={trigramMessageFilter}
              onChange={(e) => {
                const val = e.target.value;
                setTrigramMessageFilter(val === 'all' ? 'all' : Number(val));
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

          <label className={styles.rawCheckboxLabel}>
            <input
              type="checkbox"
              checked={includeZeroCounts}
              onChange={(e) => setIncludeZeroCounts(e.target.checked)}
            />
            <span>Include 0-Count Trigrams</span>
          </label>
        </div>

        {/* Section 3 Summary Pill Banner */}
        <div className={styles.rawStatsBanner}>
          <div className={styles.statPill}>
            <span className={styles.statLabel}>Orientation:</span>
            <span className={`${styles.statVal} font-mono`}>{activeOrientation.name}</span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statLabel}>Total Trigrams:</span>
            <span className={styles.statVal}>{trigramStats.totalTrigrams}</span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statLabel}>Unique Observed:</span>
            <span className={styles.statVal}>{trigramStats.uniqueCount} / 125</span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statLabel}>Missing (0 count):</span>
            <span className={`${styles.statVal} font-mono`}>
              {trigramStats.missingTrigrams.length > 0
                ? `${trigramStats.missingTrigrams.length} trigrams`
                : 'None'}
            </span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statLabel}>Entropy:</span>
            <span className={`${styles.statVal} font-mono`}>
              {trigramStats.entropy.toFixed(3)} bits
            </span>
          </div>
        </div>

        {/* Section 3 Scrollable Textbox */}
        <div className={styles.rawTextboxWrapper}>
          <textarea
            readOnly
            className={`${styles.rawTextbox} font-mono`}
            value={trigramText}
            rows={12}
            spellCheck={false}
          />
          <div className={styles.rawTextboxFooter}>
            <span>
              Mode: <strong>{trigramMode}</strong> | Format: <strong>{trigramOrder}</strong> | Pattern: [[{activePattern[0].join(',')}],[{activePattern[1].join(',')}]]
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
