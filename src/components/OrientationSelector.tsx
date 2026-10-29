import React, { useState } from 'react';
import styles from './OrientationSelector.module.css';
import {
  PRESET_ORIENTATIONS,
  type SixEyePattern,
  type SampleTrigramProof,
  type EyeInversionSettings,
} from '../utils/orientationExtractor';
import { MiniArrowShape } from './MiniArrowShape';

interface OrientationSelectorProps {
  pattern: SixEyePattern;
  onChangePattern: (pattern: SixEyePattern) => void;
  sampleProofs: SampleTrigramProof[];
  eyeInversion: EyeInversionSettings;
  onChangeEyeInversion: (inversion: EyeInversionSettings) => void;
}

// Circle centers in the 360x160 main interactive canvas
// Top row: x = 55, 155, 255, y = 42
// Bottom row (staggered +50px): x = 105, 205, 305, y = 118
const CIRCLE_POSITIONS: Record<string, { x: number; y: number; r: number; c: number }> = {
  '0-0': { x: 55, y: 42, r: 0, c: 0 },
  '0-1': { x: 155, y: 42, r: 0, c: 1 },
  '0-2': { x: 255, y: 42, r: 0, c: 2 },
  '1-0': { x: 105, y: 118, r: 1, c: 0 },
  '1-1': { x: 205, y: 118, r: 1, c: 1 },
  '1-2': { x: 305, y: 118, r: 1, c: 2 },
};

export const OrientationSelector: React.FC<OrientationSelectorProps> = ({
  pattern,
  onChangePattern,
  sampleProofs,
  eyeInversion,
  onChangeEyeInversion,
}) => {
  // Custom click-ordering mode state: array of clicked slot keys ['0-0', '1-0', ...]
  const [isClickingCustom, setIsClickingCustom] = useState<boolean>(false);
  const [clickedOrder, setClickedOrder] = useState<string[]>([]);

  // Find step number (1..6) for a given slot (r, c)
  const getStepNumber = (r: number, c: number): number => {
    if (isClickingCustom) {
      const idx = clickedOrder.indexOf(`${r}-${c}`);
      return idx !== -1 ? idx + 1 : 0;
    }
    return pattern[r][c];
  };

  // Coordinates of step 1..6
  const getStepPos = (step: number) => {
    if (isClickingCustom) {
      const key = clickedOrder[step - 1];
      return key ? CIRCLE_POSITIONS[key] : null;
    }
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        if (pattern[r][c] === step) {
          return CIRCLE_POSITIONS[`${r}-${c}`];
        }
      }
    }
    return null;
  };

  // Handle clicking a circle in the 6-eye layout
  const handleCircleClick = (r: number, c: number) => {
    const key = `${r}-${c}`;

    if (!isClickingCustom) {
      setIsClickingCustom(true);
      setClickedOrder([key]);
      return;
    }

    if (clickedOrder.includes(key)) {
      return;
    }

    const nextOrder = [...clickedOrder, key];
    setClickedOrder(nextOrder);

    if (nextOrder.length === 6) {
      const newPattern: SixEyePattern = [
        [0, 0, 0],
        [0, 0, 0],
      ];
      nextOrder.forEach((k, idx) => {
        const [rowStr, colStr] = k.split('-');
        newPattern[Number(rowStr)][Number(colStr)] = idx + 1;
      });
      onChangePattern(newPattern);
      setIsClickingCustom(false);
      setClickedOrder([]);
    }
  };

  const handleStartCustomMode = () => {
    setIsClickingCustom(true);
    setClickedOrder([]);
  };

  const handleCancelCustomMode = () => {
    setIsClickingCustom(false);
    setClickedOrder([]);
  };

  // Check if current pattern matches a preset
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

  // Calculate SVG arrow paths
  const p1 = getStepPos(1);
  const p2 = getStepPos(2);
  const p3 = getStepPos(3);
  const p4 = getStepPos(4);
  const p5 = getStepPos(5);
  const p6 = getStepPos(6);

  return (
    <div className={styles.orientationSelectorCard}>
      <div className={styles.orientationHeaderRow}>
        <div>
          <h2 className={styles.orientationTitle}>Reading Order & Staggered Row Orientation</h2>
          <p className={styles.orientationDesc}>
            The stones use staggered hexagonal rows (Row 0 and Row 1 offset by 50%).
            Select an arrow preset below or click circles in sequence to test how trigrams are formed across row pairs.
          </p>
        </div>
        <div className={`${styles.orientationMatrixBadge} font-mono`}>
          Pattern: [[{pattern[0].join(',')}],[{pattern[1].join(',')}]]
        </div>
      </div>

      <div className={styles.orientationBodyLayout}>
        {/* Left: Interactive 6-Eye Staggered Widget */}
        <div className={styles.orientationWidgetContainer}>
          <div className={styles.widgetToolbar}>
            <span className={styles.widgetLabel}>
              {isClickingCustom
                ? `Clicking Step ${clickedOrder.length + 1} of 6...`
                : 'Interactive 2x3 Staggered Unit Cell:'}
            </span>
            {isClickingCustom ? (
              <button
                type="button"
                className={styles.btnCancelCustom}
                onClick={handleCancelCustomMode}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className={styles.btnCustomStart}
                onClick={handleStartCustomMode}
                title="Click each of the 6 circles in your own custom order"
              >
                Click Custom Order
              </button>
            )}
          </div>

          <div className={styles.interactiveCanvasBox}>
            <svg className={styles.orientationSvg} viewBox="0 0 360 160">
              <defs>
                <marker
                  id="arrow-tri1"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 1, 7 4, 0 7" fill="#38bdf8" />
                </marker>
                <marker
                  id="arrow-tri2"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 1, 7 4, 0 7" fill="#fbbf24" />
                </marker>
              </defs>

              {/* Trigram 1 Path: Step 1 -> Step 2 -> Step 3 (Cyan) */}
              {p1 && p2 && (
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  markerEnd="url(#arrow-tri1)"
                />
              )}
              {p2 && p3 && (
                <line
                  x1={p2.x}
                  y1={p2.y}
                  x2={p3.x}
                  y2={p3.y}
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  markerEnd="url(#arrow-tri1)"
                />
              )}

              {/* Transition between Trigrams: Step 3 -> Step 4 (Dashed Gray) */}
              {p3 && p4 && (
                <line
                  x1={p3.x}
                  y1={p3.y}
                  x2={p4.x}
                  y2={p4.y}
                  stroke="#64748b"
                  strokeWidth="1.8"
                  strokeDasharray="4 4"
                />
              )}

              {/* Trigram 2 Path: Step 4 -> Step 5 -> Step 6 (Amber) */}
              {p4 && p5 && (
                <line
                  x1={p4.x}
                  y1={p4.y}
                  x2={p5.x}
                  y2={p5.y}
                  stroke="#fbbf24"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  markerEnd="url(#arrow-tri2)"
                />
              )}
              {p5 && p6 && (
                <line
                  x1={p5.x}
                  y1={p5.y}
                  x2={p6.x}
                  y2={p6.y}
                  stroke="#fbbf24"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  markerEnd="url(#arrow-tri2)"
                />
              )}

              {/* Render the 6 interactive circles */}
              {Object.entries(CIRCLE_POSITIONS).map(([key, pos]) => {
                const step = getStepNumber(pos.r, pos.c);
                const isTrigram1 = step >= 1 && step <= 3;
                const isTrigram2 = step >= 4 && step <= 6;
                const isNextToClick = isClickingCustom && step === 0 && clickedOrder.length < 6;

                let fill = '#1e293b';
                let stroke = '#475569';
                let textColor = '#cbd5e1';

                if (isTrigram1) {
                  fill = 'rgba(56, 189, 248, 0.2)';
                  stroke = '#38bdf8';
                  textColor = '#38bdf8';
                } else if (isTrigram2) {
                  fill = 'rgba(251, 191, 36, 0.2)';
                  stroke = '#fbbf24';
                  textColor = '#fbbf24';
                } else if (isNextToClick) {
                  stroke = '#a855f7';
                  fill = 'rgba(168, 85, 247, 0.15)';
                }

                return (
                  <g
                    key={key}
                    className={styles.clickableEyeSlot}
                    onClick={() => handleCircleClick(pos.r, pos.c)}
                  >
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={20}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={step > 0 ? 2.5 : 1.5}
                    />
                    <text
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={textColor}
                      fontWeight="800"
                      fontSize="14"
                      fontFamily="monospace"
                    >
                      {step > 0 ? step : '?'}
                    </text>
                    <text
                      x={pos.x}
                      y={pos.y + 28}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {pos.r === 0 ? `T${pos.c}` : `B${pos.c}`}
                    </text>
                    {((eyeInversion.mode === 'all' && step > 0) ||
                      (eyeInversion.mode === 'return_only' && step >= 4)) && (
                      <text
                        x={pos.x}
                        y={pos.y - 25}
                        textAnchor="middle"
                        fill="#f59e0b"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="700"
                      >
                        180° FLIP
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className={styles.canvasLegendRow}>
              <span className={`${styles.legendChip} ${styles.chipTri1}`}>Trigram 1 (Steps 1, 2, 3)</span>
              <span className={`${styles.legendChip} ${styles.chipTri2}`}>Trigram 2 (Steps 4, 5, 6)</span>
              {eyeInversion.mode !== 'none' && (
                <span className={`${styles.legendChip} ${styles.chipInverted}`}>
                  Gaze Flip Active ({eyeInversion.mode === 'return_only' ? 'Steps 4-6' : 'All'})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Presets with visual mini arrow shapes */}
        <div className={styles.orientationControlsSide}>
          <div className={styles.presetsBox}>
            <span className={styles.presetsTitle}>Orientation Presets:</span>
            <div className={styles.presetButtonsGrid}>
              {PRESET_ORIENTATIONS.map((preset) => {
                const isActive = activePreset?.id === preset.id && !isClickingCustom;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.btnPreset} ${isActive ? styles.active : ''}`}
                    onClick={() => {
                      setIsClickingCustom(false);
                      setClickedOrder([]);
                      onChangePattern(preset.pattern);
                    }}
                    title={preset.description}
                  >
                    {/* Visual node and arrows diagram instead of text rows */}
                    <div className={styles.presetThumbWrapper}>
                      <MiniArrowShape pattern={preset.pattern} id={`preset-${preset.id}`} />
                    </div>
                    <div className={styles.presetName}>{preset.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sample Coordinates Verification Strip */}
          <div className={styles.verificationStrip}>
            <div className={styles.verificationTitle}>
              Extracted Coordinate Sequence (Message 1 / East 1):
            </div>
            <div className={styles.verificationProofsGrid}>
              {sampleProofs.slice(0, 4).map((proof) => (
                <div key={proof.trigramIndex} className={styles.proofCard}>
                  <div className={styles.proofHeader}>
                    <span className={styles.proofLabel}>{proof.label}</span>
                    <div className={styles.proofHeaderRight}>
                      {proof.isInverted && (
                        <span className={styles.proofInvertedBadge}>180° Inverted</span>
                      )}
                      <span className={`${styles.proofCode} font-mono font-bold`}>
                        &quot;{proof.trigramCode}&quot;
                      </span>
                    </div>
                  </div>
                  <div className={styles.proofRow}>
                    <span className={styles.proofKey}>Indices:</span>
                    <span className={`${styles.proofVal} font-mono`}>{proof.indicesStr}</span>
                  </div>
                  <div className={styles.proofRow}>
                    <span className={styles.proofKey}>Values:</span>
                    <span className={`${styles.proofVal} font-mono`}>{proof.valuesStr}</span>
                  </div>
                  <div className={styles.proofRow}>
                    <span className={styles.proofKey}>Centroids:</span>
                    <span className={`${styles.proofVal} font-mono text-dim`}>{proof.coordsStr}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Eye Gaze Direction Inversion / Head Upside Down Control */}
      <div className={styles.eyeInversionBox}>
        <div className={styles.inversionBoxHeader}>
          <div className={styles.inversionTitleGroup}>
            <span className={styles.inversionTitle}>Observer Perspective & Eye Direction Inversion:</span>
            <span className={styles.inversionSub}>
              Simulate reading the traversal upside down by swapping directional gaze codes
            </span>
          </div>
          {eyeInversion.mode !== 'none' && (
            <span className={styles.inversionStatusPill}>
              Inversion Active: {eyeInversion.mode === 'return_only' ? 'Return Loop (Steps 4-6)' : 'All Eyes'}
            </span>
          )}
        </div>

        <div className={styles.inversionControlsLayout}>
          {/* Mode Selector */}
          <div className={styles.inversionModeButtons}>
            <button
              type="button"
              className={`${styles.btnInversionMode} ${eyeInversion.mode === 'none' ? styles.active : ''}`}
              onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'none' })}
            >
              <span className={styles.modeBtnTitle}>Standard (None)</span>
              <span className={styles.modeBtnSub}>Original Right-Side Up</span>
            </button>
            <button
              type="button"
              className={`${styles.btnInversionMode} ${eyeInversion.mode === 'return_only' ? styles.active : ''}`}
              onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'return_only' })}
              title="Invert eyes during the return path (steps 4, 5, 6) where traversal flips upside down"
            >
              <span className={styles.modeBtnTitle}>Invert Return Loop (Steps 4-6)</span>
              <span className={styles.modeBtnSub}>Upside-Down Return Stroke</span>
            </button>
            <button
              type="button"
              className={`${styles.btnInversionMode} ${eyeInversion.mode === 'all' ? styles.active : ''}`}
              onClick={() => onChangeEyeInversion({ ...eyeInversion, mode: 'all' })}
              title="Invert eye directions globally across all 6 steps"
            >
              <span className={styles.modeBtnTitle}>Invert All Eyes (Full 180°)</span>
              <span className={styles.modeBtnSub}>Full Corpus Head Inversion</span>
            </button>
          </div>

          {/* Granular Axis Toggles & Live Mapping Preview */}
          <div className={styles.inversionAxisControls}>
            <div className={styles.axisTogglesRow}>
              <label className={`${styles.axisToggleLabel} ${eyeInversion.mode === 'none' ? styles.disabled : ''}`}>
                <input
                  type="checkbox"
                  checked={eyeInversion.swapUpDown}
                  disabled={eyeInversion.mode === 'none'}
                  onChange={(e) =>
                    onChangeEyeInversion({ ...eyeInversion, swapUpDown: e.target.checked })
                  }
                />
                Swap Up &lt;-&gt; Down (1 &lt;-&gt; 3)
              </label>
              <label className={`${styles.axisToggleLabel} ${eyeInversion.mode === 'none' ? styles.disabled : ''}`}>
                <input
                  type="checkbox"
                  checked={eyeInversion.swapLeftRight}
                  disabled={eyeInversion.mode === 'none'}
                  onChange={(e) =>
                    onChangeEyeInversion({ ...eyeInversion, swapLeftRight: e.target.checked })
                  }
                />
                Swap Left &lt;-&gt; Right (4 &lt;-&gt; 2)
              </label>
            </div>

            <div className={styles.inversionMappingPreview}>
              <span className={styles.mappingLabel}>Gaze Transformation:</span>
              <span className={styles.mappingChips}>
                <span className={styles.mapChip}>Center (0) -&gt; Center (0)</span>
                <span className={`${styles.mapChip} ${eyeInversion.swapUpDown && eyeInversion.mode !== 'none' ? styles.activeFlip : ''}`}>
                  Up (1) &lt;-&gt; Down (3)
                </span>
                <span className={`${styles.mapChip} ${eyeInversion.swapLeftRight && eyeInversion.mode !== 'none' ? styles.activeFlip : ''}`}>
                  Right (2) &lt;-&gt; Left (4)
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
