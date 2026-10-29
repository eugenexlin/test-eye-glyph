import React from 'react';
import type { SixEyePattern } from '../utils/orientationExtractor';
import styles from './MiniArrowShape.module.css';

interface MiniArrowShapeProps {
  pattern: SixEyePattern;
  id?: string;
  width?: number;
  height?: number;
}

const MINI_POS: Record<string, { x: number; y: number }> = {
  '0-0': { x: 12, y: 9 },
  '0-1': { x: 38, y: 9 },
  '0-2': { x: 64, y: 9 },
  '1-0': { x: 25, y: 25 },
  '1-1': { x: 51, y: 25 },
  '1-2': { x: 77, y: 25 },
};

export const MiniArrowShape: React.FC<MiniArrowShapeProps> = ({
  pattern,
  id = 'mini',
  width = 88,
  height = 34,
}) => {
  const getStepCoord = (step: number) => {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        if (pattern[r][c] === step) {
          return MINI_POS[`${r}-${c}`];
        }
      }
    }
    return null;
  };

  const p1 = getStepCoord(1);
  const p2 = getStepCoord(2);
  const p3 = getStepCoord(3);
  const p4 = getStepCoord(4);
  const p5 = getStepCoord(5);
  const p6 = getStepCoord(6);

  const marker1 = `m-tri1-${id}`;
  const marker2 = `m-tri2-${id}`;

  return (
    <svg viewBox="0 0 90 34" width={width} height={height} className={styles.miniArrowSvg}>
      <defs>
        <marker id={marker1} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
          <polygon points="0 0.5, 3.5 2, 0 3.5" fill="#38bdf8" />
        </marker>
        <marker id={marker2} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
          <polygon points="0 0.5, 3.5 2, 0 3.5" fill="#fbbf24" />
        </marker>
      </defs>

      {/* Trigram 1 Cyan lines */}
      {p1 && p2 && (
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke="#38bdf8"
          strokeWidth="1.6"
          strokeLinecap="round"
          markerEnd={`url(#${marker1})`}
        />
      )}
      {p2 && p3 && (
        <line
          x1={p2.x}
          y1={p2.y}
          x2={p3.x}
          y2={p3.y}
          stroke="#38bdf8"
          strokeWidth="1.6"
          strokeLinecap="round"
          markerEnd={`url(#${marker1})`}
        />
      )}

      {/* Dashed connector */}
      {p3 && p4 && (
        <line
          x1={p3.x}
          y1={p3.y}
          x2={p4.x}
          y2={p4.y}
          stroke="#64748b"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}

      {/* Trigram 2 Amber lines */}
      {p4 && p5 && (
        <line
          x1={p4.x}
          y1={p4.y}
          x2={p5.x}
          y2={p5.y}
          stroke="#fbbf24"
          strokeWidth="1.6"
          strokeLinecap="round"
          markerEnd={`url(#${marker2})`}
        />
      )}
      {p5 && p6 && (
        <line
          x1={p5.x}
          y1={p5.y}
          x2={p6.x}
          y2={p6.y}
          stroke="#fbbf24"
          strokeWidth="1.6"
          strokeLinecap="round"
          markerEnd={`url(#${marker2})`}
        />
      )}

      {/* 6 circle nodes */}
      {Object.entries(MINI_POS).map(([key, pos]) => {
        const [r, c] = key.split('-').map(Number);
        const step = pattern[r][c];
        const isTri1 = step >= 1 && step <= 3;
        return (
          <circle
            key={key}
            cx={pos.x}
            cy={pos.y}
            r={3.8}
            fill={isTri1 ? '#0284c7' : '#d97706'}
            stroke={isTri1 ? '#38bdf8' : '#fbbf24'}
            strokeWidth="1.2"
          />
        );
      })}
    </svg>
  );
};
