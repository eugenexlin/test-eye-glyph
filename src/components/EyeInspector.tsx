import React from 'react';
import type { EyeGlyph } from '../types/eye';
import { DIR_NAMES, DIR_COLORS } from '../data/eyeConstants';
import styles from './EyeInspector.module.css';

// Mini SVG icons for the legend
const renderLegendShape = (val: number) => {
  const color = DIR_COLORS[val];
  if (val === 0) {
    return (
      <svg width="14" height="14" viewBox="-7 -7 14 14" className={styles.legendShapeSvg}>
        <circle cx="0" cy="0" r="5" fill={color} stroke="#000000" strokeWidth="0.8" />
        <circle cx="0" cy="0" r="1.6" fill="#ffffff" />
      </svg>
    );
  }
  let points = '';
  if (val === 1) points = '0,-5.5 -5,4.5 5,4.5';
  else if (val === 2) points = '5.5,0 -4.5,-5 -4.5,5';
  else if (val === 3) points = '0,5.5 -5,-4.5 5,-4.5';
  else if (val === 4) points = '-5.5,0 4.5,-5 4.5,5';

  return (
    <svg width="14" height="14" viewBox="-7 -7 14 14" className={styles.legendShapeSvg}>
      <polygon
        points={points}
        fill={color}
        stroke="#000000"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
};

interface EyeInspectorProps {
  activeEye: EyeGlyph | null;
  isSelected: boolean;
  onDeselect: () => void;
}

export const EyeInspector: React.FC<EyeInspectorProps> = ({
  activeEye,
  isSelected,
  onDeselect,
}) => {
  return (
    <div className={styles.inspectorCard}>
      <div className={styles.inspectorHeaderRow}>
        <div className={styles.inspectorTitle}>EYE INSPECTOR</div>
        {isSelected && (
          <button
            type="button"
            className={styles.btnDeselect}
            onClick={onDeselect}
            title="Deselect eye (Esc)"
          >
            Deselect (Esc)
          </button>
        )}
      </div>

      {activeEye ? (
        <div className={styles.inspectorDetails}>
          <div className={styles.inspectorBadgeRow}>
            <span
              className={styles.valBadge}
              style={{ backgroundColor: DIR_COLORS[activeEye.val] }}
            >
              Value: {activeEye.val}
            </span>
            <span className={styles.dirBadge}>
              {DIR_NAMES[activeEye.val]}
            </span>
            <span className={`${styles.statusBadge} ${isSelected ? styles.selected : styles.hover}`}>
              {isSelected ? 'Selected' : 'Hover'}
            </span>
          </div>

          <div className={styles.inspectorMetricGrid}>
            <div className={styles.inspectorField}>
              <span className={styles.fieldName}>ID</span>
              <span className={styles.fieldVal}>{activeEye.id}</span>
            </div>
            <div className={styles.inspectorField}>
              <span className={styles.fieldName}>Section</span>
              <span className={`${styles.fieldVal} text-capitalize`}>
                {activeEye.sectionName}
              </span>
            </div>
            <div className={styles.inspectorField}>
              <span className={styles.fieldName}>Center (X, Y)</span>
              <span className={styles.fieldVal}>
                {activeEye.cx}, {activeEye.cy} px
              </span>
            </div>
            <div className={styles.inspectorField}>
              <span className={styles.fieldName}>Grid</span>
              <span className={styles.fieldVal}>
                Row {activeEye.rowIndex}, Col {activeEye.colIndex}
              </span>
            </div>
            <div className={styles.inspectorField}>
              <span className={styles.fieldName}>Index</span>
              <span className={styles.fieldVal}>
                #{activeEye.charIndex}
              </span>
            </div>
            <div className={styles.inspectorField}>
              <span className={styles.fieldName}>Offset</span>
              <span className={styles.fieldVal}>
                {activeEye.val === 0 && 'dx: 0, dy: 0'}
                {activeEye.val === 1 && 'dx: 0, dy: -1'}
                {activeEye.val === 2 && 'dx: +1, dy: 0'}
                {activeEye.val === 3 && 'dx: 0, dy: +1'}
                {activeEye.val === 4 && 'dx: -1, dy: 0'}
              </span>
            </div>
          </div>

          {/* Legend Key */}
          <div className={styles.legendBox}>
            <div className={styles.legendTitle}>Direction Key:</div>
            <div className={styles.legendItem}>
              {renderLegendShape(0)}
              <span className={styles.legendCode}>0</span>
              <span className={styles.legendDesc}>Center</span>
            </div>
            <div className={styles.legendItem}>
              {renderLegendShape(1)}
              <span className={styles.legendCode}>1</span>
              <span className={styles.legendDesc}>Up</span>
            </div>
            <div className={styles.legendItem}>
              {renderLegendShape(2)}
              <span className={styles.legendCode}>2</span>
              <span className={styles.legendDesc}>Right</span>
            </div>
            <div className={styles.legendItem}>
              {renderLegendShape(3)}
              <span className={styles.legendCode}>3</span>
              <span className={styles.legendDesc}>Down</span>
            </div>
            <div className={styles.legendItem}>
              {renderLegendShape(4)}
              <span className={styles.legendCode}>4</span>
              <span className={styles.legendDesc}>Left</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.inspectorEmpty}>
          <p>Click or hover over an eye to inspect its coordinates and value.</p>
          <p className={styles.hint}>Tip: Use 4x or 8x zoom to view individual pixels. Press Esc or click outside to deselect.</p>
        </div>
      )}
    </div>
  );
};
