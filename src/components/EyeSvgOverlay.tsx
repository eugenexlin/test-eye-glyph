import React, { useMemo, useRef } from 'react';
import type { EyeGlyph } from '../types/eye';
import { DIR_COLORS, type OverlayMode } from '../data/eyeConstants';
import styles from './EyeSvgOverlay.module.css';

interface EyeSvgOverlayProps {
  visibleEyes: EyeGlyph[];
  selectedEyeId: string | null;
  overlayMode: OverlayMode;
  overlayOpacity: number;
  zoom: number;
  imgWidth: number;
  imgHeight: number;
  onSelectEye: (eye: EyeGlyph | null) => void;
  onHoverEye: (eye: EyeGlyph | null) => void;
}

// Render SVG geometric shapes centered in the middle of the center pixel (cx + 0.5, cy + 0.5)
const renderGazeShape = (eye: EyeGlyph, color: string) => {
  const centerX = eye.cx + 0.5;
  const centerY = eye.cy + 0.5;
  const { val } = eye;

  if (val === 0) {
    return (
      <g>
        <circle
          cx={centerX}
          cy={centerY}
          r={2.5}
          fill={color}
          stroke="rgba(0, 0, 0, 0.9)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={centerX} cy={centerY} r={0.8} fill="#ffffff" />
      </g>
    );
  }

  let points = '';
  if (val === 1) {
    // Up triangle
    points = `${centerX},${centerY - 2.8} ${centerX - 2.6},${centerY + 2.0} ${centerX + 2.6},${centerY + 2.0}`;
  } else if (val === 2) {
    // Right triangle
    points = `${centerX + 2.8},${centerY} ${centerX - 2.0},${centerY - 2.4} ${centerX - 2.0},${centerY + 2.4}`;
  } else if (val === 3) {
    // Down triangle
    points = `${centerX},${centerY + 2.8} ${centerX - 2.6},${centerY - 2.0} ${centerX + 2.6},${centerY - 2.0}`;
  } else if (val === 4) {
    // Left triangle
    points = `${centerX - 2.8},${centerY} ${centerX + 2.0},${centerY - 2.4} ${centerX + 2.0},${centerY + 2.4}`;
  }

  return (
    <polygon
      points={points}
      fill={color}
      stroke="rgba(0, 0, 0, 0.9)"
      strokeWidth={1}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
};

const EyeSvgOverlayComponent: React.FC<EyeSvgOverlayProps> = ({
  visibleEyes,
  selectedEyeId,
  overlayMode,
  overlayOpacity,
  zoom,
  imgWidth,
  imgHeight,
  onSelectEye,
  onHoverEye,
}) => {
  // Map for O(1) eye lookup by ID
  const eyeMap = useMemo(() => {
    const map = new Map<string, EyeGlyph>();
    for (const eye of visibleEyes) {
      map.set(eye.id, eye);
    }
    return map;
  }, [visibleEyes]);

  const lastHoveredIdRef = useRef<string | null>(null);

  // Single delegated pointermove listener for instant 120 FPS hover tracking
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = (e.target as Element)?.closest<SVGGElement>('[data-eye-id]');
    const eyeId = target?.getAttribute('data-eye-id') || null;

    if (eyeId !== lastHoveredIdRef.current) {
      lastHoveredIdRef.current = eyeId;
      onHoverEye(eyeId ? eyeMap.get(eyeId) || null : null);
    }
  };

  const handlePointerLeave = () => {
    if (lastHoveredIdRef.current !== null) {
      lastHoveredIdRef.current = null;
      onHoverEye(null);
    }
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const target = (e.target as Element)?.closest<SVGGElement>('[data-eye-id]');
    if (target) {
      const eyeId = target.getAttribute('data-eye-id');
      if (eyeId) {
        // Toggle selection off if clicking the already selected eye
        if (selectedEyeId === eyeId) {
          onSelectEye(null);
        } else {
          onSelectEye(eyeMap.get(eyeId) || null);
        }
        return;
      }
    }
    // Clicked empty area of the image
    onSelectEye(null);
  };

  if (overlayMode === 'none') {
    return null;
  }

  const modeClass =
    overlayMode === 'numbers'
      ? styles.modeNumbers
      : overlayMode === 'shapes'
      ? styles.modeShapes
      : styles.modeBoxes;

  return (
    <svg
      className={styles.overlaySvg}
      viewBox={`0 0 ${imgWidth} ${imgHeight}`}
      style={{
        width: imgWidth * zoom,
        height: imgHeight * zoom,
        opacity: overlayOpacity / 100,
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      {visibleEyes.map((eye) => {
        const isSelected = selectedEyeId === eye.id;
        const color = DIR_COLORS[eye.val];

        // Exact center of the center pixel and the 11x7 bounding box
        const centerX = eye.cx + 0.5;
        const centerY = eye.cy + 0.5;

        return (
          <g
            key={eye.id}
            data-eye-id={eye.id}
            className={`${styles.eyeOverlayGroup} ${modeClass} ${isSelected ? styles.selected : ''}`}
          >
            {/* Pixel-perfect Bounding Box: exact 11x7 integer grid */}
            <rect
              className={styles.eyeBoundsRect}
              x={eye.cx - 5}
              y={eye.cy - 3}
              width={11}
              height={7}
              fill={overlayMode === 'numbers' ? color : 'none'}
              stroke={color}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              shapeRendering="crispEdges"
            />

            {/* Number Overlay: white text filling the bounds, centered in middle of center pixel */}
            {overlayMode === 'numbers' && (
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="6.2"
                fontWeight="900"
                fontFamily="monospace"
              >
                {eye.val}
              </text>
            )}

            {/* Gaze Shapes (Circle for center, directional Triangles) */}
            {overlayMode === 'shapes' && renderGazeShape(eye, color)}
          </g>
        );
      })}
    </svg>
  );
};

export const EyeSvgOverlay = React.memo(EyeSvgOverlayComponent);
