import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { EyeGlyph } from '../types/eye';
import { ALL_EYES } from '../data/allEyes';
import { extractEyesFromCanvas, type ExtractionResult } from '../utils/eyeExtractor';
import type { OverlayMode } from '../data/eyeConstants';
import { EyeSvgOverlay } from './EyeSvgOverlay';
import { EyeInspector } from './EyeInspector';
import styles from './EyeViewer.module.css';
import controls from '../styles/controls.module.css';

interface EyeViewerProps {
  initialSource?: 'east' | 'west';
}

export const EyeViewer: React.FC<EyeViewerProps> = ({ initialSource = 'east' }) => {
  const [source, setSource] = useState<'east' | 'west'>(initialSource);
  const [zoom, setZoom] = useState<number>(2);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('numbers');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(85);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedEye, setSelectedEye] = useState<EyeGlyph | null>(null);
  const [hoveredEye, setHoveredEye] = useState<EyeGlyph | null>(null);
  const [liveResult, setLiveResult] = useState<ExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);

  const imgSrc = source === 'east' ? './resources/1x-eyes-east.png' : './resources/1x-eyes-west.png';
  const imgWidth = 503;
  const imgHeight = source === 'east' ? 580 : 438;

  // Global Escape key listener to deselect selected eye
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEye(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter eyes for the selected image
  const eyesForImage = useMemo(() => {
    return ALL_EYES.filter((eye) => eye.source === source);
  }, [source]);

  // Unique sections in this image
  const sections = useMemo(() => {
    const set = new Set<string>();
    eyesForImage.forEach((e) => set.add(e.sectionName));
    return Array.from(set);
  }, [eyesForImage]);

  // Visible eyes based on section filter
  const visibleEyes = useMemo(() => {
    if (selectedSection === 'all') return eyesForImage;
    return eyesForImage.filter((e) => e.sectionName === selectedSection);
  }, [eyesForImage, selectedSection]);

  const activeInspectEye = selectedEye || hoveredEye;
  const isSelected = selectedEye !== null && activeInspectEye?.id === selectedEye.id;

  // Stable callbacks for memoized SVG overlay
  const handleSelectEye = useCallback((eye: EyeGlyph | null) => {
    setSelectedEye(eye);
  }, []);

  const handleHoverEye = useCallback((eye: EyeGlyph | null) => {
    setHoveredEye(eye);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedEye(null);
  }, []);

  // Deselect when clicking on the canvas scroll background
  const handleCanvasContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current) {
      setSelectedEye(null);
    }
  };

  // Run live computer vision extraction directly on the canvas
  const handleRunLiveExtraction = () => {
    setIsExtracting(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgSrc;
    img.onload = () => {
      const canvas = hiddenCanvasRef.current;
      if (!canvas) {
        setIsExtracting(false);
        return;
      }
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsExtracting(false);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const res = extractEyesFromCanvas(ctx, imgWidth, imgHeight, source);
      setLiveResult(res);
      setIsExtracting(false);
    };
    img.onerror = () => {
      setIsExtracting(false);
    };
  };

  // Reset selection and hover on image switch
  const handleSwitchSource = (newSource: 'east' | 'west') => {
    setSource(newSource);
    setSelectedSection('all');
    setSelectedEye(null);
    setHoveredEye(null);
    setLiveResult(null);
  };

  return (
    <div className={styles.eyeViewerWrapper}>
      {/* Controls Bar */}
      <div className={styles.viewerControls}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Image:</span>
          <div className={controls.btnToggleGroup}>
            <button
              type="button"
              className={`${controls.btnToggle} ${source === 'east' ? controls.active : ''}`}
              onClick={() => handleSwitchSource('east')}
            >
              East (503x580)
            </button>
            <button
              type="button"
              className={`${controls.btnToggle} ${source === 'west' ? controls.active : ''}`}
              onClick={() => handleSwitchSource('west')}
            >
              West (503x438)
            </button>
          </div>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Zoom:</span>
          <div className={controls.btnToggleGroup}>
            {[1, 2, 4, 8].map((z) => (
              <button
                key={z}
                type="button"
                className={`${controls.btnToggle} ${zoom === z ? controls.active : ''}`}
                onClick={() => setZoom(z)}
              >
                {z}x
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Overlay:</span>
          <div className={controls.btnToggleGroup}>
            <button
              type="button"
              className={`${controls.btnToggle} ${overlayMode === 'numbers' ? controls.active : ''}`}
              onClick={() => setOverlayMode('numbers')}
            >
              Numbers
            </button>
            <button
              type="button"
              className={`${controls.btnToggle} ${overlayMode === 'shapes' ? controls.active : ''}`}
              onClick={() => setOverlayMode('shapes')}
            >
              Gaze Shapes
            </button>
            <button
              type="button"
              className={`${controls.btnToggle} ${overlayMode === 'boxes' ? controls.active : ''}`}
              onClick={() => setOverlayMode('boxes')}
            >
              Bounds
            </button>
            <button
              type="button"
              className={`${controls.btnToggle} ${overlayMode === 'none' ? controls.active : ''}`}
              onClick={() => setOverlayMode('none')}
            >
              None
            </button>
          </div>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Opacity:</span>
          <div className={styles.opacitySliderControl}>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={overlayOpacity}
              disabled={overlayMode === 'none'}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className={styles.opacitySlider}
            />
            <span className={`${styles.opacityVal} font-mono`}>{overlayOpacity}%</span>
          </div>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Section:</span>
          <select
            className={controls.selectDropdown}
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
          >
            <option value="all">All ({eyesForImage.length} eyes)</option>
            {sections.map((sec) => (
              <option key={sec} value={sec}>
                {sec.toUpperCase()} ({eyesForImage.filter((e) => e.sectionName === sec).length})
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.controlGroup} ${styles.mlAuto}`}>
          <button
            type="button"
            className={controls.btnPrimary}
            onClick={handleRunLiveExtraction}
            disabled={isExtracting}
          >
            {isExtracting ? 'Scanning...' : 'Scan Canvas'}
          </button>
        </div>
      </div>

      {/* Canvas extraction result notification */}
      {liveResult && (
        <div className={styles.liveBenchmarkBanner}>
          <span>
            Canvas scan: extracted <strong>{liveResult.totalExtracted}</strong> eyes in <strong>{liveResult.durationMs}ms</strong>.
          </span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className={styles.viewerLayout}>
        {/* Canvas / Image Viewport */}
        <div
          className={styles.viewerCanvasScroll}
          ref={containerRef}
          onClick={handleCanvasContainerClick}
        >
          <div
            className={styles.viewerStage}
            style={{
              width: imgWidth * zoom,
              height: imgHeight * zoom,
            }}
          >
            <img
              src={imgSrc}
              alt={source}
              className={styles.pixelatedImg}
              style={{
                width: imgWidth * zoom,
                height: imgHeight * zoom,
              }}
            />

            {/* Memoized SVG Overlay with 0ms hover latency */}
            <EyeSvgOverlay
              visibleEyes={visibleEyes}
              selectedEyeId={selectedEye?.id ?? null}
              overlayMode={overlayMode}
              overlayOpacity={overlayOpacity}
              zoom={zoom}
              imgWidth={imgWidth}
              imgHeight={imgHeight}
              onSelectEye={handleSelectEye}
              onHoverEye={handleHoverEye}
            />
          </div>
        </div>

        {/* Right Inspector Panel */}
        <div className={styles.viewerInspector}>
          <EyeInspector
            activeEye={activeInspectEye}
            isSelected={isSelected}
            onDeselect={handleDeselect}
          />
        </div>
      </div>

      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />
    </div>
  );
};
