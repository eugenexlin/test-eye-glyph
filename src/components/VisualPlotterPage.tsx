import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from './VisualPlotterPage.module.css';
import controls from '../styles/controls.module.css';
import {
  generateTurtleWalk,
  generate3DTurnWalk,
  generateDirectVectorWalk,
  project3DTo2D,
  extractPlotterData,
  MESSAGE_COLORS,
  MESSAGE_NAMES,
  type MessageTrack,
  type TurtleDirectionMode,
  type TurtleSegment,
  type TurtleWalkResult,
  type TurnWalk3DStepMode,
  type TurnWalk3DResult,
  type DirectWalkCenterMode,
  type DirectWalkResult,
  type Point2D,
  type Point3D,
} from '../utils/visualPlotterUtils';
import {
  PRESET_ORIENTATIONS,
  type SixEyePattern,
  type EyeInversionSettings,
} from '../utils/orientationExtractor';
import { MiniArrowShape } from './MiniArrowShape';

export type PlotterVisualMode = 'turtle' | 'turn_walk_3d' | 'direct_walk';

const EMPTY_TURTLE_WALK: TurtleWalkResult = {
  segments: [],
  points: [{ x: 0, y: 0 }],
  tracks: [],
  headBeacons: [],
  bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 },
  totalDistance: 0,
  penDownSegments: 0,
  penUpJumps: 0,
};

const EMPTY_TURN_WALK_3D: TurnWalk3DResult = {
  segments: [],
  vertices: [],
  tracks: [],
  headBeacons: [],
  bounds: {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    minZ: 0,
    maxZ: 0,
    width: 1,
    height: 1,
    depth: 1,
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    radius: 10,
  },
  totalDistance: 0,
  stepCount: 0,
  turnCount: 0,
};

const EMPTY_DIRECT_WALK: DirectWalkResult = {
  paths: [],
  overallBounds: {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    minZ: 0,
    maxZ: 0,
    width: 1,
    height: 1,
    depth: 1,
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    radius: 10,
  },
  totalDistance: 0,
  stepCount: 0,
  snapCount: 0,
};

interface CachedTurnWalk3DSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stepIndex: number;
  rawVal: number;
  isStep: boolean;
  actionDesc: string;
  messageIndex?: number;
  color?: string;
  p1: Point3D;
  p2: Point3D;
}

interface CachedTurnWalk3DVertex {
  x: number;
  y: number;
  stepIndex: number;
  rawVal: number;
  messageIndex?: number;
  color?: string;
  origCoord: Point3D;
  origHeading: Point3D;
  arrowX: number;
  arrowY: number;
}

interface CachedTurnWalk3DTrack {
  messageIndex: number;
  name: string;
  color: string;
  segments: CachedTurnWalk3DSegment[];
  vertices: CachedTurnWalk3DVertex[];
}

interface CachedDirectWalkSegment {
  p1: Point3D;
  p2: Point3D;
  s1: Point2D;
  s2: Point2D;
  stepIndex: number;
  rawVal: number;
  isSnap: boolean;
  actionDesc: string;
}

interface VisualPlotterPageProps {
  pattern: SixEyePattern;
  onChangePattern: (pattern: SixEyePattern) => void;
  eyeInversion: EyeInversionSettings;
  onChangeEyeInversion: (inversion: EyeInversionSettings) => void;
  stepMode: 'non_overlapping' | 'overlapping';
  onChangeStepMode: (mode: 'non_overlapping' | 'overlapping') => void;
}

export const VisualPlotterPage: React.FC<VisualPlotterPageProps> = ({
  pattern,
  onChangePattern,
  eyeInversion,
  onChangeEyeInversion,
  stepMode,
  onChangeStepMode,
}) => {
  // Navigation & Mode
  const [activeMode, setActiveMode] = useState<PlotterVisualMode>('turtle');

  // Shared Data Source Configuration
  const [selectedMessage, setSelectedMessage] = useState<number | 'all'>(1);
  const [streamType, setStreamType] = useState<'raw_digits' | 'trigram_decimals'>('raw_digits');
  const [overlayMessages, setOverlayMessages] = useState<boolean>(false);
  const [activeMessageFilter, setActiveMessageFilter] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  // Playback & Animation Scrubber
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [userPlaybackStep, setUserPlaybackStep] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // Mode 1: Turtle Walk Parameters
  const [turtleDirMode, setTurtleDirMode] = useState<TurtleDirectionMode>('cardinal_4');
  const [turtleStepLength, setTurtleStepLength] = useState<number>(18);
  const [turtlePenUpOnZero, setTurtlePenUpOnZero] = useState<boolean>(true);
  const [turtleAdvanceWidth, setTurtleAdvanceWidth] = useState<number>(26);
  const [turtleWrapWidth, setTurtleWrapWidth] = useState<number>(550);
  const [turtleResetY, setTurtleResetY] = useState<boolean>(true);
  const [turtleTurnAngle, setTurtleTurnAngle] = useState<number>(72);
  const [userTurtleView, setUserTurtleView] = useState<{ pan: Point2D; zoom: number } | null>(null);
  const [isDraggingTurtle, setIsDraggingTurtle] = useState<boolean>(false);

  // Mode 2: 3D Turn and Walk Parameters
  const [turnWalkStepMode, setTurnWalkStepMode] = useState<TurnWalk3DStepMode>('blank_only');
  const [turnWalkStepSize, setTurnWalkStepSize] = useState<number>(15);
  const [turnWalkTurnAngle, setTurnWalkTurnAngle] = useState<number>(90);
  const [turnWalkHeading, setTurnWalkHeading] = useState<'pos_x' | 'pos_y' | 'pos_z'>('pos_x');
  const [azimuth3D, setAzimuth3D] = useState<number>(35);
  const [elevation3D, setElevation3D] = useState<number>(25);
  const [userZoom3D, setUserZoom3D] = useState<number | null>(null);
  const [isPerspective3D, setIsPerspective3D] = useState<boolean>(false);
  const [isDragging3D, setIsDragging3D] = useState<boolean>(false);

  // Mode 3: Direct Vector Walk Parameters
  const [directCenterMode, setDirectCenterMode] = useState<DirectWalkCenterMode>('3d_z_step');
  const [directSplitTrigrams, setDirectSplitTrigrams] = useState<boolean>(false);
  const [directActivePathFilter, setDirectActivePathFilter] = useState<number>(0); // 0=all, 1, 2, 3
  const [directSnapN, setDirectSnapN] = useState<number>(4);
  const [directStepSize, setDirectStepSize] = useState<number>(12);
  const [directResetY, setDirectResetY] = useState<boolean>(false);
  const [directPathSpacing, setDirectPathSpacing] = useState<number>(0);
  const [directAzimuth3D, setDirectAzimuth3D] = useState<number>(35);
  const [directElevation3D, setDirectElevation3D] = useState<number>(25);
  const [userDirectZoom3D, setUserDirectZoom3D] = useState<number | null>(null);
  const [directPerspective, setDirectPerspective] = useState<boolean>(false);
  const [userDirect2DView, setUserDirect2DView] = useState<{ pan: Point2D; zoom: number } | null>(null);
  const [isDraggingDirect, setIsDraggingDirect] = useState<boolean>(false);

  // Drag interaction origin
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tooltip & Hover state
  const [hoveredInfo, setHoveredInfo] = useState<{
    title: string;
    details: string[];
  } | null>(null);

  // 1. Extract Dataset Stream & Trigrams
  const dataset = useMemo(() => {
    return extractPlotterData({
      selectedMessage,
      streamType,
      trigramDomain: 'inverted_return_83',
      pattern,
      inversion: eyeInversion,
      stepMode,
    });
  }, [selectedMessage, streamType, pattern, eyeInversion, stepMode]);

  // Is overlay active (only when all messages are selected and toggle is on)
  const isOverlayActive = selectedMessage === 'all' && overlayMessages;

  // Filtered tracks based on user selection
  const visibleTracks: MessageTrack[] = useMemo(() => {
    if (selectedMessage !== 'all') {
      return dataset.messageTracks;
    }
    return dataset.messageTracks.filter((t) => activeMessageFilter.includes(t.messageIndex));
  }, [selectedMessage, dataset.messageTracks, activeMessageFilter]);

  // Max step for playback slider
  const effectiveMaxStep = useMemo(() => {
    if (isOverlayActive) {
      let maxL = 0;
      for (const t of visibleTracks) {
        if (t.length > maxL) maxL = t.length;
      }
      return Math.max(1, maxL);
    }
    return dataset.totalLength;
  }, [isOverlayActive, visibleTracks, dataset.totalLength]);

  // Effective playback step clamped to dataset bounds
  const effectivePlaybackStep =
    userPlaybackStep === null
      ? effectiveMaxStep
      : Math.min(userPlaybackStep, effectiveMaxStep);

  // Handle Playback Animation Timer
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.max(16, Math.floor(100 / playbackSpeed));
    const timer = setInterval(() => {
      setUserPlaybackStep((prev) => {
        const cur = prev === null ? 0 : prev;
        if (cur >= effectiveMaxStep) {
          if (isLooping) return 0;
          setIsPlaying(false);
          return null;
        }
        return cur + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, isLooping, effectiveMaxStep]);

  // ==========================================
  // Mode 1: Turtle Walk Calculations (Cached & Sliced)
  // ==========================================
  const fullTurtleWalk = useMemo(() => {
    if (activeMode !== 'turtle') return EMPTY_TURTLE_WALK;
    return generateTurtleWalk(dataset.stream, {
      directionMode: turtleDirMode,
      stepLength: turtleStepLength,
      penUpOnZero: turtlePenUpOnZero,
      advanceWidth: turtleAdvanceWidth,
      wrapWidth: turtleWrapWidth,
      resetYOnAdvance: turtleResetY,
      turnAngleDeg: turtleTurnAngle,
      overlayAtOrigin: isOverlayActive,
      tracks: visibleTracks,
    });
  }, [
    activeMode,
    dataset.stream,
    turtleDirMode,
    turtleStepLength,
    turtlePenUpOnZero,
    turtleAdvanceWidth,
    turtleWrapWidth,
    turtleResetY,
    turtleTurnAngle,
    isOverlayActive,
    visibleTracks,
  ]);

  const autoFitTurtleView = useMemo(() => {
    if (activeMode !== 'turtle') return { zoom: 1, pan: { x: 320, y: 260 } };
    const bounds = fullTurtleWalk.bounds;
    const padding = 60;
    const bw = Math.max(60, bounds.width + padding * 2);
    const bh = Math.max(60, bounds.height + padding * 2);
    const scale = Math.min(600 / bw, 480 / bh, 2.5);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    return {
      zoom: scale,
      pan: {
        x: 320 - centerX * scale,
        y: 260 - centerY * scale,
      },
    };
  }, [activeMode, fullTurtleWalk.bounds]);

  const activeTurtlePan = userTurtleView ? userTurtleView.pan : autoFitTurtleView.pan;
  const activeTurtleZoom = userTurtleView ? userTurtleView.zoom : autoFitTurtleView.zoom;

  // Sliced visible segments for Turtle Walk without re-running simulation
  const visibleTurtleSegments = useMemo(() => {
    if (activeMode !== 'turtle') return [];
    if (isOverlayActive) {
      const segs: TurtleSegment[] = [];
      for (const track of fullTurtleWalk.tracks) {
        const count = Math.min(effectivePlaybackStep, track.segments.length);
        for (let i = 0; i < count; i++) {
          segs.push(track.segments[i]);
        }
      }
      return segs;
    }
    const count = Math.min(effectivePlaybackStep, fullTurtleWalk.segments.length);
    return fullTurtleWalk.segments.slice(0, count);
  }, [activeMode, isOverlayActive, fullTurtleWalk, effectivePlaybackStep]);

  // Sliced visible heads for Turtle Walk
  const visibleTurtleHeads = useMemo(() => {
    if (activeMode !== 'turtle') return [];
    if (isOverlayActive) {
      return fullTurtleWalk.tracks.map((track) => {
        const ptIdx = Math.min(effectivePlaybackStep, track.points.length - 1);
        const pt = track.points[ptIdx] || { x: 0, y: 0 };
        return {
          messageIndex: track.messageIndex,
          name: track.name,
          color: track.color,
          point: pt,
        };
      });
    }
    const lastSeg = visibleTurtleSegments[visibleTurtleSegments.length - 1];
    const pt = lastSeg ? { x: lastSeg.x2, y: lastSeg.y2 } : (fullTurtleWalk.points[0] || { x: 0, y: 0 });
    return [
      {
        messageIndex: 1,
        name: 'Pen Head',
        color: '#f59e0b',
        point: pt,
      },
    ];
  }, [activeMode, isOverlayActive, fullTurtleWalk, effectivePlaybackStep, visibleTurtleSegments]);

  const turtlePlaybackStats = useMemo(() => {
    let penDown = 0;
    let penUp = 0;
    let dist = 0;
    for (let i = 0; i < visibleTurtleSegments.length; i++) {
      const s = visibleTurtleSegments[i];
      if (s.isPenUp) {
        penUp++;
      } else {
        penDown++;
        dist += Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      }
    }
    return { penDown, penUp, dist };
  }, [visibleTurtleSegments]);

  // ==========================================
  // Mode 2: 3D Turn and Walk Calculations (Pre-projected & Sliced)
  // ==========================================
  const fullTurnWalk3D = useMemo(() => {
    if (activeMode !== 'turn_walk_3d') return EMPTY_TURN_WALK_3D;
    return generate3DTurnWalk(dataset.stream, {
      stepMode: turnWalkStepMode,
      stepSize: turnWalkStepSize,
      turnAngleDeg: turnWalkTurnAngle,
      initialHeading: turnWalkHeading,
      overlayAtOrigin: isOverlayActive,
      tracks: visibleTracks,
    });
  }, [
    activeMode,
    dataset.stream,
    turnWalkStepMode,
    turnWalkStepSize,
    turnWalkTurnAngle,
    turnWalkHeading,
    isOverlayActive,
    visibleTracks,
  ]);

  const autoZoom3D = useMemo(() => {
    if (activeMode !== 'turn_walk_3d') return 10;
    const r = Math.max(15, fullTurnWalk3D.bounds.radius);
    return Math.max(1.5, Math.min(45, 180 / r));
  }, [activeMode, fullTurnWalk3D.bounds.radius]);

  const activeZoom3D = userZoom3D !== null ? userZoom3D : autoZoom3D;

  const center3D: Point3D = useMemo(
    () => ({
      x: fullTurnWalk3D.bounds.centerX,
      y: fullTurnWalk3D.bounds.centerY,
      z: fullTurnWalk3D.bounds.centerZ,
    }),
    [fullTurnWalk3D.bounds]
  );

  // Pre-project all 3D geometry to screen 2D coordinates once per camera move
  const projectedTurnWalk3D = useMemo(() => {
    if (activeMode !== 'turn_walk_3d') {
      return {
        tracks: [] as CachedTurnWalk3DTrack[],
        segments: [] as CachedTurnWalk3DSegment[],
        vertices: [] as CachedTurnWalk3DVertex[],
      };
    }

    const project = (p: Point3D) =>
      project3DTo2D(p, azimuth3D, elevation3D, activeZoom3D, 640, 520, isPerspective3D, center3D);

    const tracks: CachedTurnWalk3DTrack[] = fullTurnWalk3D.tracks.map((t) => {
      const segs: CachedTurnWalk3DSegment[] = t.segments.map((seg) => {
        const s1 = project(seg.p1);
        const s2 = project(seg.p2);
        return {
          x1: s1.x,
          y1: s1.y,
          x2: s2.x,
          y2: s2.y,
          stepIndex: seg.stepIndex,
          rawVal: seg.rawVal,
          isStep: seg.isStep,
          actionDesc: seg.actionDesc,
          messageIndex: seg.messageIndex,
          color: seg.color,
          p1: seg.p1,
          p2: seg.p2,
        };
      });

      const verts: CachedTurnWalk3DVertex[] = t.vertices.map((v) => {
        const s = project(v);
        const arrow3D: Point3D = {
          x: v.x + v.heading.x * (turnWalkStepSize * 0.7),
          y: v.y + v.heading.y * (turnWalkStepSize * 0.7),
          z: v.z + v.heading.z * (turnWalkStepSize * 0.7),
        };
        const sArrow = project(arrow3D);
        return {
          x: s.x,
          y: s.y,
          stepIndex: v.stepIndex,
          rawVal: v.rawVal,
          messageIndex: v.messageIndex,
          color: v.color,
          origCoord: { x: v.x, y: v.y, z: v.z },
          origHeading: v.heading,
          arrowX: sArrow.x,
          arrowY: sArrow.y,
        };
      });

      return {
        messageIndex: t.messageIndex,
        name: t.name,
        color: t.color,
        segments: segs,
        vertices: verts,
      };
    });

    const segments: CachedTurnWalk3DSegment[] = fullTurnWalk3D.segments.map((seg) => {
      const s1 = project(seg.p1);
      const s2 = project(seg.p2);
      return {
        x1: s1.x,
        y1: s1.y,
        x2: s2.x,
        y2: s2.y,
        stepIndex: seg.stepIndex,
        rawVal: seg.rawVal,
        isStep: seg.isStep,
        actionDesc: seg.actionDesc,
        messageIndex: seg.messageIndex,
        color: seg.color,
        p1: seg.p1,
        p2: seg.p2,
      };
    });

    const vertices: CachedTurnWalk3DVertex[] = fullTurnWalk3D.vertices.map((v) => {
      const s = project(v);
      const arrow3D: Point3D = {
        x: v.x + v.heading.x * (turnWalkStepSize * 0.7),
        y: v.y + v.heading.y * (turnWalkStepSize * 0.7),
        z: v.z + v.heading.z * (turnWalkStepSize * 0.7),
      };
      const sArrow = project(arrow3D);
      return {
        x: s.x,
        y: s.y,
        stepIndex: v.stepIndex,
        rawVal: v.rawVal,
        messageIndex: v.messageIndex,
        color: v.color,
        origCoord: { x: v.x, y: v.y, z: v.z },
        origHeading: v.heading,
        arrowX: sArrow.x,
        arrowY: sArrow.y,
      };
    });

    return { tracks, segments, vertices };
  }, [
    activeMode,
    fullTurnWalk3D,
    azimuth3D,
    elevation3D,
    activeZoom3D,
    isPerspective3D,
    center3D,
    turnWalkStepSize,
  ]);

  // Visible pre-projected 3D segments sliced at current playback step
  const visible3DSegments = useMemo(() => {
    if (activeMode !== 'turn_walk_3d') return [];
    if (isOverlayActive) {
      const list: CachedTurnWalk3DSegment[] = [];
      for (const track of projectedTurnWalk3D.tracks) {
        const count = Math.min(effectivePlaybackStep, track.segments.length);
        for (let i = 0; i < count; i++) {
          list.push(track.segments[i]);
        }
      }
      return list;
    }
    const count = Math.min(effectivePlaybackStep, projectedTurnWalk3D.segments.length);
    return projectedTurnWalk3D.segments.slice(0, count);
  }, [activeMode, isOverlayActive, projectedTurnWalk3D, effectivePlaybackStep]);

  // Visible pre-projected 3D head beacons
  const visible3DHeads = useMemo(() => {
    if (activeMode !== 'turn_walk_3d') return [];
    if (isOverlayActive) {
      return projectedTurnWalk3D.tracks.map((t) => {
        const idx = Math.min(effectivePlaybackStep, t.vertices.length - 1);
        const v = t.vertices[idx] || t.vertices[0];
        return {
          messageIndex: t.messageIndex,
          name: t.name,
          color: t.color,
          screenPos: { x: v ? v.x : 320, y: v ? v.y : 260 },
          screenArrow: { x: v ? v.arrowX : 320, y: v ? v.arrowY : 260 },
        };
      });
    }
    const idx = Math.min(effectivePlaybackStep, projectedTurnWalk3D.vertices.length - 1);
    const v = projectedTurnWalk3D.vertices[idx] || projectedTurnWalk3D.vertices[0];
    return [
      {
        messageIndex: 1,
        name: 'Head',
        color: '#f59e0b',
        screenPos: { x: v ? v.x : 320, y: v ? v.y : 260 },
        screenArrow: { x: v ? v.arrowX : 320, y: v ? v.arrowY : 260 },
      },
    ];
  }, [activeMode, isOverlayActive, projectedTurnWalk3D, effectivePlaybackStep]);

  const turnWalk3DPlaybackStats = useMemo(() => {
    let steps = 0;
    let turns = 0;
    let dist = 0;
    for (let i = 0; i < visible3DSegments.length; i++) {
      const s = visible3DSegments[i];
      if (s.isStep) {
        steps++;
        dist += turnWalkStepSize;
      } else {
        turns++;
      }
    }
    return { stepCount: steps, turnCount: turns, totalDistance: dist };
  }, [visible3DSegments, turnWalkStepSize]);

  // ==========================================
  // Mode 3: Direct Vector Walk Calculations (Pre-projected & Sliced)
  // ==========================================
  const fullDirectWalk = useMemo(() => {
    if (activeMode !== 'direct_walk') return EMPTY_DIRECT_WALK;
    return generateDirectVectorWalk(dataset.stream, {
      centerMode: directCenterMode,
      splitTrigramPaths: directSplitTrigrams,
      snapUnitN: directSnapN,
      stepSize: directStepSize,
      resetYOnSnap: directResetY,
      pathSpacing: directPathSpacing,
      overlayAtOrigin: isOverlayActive,
      tracks: visibleTracks,
    });
  }, [
    activeMode,
    dataset.stream,
    directCenterMode,
    directSplitTrigrams,
    directSnapN,
    directStepSize,
    directResetY,
    directPathSpacing,
    isOverlayActive,
    visibleTracks,
  ]);

  const directCenter3D: Point3D = useMemo(
    () => ({
      x: fullDirectWalk.overallBounds.centerX,
      y: fullDirectWalk.overallBounds.centerY,
      z: fullDirectWalk.overallBounds.centerZ,
    }),
    [fullDirectWalk.overallBounds]
  );

  const autoDirectZoom3D = useMemo(() => {
    if (activeMode !== 'direct_walk') return 10;
    const r = Math.max(15, fullDirectWalk.overallBounds.radius);
    return Math.max(1.5, Math.min(45, 180 / r));
  }, [activeMode, fullDirectWalk.overallBounds.radius]);

  const activeDirectZoom3D = userDirectZoom3D !== null ? userDirectZoom3D : autoDirectZoom3D;

  const autoDirect2DView = useMemo(() => {
    if (activeMode !== 'direct_walk') return { zoom: 1, pan: { x: 320, y: 260 } };
    const bounds = fullDirectWalk.overallBounds;
    const padding = 60;
    const bw = Math.max(60, bounds.width + padding * 2);
    const bh = Math.max(60, bounds.height + padding * 2);
    const scale = Math.min(600 / bw, 480 / bh, 2.5);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    return {
      zoom: scale,
      pan: {
        x: 320 - centerX * scale,
        y: 260 - centerY * scale,
      },
    };
  }, [activeMode, fullDirectWalk.overallBounds]);

  const activeDirect2DPan = userDirect2DView ? userDirect2DView.pan : autoDirect2DView.pan;
  const activeDirect2DZoom = userDirect2DView ? userDirect2DView.zoom : autoDirect2DView.zoom;

  // Pre-project all Direct Walk paths in 3D mode
  const projectedDirectWalk = useMemo(() => {
    if (activeMode !== 'direct_walk') return [];

    const project = (p: Point3D) =>
      project3DTo2D(
        p,
        directAzimuth3D,
        directElevation3D,
        activeDirectZoom3D,
        640,
        520,
        directPerspective,
        directCenter3D
      );

    return fullDirectWalk.paths.map((p) => {
      const segs: CachedDirectWalkSegment[] = p.segments.map((s) => {
        const s1 = project(s.p1);
        const s2 = project(s.p2);
        return {
          p1: s.p1,
          p2: s.p2,
          s1,
          s2,
          stepIndex: s.stepIndex,
          rawVal: s.rawVal,
          isSnap: s.isSnap,
          actionDesc: s.actionDesc,
        };
      });

      const projPts: Point2D[] = p.points.map((pt) => project(pt));

      return {
        id: p.id,
        name: p.name,
        color: p.color,
        segments: segs,
        rawSegments: p.segments,
        points: p.points,
        projectedPoints: projPts,
      };
    });
  }, [
    activeMode,
    fullDirectWalk.paths,
    directAzimuth3D,
    directElevation3D,
    activeDirectZoom3D,
    directPerspective,
    directCenter3D,
  ]);

  // Sliced visible direct paths for 2D and 3D
  const visibleDirectPaths = useMemo(() => {
    if (activeMode !== 'direct_walk') return [];
    const sourcePaths =
      directActivePathFilter === 0
        ? projectedDirectWalk
        : projectedDirectWalk.filter((p) => p.id === directActivePathFilter);

    return sourcePaths.map((p) => {
      const count = Math.min(effectivePlaybackStep, p.segments.length);
      const headIdx = Math.min(effectivePlaybackStep, p.points.length - 1);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        segments: p.segments.slice(0, count),
        rawSegments: p.rawSegments.slice(0, count),
        head3D: p.points[headIdx] || p.points[0],
        headScreen: p.projectedPoints[headIdx] || p.projectedPoints[0],
        head2D: p.points[headIdx] || p.points[0],
      };
    });
  }, [activeMode, directActivePathFilter, projectedDirectWalk, effectivePlaybackStep]);

  const directPlaybackStats = useMemo(() => {
    let steps = 0;
    let snaps = 0;
    let dist = 0;
    for (const p of visibleDirectPaths) {
      for (const s of p.rawSegments) {
        if (s.isSnap) {
          snaps++;
        } else {
          steps++;
        }
        dist += Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y, s.p2.z - s.p1.z);
      }
    }
    return { stepCount: steps, snapCount: snaps, totalDistance: dist };
  }, [visibleDirectPaths]);

  // ==========================================
  // Mouse & Wheel Handlers
  // ==========================================
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeMode === 'turn_walk_3d') {
      setIsDragging3D(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeMode === 'turtle') {
      setIsDraggingTurtle(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeMode === 'direct_walk') {
      setIsDraggingDirect(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (activeMode === 'turn_walk_3d' && isDragging3D) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setAzimuth3D((prev) => (prev + dx * 0.8) % 360);
      setElevation3D((prev) => Math.max(-85, Math.min(85, prev - dy * 0.8)));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeMode === 'turtle' && isDraggingTurtle) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setUserTurtleView({
        pan: {
          x: activeTurtlePan.x + dx,
          y: activeTurtlePan.y + dy,
        },
        zoom: activeTurtleZoom,
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeMode === 'direct_walk' && isDraggingDirect) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (directCenterMode === '3d_z_step') {
        setDirectAzimuth3D((prev) => (prev + dx * 0.8) % 360);
        setDirectElevation3D((prev) => Math.max(-85, Math.min(85, prev - dy * 0.8)));
      } else {
        setUserDirect2DView({
          pan: {
            x: activeDirect2DPan.x + dx,
            y: activeDirect2DPan.y + dy,
          },
          zoom: activeDirect2DZoom,
        });
      }
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging3D(false);
    setIsDraggingTurtle(false);
    setIsDraggingDirect(false);
  };

  const handleWheelTurtle = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const nextZoom = Math.max(0.05, Math.min(10, activeTurtleZoom * zoomFactor));

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const nextPan = {
      x: mouseX - (mouseX - activeTurtlePan.x) * (nextZoom / activeTurtleZoom),
      y: mouseY - (mouseY - activeTurtlePan.y) * (nextZoom / activeTurtleZoom),
    };

    setUserTurtleView({ pan: nextPan, zoom: nextZoom });
  };

  const handleWheel3D = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    setUserZoom3D((prev) => {
      const cur = prev !== null ? prev : autoZoom3D;
      return Math.max(0.5, Math.min(100, cur * zoomFactor));
    });
  };

  const handleWheelDirect = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (directCenterMode === '3d_z_step') {
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setUserDirectZoom3D((prev) => {
        const cur = prev !== null ? prev : autoDirectZoom3D;
        return Math.max(0.5, Math.min(100, cur * zoomFactor));
      });
    } else {
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const nextZoom = Math.max(0.05, Math.min(10, activeDirect2DZoom * zoomFactor));
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const nextPan = {
        x: mouseX - (mouseX - activeDirect2DPan.x) * (nextZoom / activeDirect2DZoom),
        y: mouseY - (mouseY - activeDirect2DPan.y) * (nextZoom / activeDirect2DZoom),
      };

      setUserDirect2DView({ pan: nextPan, zoom: nextZoom });
    }
  };

  const handleStreamTypeToggle = (type: 'raw_digits' | 'trigram_decimals') => {
    setIsPlaying(false);
    setUserPlaybackStep(null);
    setStreamType(type);
  };

  const stepBy = useCallback((delta: number) => {
    setUserPlaybackStep((prev) => {
      const cur = prev === null ? effectiveMaxStep : prev;
      return Math.max(0, Math.min(effectiveMaxStep, cur + delta));
    });
  }, [effectiveMaxStep]);

  const handleTogglePlay = () => {
    if (!isPlaying) {
      if (effectivePlaybackStep >= effectiveMaxStep) {
        setUserPlaybackStep(0);
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* 1. Mode Switcher Bar */}
      <section className={styles.modeSwitcherBar}>
        <div className={styles.modeSwitcherHeader}>
          <span className={styles.modeSwitcherTitle}>Visual Interpretation & Graphing Engine</span>
          <span className={controls.btnToggleGroup}>
            <button
              type="button"
              className={`${controls.btnToggle} ${streamType === 'raw_digits' ? controls.active : ''}`}
              onClick={() => handleStreamTypeToggle('raw_digits')}
            >
              Raw Eye Digits (0..4)
            </button>
            <button
              type="button"
              className={`${controls.btnToggle} ${streamType === 'trigram_decimals' ? controls.active : ''}`}
              onClick={() => handleStreamTypeToggle('trigram_decimals')}
            >
              Trigram Decimals (0..82)
            </button>
          </span>
        </div>

        <div className={styles.modeSwitcherPills}>
          <button
            type="button"
            className={`${styles.modePill} ${activeMode === 'turtle' ? styles.active : ''}`}
            onClick={() => setActiveMode('turtle')}
          >
            <span className={styles.modePillTitle}>1. Turtle Vector Walk (2D)</span>
            <span className={styles.modePillDesc}>
              Logo/font stroke engine. Tests if eye directions draw 2D vector shapes and 0 acts as Pen-Up / Advance Right.
            </span>
          </button>

          <button
            type="button"
            className={`${styles.modePill} ${activeMode === 'turn_walk_3d' ? styles.active : ''}`}
            onClick={() => setActiveMode('turn_walk_3d')}
          >
            <span className={styles.modePillTitle}>2. 3D Turn and Walk (3D Space)</span>
            <span className={styles.modePillDesc}>
              Experimental 3D turtle. Turns 90 degrees in eye direction (1=Up, 3=Down, 2=Right, 4=Left), blank (0) steps 1 unit forward.
            </span>
          </button>

          <button
            type="button"
            className={`${styles.modePill} ${activeMode === 'direct_walk' ? styles.active : ''}`}
            onClick={() => setActiveMode('direct_walk')}
          >
            <span className={styles.modePillTitle}>3. Direct Vector Walk (3D / 2D Grid)</span>
            <span className={styles.modePillDesc}>
              Takes direction and moves directly. Toggle 3-segment trigram path branching, 3D Z-step center, or 2D N-unit grid snap.
            </span>
          </button>
        </div>
      </section>

      {/* 2. Global Data Configuration & Playback Scrubber Panel */}
      <section className={styles.controlsPanel}>
        {/* Row 1: Dataset & Reading Order */}
        <div className={styles.controlRow}>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="msg-select">Message:</label>
            <select
              id="msg-select"
              className={controls.selectDropdown}
              value={selectedMessage}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                setIsPlaying(false);
                setUserPlaybackStep(null);
                setSelectedMessage(val);
              }}
            >
              <option value="1">Message 1 (East 1 - 56 eyes / 18 tri)</option>
              <option value="2">Message 2 (West 1 - 56 eyes / 18 tri)</option>
              <option value="3">Message 3 (East 2 - 56 eyes / 18 tri)</option>
              <option value="4">Message 4 (West 2 - 57 eyes / 19 tri)</option>
              <option value="5">Message 5 (East 3 - 56 eyes / 18 tri)</option>
              <option value="6">Message 6 (West 3 - 56 eyes / 18 tri)</option>
              <option value="7">Message 7 (East 4 - 56 eyes / 18 tri)</option>
              <option value="8">Message 8 (West 4 - 56 eyes / 18 tri)</option>
              <option value="9">Message 9 (East 5 - 56 eyes / 18 tri)</option>
              <option value="all">All Messages (505 eyes / 164 tri)</option>
            </select>
          </div>

          {selectedMessage === 'all' && (
            <div className={styles.chainToggleGroup}>
              <span className={styles.controlLabel}>Chain Mode:</span>
              <div className={styles.toggleButtonGroup}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${!overlayMessages ? styles.toggleBtnActive : ''}`}
                  onClick={() => {
                    setOverlayMessages(false);
                    setUserPlaybackStep(null);
                  }}
                  title="Chain messages sequentially end-to-end (1 continuous chain of 505 eyes)"
                >
                  Continuous Chain
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${overlayMessages ? styles.toggleBtnActive : ''}`}
                  onClick={() => {
                    setOverlayMessages(true);
                    setUserPlaybackStep(null);
                  }}
                  title="Overlay messages starting from the same origin (0,0) / (0,0,0)"
                >
                  Overlay at Origin
                </button>
              </div>
            </div>
          )}

          {selectedMessage !== 'all' && (
            <button
              type="button"
              className={controls.btnSm}
              onClick={() => {
                setSelectedMessage('all');
                setOverlayMessages(true);
                setUserPlaybackStep(null);
              }}
              title="Switch to overlay mode comparing messages from the same starting point"
            >
              Overlay All
            </button>
          )}

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="pattern-select">Pattern:</label>
            <select
              id="pattern-select"
              className={controls.selectDropdown}
              value={PRESET_ORIENTATIONS.find((p) => JSON.stringify(p.pattern) === JSON.stringify(pattern))?.id || 'custom'}
              onChange={(e) => {
                const found = PRESET_ORIENTATIONS.find((p) => p.id === e.target.value);
                if (found) onChangePattern(found.pattern);
              }}
            >
              {PRESET_ORIENTATIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <MiniArrowShape pattern={pattern} width={56} height={22} />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="step-mode-select">Step:</label>
            <select
              id="step-mode-select"
              className={controls.selectDropdown}
              value={stepMode}
              onChange={(e) => onChangeStepMode(e.target.value as 'non_overlapping' | 'overlapping')}
            >
              <option value="non_overlapping">Non-Overlapping (Step 3)</option>
              <option value="overlapping">Overlapping (Step 1)</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="inversion-mode-select">Inversion:</label>
            <select
              id="inversion-mode-select"
              className={controls.selectDropdown}
              value={eyeInversion.mode}
              onChange={(e) =>
                onChangeEyeInversion({
                  ...eyeInversion,
                  mode: e.target.value as 'none' | 'return_only' | 'all',
                })
              }
            >
              <option value="none">None</option>
              <option value="return_only">Return Trigram Only</option>
              <option value="all">All Trigrams</option>
            </select>
          </div>
        </div>

        {/* Row 1b: Overlaid Messages Filter Bar (when Overlay Mode is Active) */}
        {isOverlayActive && (
          <div className={styles.overlayFilterBar}>
            <div className={styles.overlayFilterHeader}>
              <span className={styles.controlLabel}>Overlaid Messages ({visibleTracks.length}):</span>
              <div className={styles.overlayQuickActions}>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => setActiveMessageFilter([1, 2, 3, 4, 5, 6, 7, 8, 9])}
                >
                  All 9
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => setActiveMessageFilter([1, 9])}
                  title="Compare Message 1 and Message 9 (Opposite ends)"
                >
                  1 vs 9
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => setActiveMessageFilter([2, 8])}
                  title="Compare Message 2 and Message 8"
                >
                  2 vs 8
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => setActiveMessageFilter([3, 7])}
                  title="Compare Message 3 and Message 7"
                >
                  3 vs 7
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => setActiveMessageFilter([1, 2, 3])}
                  title="First 3 Messages"
                >
                  First 3 (1-3)
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => setActiveMessageFilter([7, 8, 9])}
                  title="Last 3 Messages"
                >
                  Last 3 (7-9)
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => setActiveMessageFilter([1, 3, 5, 7, 9])}
                  title="East Messages"
                >
                  East
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => setActiveMessageFilter([2, 4, 6, 8])}
                  title="West Messages"
                >
                  West
                </button>
              </div>
            </div>

            <div className={styles.overlayPillsList}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((mIdx) => {
                const isActive = activeMessageFilter.includes(mIdx);
                const color = MESSAGE_COLORS[mIdx] || '#00f0ff';
                return (
                  <button
                    key={mIdx}
                    type="button"
                    className={`${styles.msgPill} ${isActive ? styles.msgPillActive : styles.msgPillInactive}`}
                    style={{
                      borderColor: isActive ? color : 'var(--border-color)',
                      boxShadow: isActive ? `0 0 8px ${color}44` : 'none',
                      color: isActive ? color : 'var(--text-muted)',
                    }}
                    onClick={() => {
                      if (isActive) {
                        if (activeMessageFilter.length > 1) {
                          setActiveMessageFilter(activeMessageFilter.filter((id) => id !== mIdx));
                        }
                      } else {
                        setActiveMessageFilter([...activeMessageFilter, mIdx].sort((a, b) => a - b));
                      }
                    }}
                    title={MESSAGE_NAMES[mIdx]}
                  >
                    <span
                      className={styles.msgColorDot}
                      style={{ background: color, opacity: isActive ? 1 : 0.4 }}
                    />
                    M{mIdx}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 2: Playback Scrubber & Speed */}
        <div className={styles.playbackBar}>
          <div className={styles.playbackButtons}>
            <button
              type="button"
              className={controls.btnSm}
              onClick={() => stepBy(-1)}
              title="Previous Step"
            >
              -1
            </button>
            <button
              type="button"
              className={controls.btnPrimary}
              onClick={handleTogglePlay}
              style={{ minWidth: 70 }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className={controls.btnSm}
              onClick={() => stepBy(1)}
              title="Next Step"
            >
              +1
            </button>
            <button
              type="button"
              className={controls.btnSecondary}
              onClick={() => {
                setIsPlaying(false);
                setUserPlaybackStep(0);
              }}
              title="Reset to Beginning"
            >
              Reset
            </button>
            <button
              type="button"
              className={controls.btnSecondary}
              onClick={() => {
                setIsPlaying(false);
                setUserPlaybackStep(null);
              }}
              title="Jump to End"
            >
              End
            </button>
          </div>

          <div className={styles.scrubberWrapper}>
            <input
              type="range"
              className={styles.scrubberSlider}
              min={0}
              max={effectiveMaxStep}
              value={effectivePlaybackStep}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setUserPlaybackStep(val >= effectiveMaxStep ? null : val);
              }}
            />
            <span className={styles.stepCounterBadge}>
              Step {effectivePlaybackStep} / {effectiveMaxStep}
              {isOverlayActive ? ' (Overlaid)' : ' (Chain)'}
            </span>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="speed-select">Speed:</label>
            <select
              id="speed-select"
              className={controls.selectDropdown}
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            >
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="5">5x</option>
              <option value="10">10x</option>
            </select>
            <label className={styles.checkboxParam}>
              <input
                type="checkbox"
                checked={isLooping}
                onChange={(e) => setIsLooping(e.target.checked)}
              />
              Loop
            </label>
          </div>
        </div>

        {/* Row 3: Mode-Specific Parameters Sub-Bar */}
        {activeMode === 'turtle' && (
          <div className={styles.paramSubBar}>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel} htmlFor="turtle-dir-select">Direction Engine:</label>
              <select
                id="turtle-dir-select"
                className={controls.selectDropdown}
                value={turtleDirMode}
                onChange={(e) => setTurtleDirMode(e.target.value as TurtleDirectionMode)}
              >
                <option value="cardinal_4">Cardinal 4-Way (1=Up, 2=Right, 3=Down, 4=Left)</option>
                <option value="radial_5">Radial 5-Gon (72 deg pentagram rays)</option>
                <option value="relative_turn">Relative Heading (Turn & Step)</option>
                {streamType === 'trigram_decimals' && (
                  <option value="trigram_3stroke">Trigram 3-Stroke Mini Glyphs</option>
                )}
              </select>
            </div>

            <div className={styles.sliderParam}>
              <span className={styles.controlLabel}>Step Size:</span>
              <input
                type="range"
                className={styles.sliderParamInput}
                min={6}
                max={45}
                value={turtleStepLength}
                onChange={(e) => setTurtleStepLength(parseInt(e.target.value, 10))}
              />
              <span className={styles.sliderValueText}>{turtleStepLength}px</span>
            </div>

            <label className={styles.checkboxParam}>
              <input
                type="checkbox"
                checked={turtlePenUpOnZero}
                onChange={(e) => setTurtlePenUpOnZero(e.target.checked)}
              />
              0 as Pen-Up / Advance Right
            </label>

            {turtlePenUpOnZero && (
              <>
                <div className={styles.sliderParam}>
                  <span className={styles.controlLabel}>Advance:</span>
                  <input
                    type="range"
                    className={styles.sliderParamInput}
                    min={12}
                    max={60}
                    value={turtleAdvanceWidth}
                    onChange={(e) => setTurtleAdvanceWidth(parseInt(e.target.value, 10))}
                  />
                  <span className={styles.sliderValueText}>{turtleAdvanceWidth}px</span>
                </div>

                <div className={styles.sliderParam}>
                  <span className={styles.controlLabel}>Wrap:</span>
                  <input
                    type="range"
                    className={styles.sliderParamInput}
                    min={200}
                    max={800}
                    step={50}
                    value={turtleWrapWidth}
                    onChange={(e) => setTurtleWrapWidth(parseInt(e.target.value, 10))}
                  />
                  <span className={styles.sliderValueText}>{turtleWrapWidth}px</span>
                </div>

                <label className={styles.checkboxParam}>
                  <input
                    type="checkbox"
                    checked={turtleResetY}
                    onChange={(e) => setTurtleResetY(e.target.checked)}
                  />
                  Reset Y to Baseline
                </label>
              </>
            )}

            {turtleDirMode === 'relative_turn' && (
              <div className={styles.sliderParam}>
                <span className={styles.controlLabel}>Turn Angle:</span>
                <input
                  type="range"
                  className={styles.sliderParamInput}
                  min={30}
                  max={120}
                  step={6}
                  value={turtleTurnAngle}
                  onChange={(e) => setTurtleTurnAngle(parseInt(e.target.value, 10))}
                />
                <span className={styles.sliderValueText}>{turtleTurnAngle} deg</span>
              </div>
            )}
          </div>
        )}

        {activeMode === 'turn_walk_3d' && (
          <div className={styles.paramSubBar}>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel} htmlFor="turnwalk-mode-select">Step Rule:</label>
              <select
                id="turnwalk-mode-select"
                className={controls.selectDropdown}
                value={turnWalkStepMode}
                onChange={(e) => setTurnWalkStepMode(e.target.value as TurnWalk3DStepMode)}
              >
                <option value="blank_only">Blank (0) Steps, Eyes (1-4) Turn</option>
                <option value="every_command">Turn & Step Every Instruction</option>
              </select>
            </div>

            <div className={styles.sliderParam}>
              <span className={styles.controlLabel}>Step Unit:</span>
              <input
                type="range"
                className={styles.sliderParamInput}
                min={4}
                max={40}
                value={turnWalkStepSize}
                onChange={(e) => setTurnWalkStepSize(parseInt(e.target.value, 10))}
              />
              <span className={styles.sliderValueText}>{turnWalkStepSize}px</span>
            </div>

            <div className={styles.controlGroup}>
              <label className={styles.controlLabel} htmlFor="turn-angle-select">Turn Angle:</label>
              <select
                id="turn-angle-select"
                className={controls.selectDropdown}
                value={turnWalkTurnAngle}
                onChange={(e) => setTurnWalkTurnAngle(parseInt(e.target.value, 10))}
              >
                <option value="90">90 deg (Orthogonal 3D Grid)</option>
                <option value="45">45 deg (Octagonal 3D)</option>
                <option value="60">60 deg (Hexagonal 3D)</option>
                <option value="72">72 deg (Pentagonal 3D)</option>
                <option value="120">120 deg (Trigonal 3D)</option>
              </select>
            </div>

            <div className={styles.controlGroup}>
              <label className={styles.controlLabel} htmlFor="heading-select">Start Facing:</label>
              <select
                id="heading-select"
                className={controls.selectDropdown}
                value={turnWalkHeading}
                onChange={(e) => setTurnWalkHeading(e.target.value as 'pos_x' | 'pos_y' | 'pos_z')}
              >
                <option value="pos_x">+X (East / Right)</option>
                <option value="pos_y">+Y (North / Up)</option>
                <option value="pos_z">+Z (Front / Depth)</option>
              </select>
            </div>

            <div className={styles.sliderParam}>
              <span className={styles.controlLabel}>Yaw:</span>
              <input
                type="range"
                className={styles.sliderParamInput}
                min={0}
                max={360}
                value={azimuth3D}
                onChange={(e) => setAzimuth3D(parseInt(e.target.value, 10))}
              />
              <span className={styles.sliderValueText}>{azimuth3D} deg</span>
            </div>

            <div className={styles.sliderParam}>
              <span className={styles.controlLabel}>Pitch:</span>
              <input
                type="range"
                className={styles.sliderParamInput}
                min={-85}
                max={85}
                value={elevation3D}
                onChange={(e) => setElevation3D(parseInt(e.target.value, 10))}
              />
              <span className={styles.sliderValueText}>{elevation3D} deg</span>
            </div>

            <label className={styles.checkboxParam}>
              <input
                type="checkbox"
                checked={isPerspective3D}
                onChange={(e) => setIsPerspective3D(e.target.checked)}
              />
              Perspective
            </label>
          </div>
        )}

        {activeMode === 'direct_walk' && (
          <div className={styles.paramSubBar}>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel} htmlFor="direct-center-select">Center Eye (0):</label>
              <select
                id="direct-center-select"
                className={controls.selectDropdown}
                value={directCenterMode}
                onChange={(e) => setDirectCenterMode(e.target.value as DirectWalkCenterMode)}
              >
                <option value="3d_z_step">3D Mode: Step +Z Direction</option>
                <option value="2d_grid_snap">2D Mode: Snap to Next N Units</option>
                <option value="2d_rest">2D Mode: Rest / Neutral</option>
              </select>
            </div>

            <label className={styles.checkboxParam}>
              <input
                type="checkbox"
                checked={directSplitTrigrams}
                onChange={(e) => setDirectSplitTrigrams(e.target.checked)}
              />
              3 Trigram Paths (Eye 1, 2, 3)
            </label>

            {directSplitTrigrams && (
              <>
                <div className={styles.controlGroup}>
                  <label className={styles.controlLabel} htmlFor="path-filter-select">Visible Path:</label>
                  <select
                    id="path-filter-select"
                    className={controls.selectDropdown}
                    value={directActivePathFilter}
                    onChange={(e) => setDirectActivePathFilter(parseInt(e.target.value, 10))}
                  >
                    <option value="0">All 3 Paths (Overlay)</option>
                    <option value="1">Path 1 Only (Eye 1 - Cyan)</option>
                    <option value="2">Path 2 Only (Eye 2 - Amber)</option>
                    <option value="3">Path 3 Only (Eye 3 - Magenta)</option>
                  </select>
                </div>

                <div className={styles.sliderParam}>
                  <span className={styles.controlLabel}>Path Spacing:</span>
                  <input
                    type="range"
                    className={styles.sliderParamInput}
                    min={0}
                    max={60}
                    value={directPathSpacing}
                    onChange={(e) => setDirectPathSpacing(parseInt(e.target.value, 10))}
                  />
                  <span className={styles.sliderValueText}>{directPathSpacing}px</span>
                </div>
              </>
            )}

            {directCenterMode === '2d_grid_snap' && (
              <>
                <div className={styles.sliderParam}>
                  <span className={styles.controlLabel}>Snap Grid N:</span>
                  <input
                    type="range"
                    className={styles.sliderParamInput}
                    min={2}
                    max={20}
                    value={directSnapN}
                    onChange={(e) => setDirectSnapN(parseInt(e.target.value, 10))}
                  />
                  <span className={styles.sliderValueText}>{directSnapN} units</span>
                </div>

                <label className={styles.checkboxParam}>
                  <input
                    type="checkbox"
                    checked={directResetY}
                    onChange={(e) => setDirectResetY(e.target.checked)}
                  />
                  Reset Y on Snap
                </label>
              </>
            )}

            <div className={styles.sliderParam}>
              <span className={styles.controlLabel}>Step Unit:</span>
              <input
                type="range"
                className={styles.sliderParamInput}
                min={4}
                max={40}
                value={directStepSize}
                onChange={(e) => setDirectStepSize(parseInt(e.target.value, 10))}
              />
              <span className={styles.sliderValueText}>{directStepSize}px</span>
            </div>

            {directCenterMode === '3d_z_step' && (
              <>
                <div className={styles.sliderParam}>
                  <span className={styles.controlLabel}>Yaw:</span>
                  <input
                    type="range"
                    className={styles.sliderParamInput}
                    min={0}
                    max={360}
                    value={directAzimuth3D}
                    onChange={(e) => setDirectAzimuth3D(parseInt(e.target.value, 10))}
                  />
                  <span className={styles.sliderValueText}>{directAzimuth3D} deg</span>
                </div>

                <div className={styles.sliderParam}>
                  <span className={styles.controlLabel}>Pitch:</span>
                  <input
                    type="range"
                    className={styles.sliderParamInput}
                    min={-85}
                    max={85}
                    value={directElevation3D}
                    onChange={(e) => setDirectElevation3D(parseInt(e.target.value, 10))}
                  />
                  <span className={styles.sliderValueText}>{directElevation3D} deg</span>
                </div>

                <label className={styles.checkboxParam}>
                  <input
                    type="checkbox"
                    checked={directPerspective}
                    onChange={(e) => setDirectPerspective(e.target.checked)}
                  />
                  Perspective
                </label>
              </>
            )}
          </div>
        )}
      </section>

      {/* 3. Main Visual Card */}
      <section className={styles.viewportCard}>
        <header className={styles.viewportHeader}>
          <div className={styles.viewportTitleGroup}>
            <span className={styles.viewportTitle}>
              {activeMode === 'turtle' &&
                `Turtle Vector Walk (2D Stroke Engine)${isOverlayActive ? ` | ${visibleTracks.length} Overlaid Messages from (0,0)` : ''}`}
              {activeMode === 'turn_walk_3d' &&
                `3D Turn and Walk (3D Space Tracer)${isOverlayActive ? ` | ${visibleTracks.length} Overlaid Messages from (0,0,0)` : ''}`}
              {activeMode === 'direct_walk' &&
                `Direct Vector Walk (${directCenterMode === '3d_z_step' ? '3D Space with Z-Step' : '2D Grid Snap'}${isOverlayActive ? ` | ${visibleTracks.length} Overlaid Messages` : directSplitTrigrams ? ' | 3 Trigram Paths' : ''})`}
            </span>
            <span className={styles.viewportMetaBadge}>
              {streamType === 'raw_digits' ? 'Raw Eye Values (0..4)' : 'Trigram Values'}
            </span>
          </div>

          <div className={styles.viewportActions}>
            {activeMode === 'turtle' && (
              <>
                <button
                  type="button"
                  className={`${controls.btnSm} ${userTurtleView === null ? controls.active : ''}`}
                  onClick={() => setUserTurtleView(null)}
                  title="Auto-Fit entire trail into view"
                >
                  Auto-Fit
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => {
                    const head = visibleTurtleHeads[visibleTurtleHeads.length - 1]?.point;
                    if (head) {
                      setUserTurtleView({
                        zoom: activeTurtleZoom,
                        pan: {
                          x: 320 - head.x * activeTurtleZoom,
                          y: 260 - head.y * activeTurtleZoom,
                        },
                      });
                    }
                  }}
                  title="Center view on current pen position"
                >
                  Center Pen
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => {
                    const nextZoom = Math.min(10, activeTurtleZoom * 1.25);
                    setUserTurtleView({
                      zoom: nextZoom,
                      pan: {
                        x: 320 - (320 - activeTurtlePan.x) * 1.25,
                        y: 260 - (260 - activeTurtlePan.y) * 1.25,
                      },
                    });
                  }}
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => {
                    const nextZoom = Math.max(0.05, activeTurtleZoom / 1.25);
                    setUserTurtleView({
                      zoom: nextZoom,
                      pan: {
                        x: 320 - (320 - activeTurtlePan.x) / 1.25,
                        y: 260 - (260 - activeTurtlePan.y) / 1.25,
                      },
                    });
                  }}
                  title="Zoom out"
                >
                  -
                </button>
                <span className={styles.zoomLevelBadge} title="Current Zoom Factor">
                  {Math.round(activeTurtleZoom * 100)}%
                </span>
              </>
            )}

            {activeMode === 'turn_walk_3d' && (
              <>
                <button
                  type="button"
                  className={`${controls.btnSm} ${userZoom3D === null ? controls.active : ''}`}
                  onClick={() => setUserZoom3D(null)}
                  title="Auto-Fit 3D Camera to framing bounds"
                >
                  Auto-Fit Camera
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => {
                    setAzimuth3D(35);
                    setElevation3D(25);
                    setUserZoom3D(null);
                  }}
                  title="Reset 3D camera angles and zoom"
                >
                  Reset View
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => {
                    setUserZoom3D((prev) => (prev !== null ? prev : autoZoom3D) * 1.25);
                  }}
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => {
                    setUserZoom3D((prev) => Math.max(0.5, (prev !== null ? prev : autoZoom3D) / 1.25));
                  }}
                  title="Zoom Out"
                >
                  -
                </button>
                <span className={styles.zoomLevelBadge} title="3D Zoom Factor">
                  {Math.round(activeZoom3D * 10)}
                </span>
              </>
            )}

            {activeMode === 'direct_walk' && (
              <>
                <button
                  type="button"
                  className={`${controls.btnSm} ${directCenterMode === '3d_z_step' ? (userDirectZoom3D === null ? controls.active : '') : (userDirect2DView === null ? controls.active : '')}`}
                  onClick={() => {
                    setUserDirectZoom3D(null);
                    setUserDirect2DView(null);
                  }}
                  title="Auto-Fit view"
                >
                  Auto-Fit
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => {
                    if (directCenterMode === '3d_z_step') {
                      setDirectAzimuth3D(35);
                      setDirectElevation3D(25);
                      setUserDirectZoom3D(null);
                    } else {
                      setUserDirect2DView(null);
                    }
                  }}
                  title="Reset view"
                >
                  Reset View
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => {
                    if (directCenterMode === '3d_z_step') {
                      setUserDirectZoom3D((prev) => (prev !== null ? prev : autoDirectZoom3D) * 1.25);
                    } else {
                      const nextZoom = Math.min(10, activeDirect2DZoom * 1.25);
                      setUserDirect2DView({
                        zoom: nextZoom,
                        pan: {
                          x: 320 - (320 - activeDirect2DPan.x) * 1.25,
                          y: 260 - (260 - activeDirect2DPan.y) * 1.25,
                        },
                      });
                    }
                  }}
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  className={controls.btnSm}
                  onClick={() => {
                    if (directCenterMode === '3d_z_step') {
                      setUserDirectZoom3D((prev) => Math.max(0.5, (prev !== null ? prev : autoDirectZoom3D) / 1.25));
                    } else {
                      const nextZoom = Math.max(0.05, activeDirect2DZoom / 1.25);
                      setUserDirect2DView({
                        zoom: nextZoom,
                        pan: {
                          x: 320 - (320 - activeDirect2DPan.x) / 1.25,
                          y: 260 - (260 - activeDirect2DPan.y) / 1.25,
                        },
                      });
                    }
                  }}
                  title="Zoom out"
                >
                  -
                </button>
                <span className={styles.zoomLevelBadge} title="Zoom Level">
                  {directCenterMode === '3d_z_step'
                    ? Math.round(activeDirectZoom3D * 10)
                    : `${Math.round(activeDirect2DZoom * 100)}%`}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Viewport Canvas Container */}
        <div
          className={styles.canvasContainer}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          style={{
            cursor:
              activeMode === 'turn_walk_3d'
                ? isDragging3D
                  ? 'grabbing'
                  : 'grab'
                : activeMode === 'turtle'
                  ? isDraggingTurtle
                    ? 'grabbing'
                    : 'grab'
                  : activeMode === 'direct_walk'
                    ? isDraggingDirect
                      ? 'grabbing'
                      : 'grab'
                    : 'default',
          }}
        >
          {activeMode === 'turtle' && (
            <span className={styles.dragOrbitHint}>Drag canvas to pan | Scroll wheel to zoom</span>
          )}
          {activeMode === 'turn_walk_3d' && (
            <span className={styles.dragOrbitHint}>Drag canvas to orbit 3D camera | Scroll wheel to zoom</span>
          )}
          {activeMode === 'direct_walk' && (
            <span className={styles.dragOrbitHint}>
              {directCenterMode === '3d_z_step'
                ? 'Drag canvas to orbit 3D camera | Scroll wheel to zoom'
                : 'Drag canvas to pan | Scroll wheel to zoom'}
            </span>
          )}

          {/* MODE 1: Turtle Walk SVG */}
          {activeMode === 'turtle' && (
            <svg
              className={styles.graphSvg}
              viewBox="0 0 640 520"
              onWheel={handleWheelTurtle}
            >
              <defs>
                <linearGradient id="turtleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f0ff" />
                  <stop offset="50%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <g transform={`translate(${activeTurtlePan.x}, ${activeTurtlePan.y}) scale(${activeTurtleZoom})`}>
                {/* Grid origin marker */}
                <circle cx="0" cy="0" r="4" fill="#10b981" />
                <text x="8" y="4" fill="#10b981" fontSize="11" fontFamily="var(--font-mono)">
                  Origin (0,0)
                </text>

                {/* Bounding box guide */}
                {turtlePenUpOnZero && turtleWrapWidth > 0 && (
                  <line
                    x1={turtleWrapWidth}
                    y1={Math.min(-100, fullTurtleWalk.bounds.minY - 50)}
                    x2={turtleWrapWidth}
                    y2={Math.max(400, fullTurtleWalk.bounds.maxY + 50)}
                    stroke="rgba(255, 255, 255, 0.12)"
                    strokeDasharray="4,4"
                  />
                )}

                {/* Segments */}
                {visibleTurtleSegments.map((seg, idx) => {
                  if (seg.isPenUp) {
                    return (
                      <line
                        key={idx}
                        x1={seg.x1}
                        y1={seg.y1}
                        x2={seg.x2}
                        y2={seg.y2}
                        stroke="rgba(255, 255, 255, 0.15)"
                        strokeDasharray="2,3"
                        strokeWidth="1"
                      />
                    );
                  }

                  const progress = idx / Math.max(1, visibleTurtleSegments.length);
                  const strokeColor = seg.color || (progress < 0.5 ? '#00f0ff' : '#f59e0b');

                  return (
                    <line
                      key={idx}
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke={strokeColor}
                      strokeWidth={Math.max(1.5, 2.5 / Math.sqrt(activeTurtleZoom))}
                      strokeLinecap="round"
                      onMouseEnter={() => {
                        setHoveredInfo({
                          title: `${seg.messageIndex ? `${MESSAGE_NAMES[seg.messageIndex]} | ` : ''}Step ${seg.stepIndex + 1}`,
                          details: [
                            `Eye Value: ${seg.value}`,
                            `From: (${Math.round(seg.x1)}, ${Math.round(seg.y1)})`,
                            `To: (${Math.round(seg.x2)}, ${Math.round(seg.y2)})`,
                          ],
                        });
                      }}
                      onMouseLeave={() => setHoveredInfo(null)}
                    />
                  );
                })}

                {/* Vertex points (rendered only when single track to maintain peak performance) */}
                {!isOverlayActive &&
                  visibleTurtleSegments.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx={seg.x2}
                      cy={seg.y2}
                      r={Math.max(1.2, 2 / Math.sqrt(activeTurtleZoom))}
                      fill="rgba(255, 255, 255, 0.5)"
                    />
                  ))}

                {/* Current Pen Heads */}
                {visibleTurtleHeads.map((beacon) => (
                  <g key={`beacon-turtle-${beacon.messageIndex}`} transform={`translate(${beacon.point.x}, ${beacon.point.y})`}>
                    <circle r="6" fill={beacon.color} filter="url(#glowFilter)" />
                    <circle r="12" fill="none" stroke={beacon.color} strokeWidth="1.5" opacity="0.6">
                      <animate attributeName="r" values="6;16;6" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                    </circle>
                    {isOverlayActive && (
                      <text
                        x="9"
                        y="4"
                        fill={beacon.color}
                        fontSize="10"
                        fontFamily="var(--font-mono)"
                        fontWeight="700"
                      >
                        M{beacon.messageIndex}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            </svg>
          )}

          {/* MODE 2: 3D Turn and Walk SVG */}
          {activeMode === 'turn_walk_3d' && (
            <svg
              className={styles.graphSvg}
              viewBox="0 0 640 520"
              onWheel={handleWheel3D}
            >
              <defs>
                <filter id="glow3D" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* 3D Reference Floor Grid */}
              {(() => {
                const bounds = fullTurnWalk3D.bounds;
                const floorY = bounds.minY;
                const gridR = Math.max(bounds.width, bounds.depth, 30) / 2 + 10;
                const cx = bounds.centerX;
                const cz = bounds.centerZ;
                const gridLines: Array<[Point3D, Point3D]> = [];
                const step = Math.max(5, Math.round(gridR / 4));

                for (let x = -gridR; x <= gridR; x += step) {
                  gridLines.push([
                    { x: cx + x, y: floorY, z: cz - gridR },
                    { x: cx + x, y: floorY, z: cz + gridR },
                  ]);
                }
                for (let z = -gridR; z <= gridR; z += step) {
                  gridLines.push([
                    { x: cx - gridR, y: floorY, z: cz + z },
                    { x: cx + gridR, y: floorY, z: cz + z },
                  ]);
                }

                return gridLines.map(([p1, p2], idx) => {
                  const s1 = project3DTo2D(p1, azimuth3D, elevation3D, activeZoom3D, 640, 520, isPerspective3D, center3D);
                  const s2 = project3DTo2D(p2, azimuth3D, elevation3D, activeZoom3D, 640, 520, isPerspective3D, center3D);
                  return (
                    <line
                      key={`grid-${idx}`}
                      x1={s1.x}
                      y1={s1.y}
                      x2={s2.x}
                      y2={s2.y}
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeWidth="0.8"
                    />
                  );
                });
              })()}

              {/* Origin Reference Node (0, 0, 0) */}
              {(() => {
                const originScreen = project3DTo2D(
                  { x: 0, y: 0, z: 0 },
                  azimuth3D,
                  elevation3D,
                  activeZoom3D,
                  640,
                  520,
                  isPerspective3D,
                  center3D
                );
                return (
                  <g transform={`translate(${originScreen.x}, ${originScreen.y})`}>
                    <circle r="4" fill="#10b981" />
                    <text x="6" y="3" fill="#10b981" fontSize="10" fontFamily="var(--font-mono)">
                      (0,0,0)
                    </text>
                  </g>
                );
              })()}

              {/* 3D Walk Trajectory Segments (Pre-projected 2D coordinates) */}
              {visible3DSegments.map((seg, idx) => {
                if (!seg.isStep) return null;
                const progress = idx / Math.max(1, visible3DSegments.length);
                const color = seg.color || (progress < 0.5 ? '#00f0ff' : '#f59e0b');

                return (
                  <line
                    key={`seg-${idx}`}
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke={color}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    onMouseEnter={() => {
                      setHoveredInfo({
                        title: `${seg.messageIndex ? `${MESSAGE_NAMES[seg.messageIndex]} | ` : ''}Step ${seg.stepIndex + 1}`,
                        details: [
                          `Action: ${seg.actionDesc}`,
                          `From: (${Math.round(seg.p1.x)}, ${Math.round(seg.p1.y)}, ${Math.round(seg.p1.z)})`,
                          `To: (${Math.round(seg.p2.x)}, ${Math.round(seg.p2.y)}, ${Math.round(seg.p2.z)})`,
                        ],
                      });
                    }}
                    onMouseLeave={() => setHoveredInfo(null)}
                  />
                );
              })}

              {/* 3D Vertices (only when single track to maintain peak performance) */}
              {!isOverlayActive &&
                visible3DSegments.map((seg, idx) => {
                  return (
                    <circle
                      key={`vert-${idx}`}
                      cx={seg.x2}
                      cy={seg.y2}
                      r="2.2"
                      fill={seg.color || 'rgba(0, 240, 255, 0.7)'}
                      onMouseEnter={() => {
                        setHoveredInfo({
                          title: `${seg.messageIndex ? `${MESSAGE_NAMES[seg.messageIndex]} | ` : ''}Position #${seg.stepIndex + 1}`,
                          details: [
                            `Coords: (${Math.round(seg.p2.x)}, ${Math.round(seg.p2.y)}, ${Math.round(seg.p2.z)})`,
                            `Action: ${seg.actionDesc}`,
                          ],
                        });
                      }}
                      onMouseLeave={() => setHoveredInfo(null)}
                    />
                  );
                })}

              {/* 3D Head Beacons */}
              {visible3DHeads.map((beacon) => {
                return (
                  <g key={`beacon-3d-${beacon.messageIndex}`}>
                    <line
                      x1={beacon.screenPos.x}
                      y1={beacon.screenPos.y}
                      x2={beacon.screenArrow.x}
                      y2={beacon.screenArrow.y}
                      stroke={beacon.color}
                      strokeWidth="2"
                      strokeDasharray="2,2"
                    />
                    <circle cx={beacon.screenArrow.x} cy={beacon.screenArrow.y} r="3" fill={beacon.color} />
                    <g transform={`translate(${beacon.screenPos.x}, ${beacon.screenPos.y})`}>
                      <circle r="6" fill={beacon.color} filter="url(#glow3D)" />
                      <circle r="14" fill="none" stroke={beacon.color} strokeWidth="1.5">
                        <animate attributeName="r" values="6;16;6" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                      </circle>
                      {isOverlayActive && (
                        <text
                          x="9"
                          y="4"
                          fill={beacon.color}
                          fontSize="10"
                          fontFamily="var(--font-mono)"
                          fontWeight="700"
                        >
                          M{beacon.messageIndex}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}

              {/* 3D Coordinate Axis Triad */}
              <g transform="translate(60, 60)">
                {(() => {
                  const ox = project3DTo2D({ x: 0, y: 0, z: 0 }, azimuth3D, elevation3D, 20, 0, 0, false);
                  const xx = project3DTo2D({ x: 1.5, y: 0, z: 0 }, azimuth3D, elevation3D, 20, 0, 0, false);
                  const yy = project3DTo2D({ x: 0, y: 1.5, z: 0 }, azimuth3D, elevation3D, 20, 0, 0, false);
                  const zz = project3DTo2D({ x: 0, y: 0, z: 1.5 }, azimuth3D, elevation3D, 20, 0, 0, false);
                  return (
                    <>
                      <circle cx={ox.x} cy={ox.y} r="2" fill="#ffffff" />
                      <line x1={ox.x} y1={ox.y} x2={xx.x} y2={xx.y} stroke="#ef4444" strokeWidth="2" />
                      <text x={xx.x + 3} y={xx.y + 3} fill="#ef4444" fontSize="10" fontFamily="var(--font-mono)">
                        +X
                      </text>
                      <line x1={ox.x} y1={ox.y} x2={yy.x} y2={yy.y} stroke="#10b981" strokeWidth="2" />
                      <text x={yy.x + 3} y={yy.y + 3} fill="#10b981" fontSize="10" fontFamily="var(--font-mono)">
                        +Y
                      </text>
                      <line x1={ox.x} y1={ox.y} x2={zz.x} y2={zz.y} stroke="#3b82f6" strokeWidth="2" />
                      <text x={zz.x + 3} y={zz.y + 3} fill="#3b82f6" fontSize="10" fontFamily="var(--font-mono)">
                        +Z
                      </text>
                    </>
                  );
                })()}
              </g>
            </svg>
          )}

          {/* MODE 3: Direct Vector Walk SVG */}
          {activeMode === 'direct_walk' && (
            <>
              {directCenterMode === '3d_z_step' ? (
                /* 3D Direct Walk Viewport */
                <svg
                  className={styles.graphSvg}
                  viewBox="0 0 640 520"
                  onWheel={handleWheelDirect}
                >
                  <defs>
                    <filter id="glowDirect3D" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* 3D Reference Floor Grid */}
                  {(() => {
                    const bounds = fullDirectWalk.overallBounds;
                    const floorY = bounds.minY;
                    const gridR = Math.max(bounds.width, bounds.depth, 30) / 2 + 10;
                    const cx = bounds.centerX;
                    const cz = bounds.centerZ;
                    const gridLines: Array<[Point3D, Point3D]> = [];
                    const step = Math.max(5, Math.round(gridR / 4));

                    for (let x = -gridR; x <= gridR; x += step) {
                      gridLines.push([
                        { x: cx + x, y: floorY, z: cz - gridR },
                        { x: cx + x, y: floorY, z: cz + gridR },
                      ]);
                    }
                    for (let z = -gridR; z <= gridR; z += step) {
                      gridLines.push([
                        { x: cx - gridR, y: floorY, z: cz + z },
                        { x: cx + gridR, y: floorY, z: cz + z },
                      ]);
                    }

                    return gridLines.map(([p1, p2], idx) => {
                      const s1 = project3DTo2D(p1, directAzimuth3D, directElevation3D, activeDirectZoom3D, 640, 520, directPerspective, directCenter3D);
                      const s2 = project3DTo2D(p2, directAzimuth3D, directElevation3D, activeDirectZoom3D, 640, 520, directPerspective, directCenter3D);
                      return (
                        <line
                          key={`dgrid-${idx}`}
                          x1={s1.x}
                          y1={s1.y}
                          x2={s2.x}
                          y2={s2.y}
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeWidth="0.8"
                        />
                      );
                    });
                  })()}

                  {/* Origin Marker (0,0,0) */}
                  {(() => {
                    const originScreen = project3DTo2D(
                      { x: 0, y: 0, z: 0 },
                      directAzimuth3D,
                      directElevation3D,
                      activeDirectZoom3D,
                      640,
                      520,
                      directPerspective,
                      directCenter3D
                    );
                    return (
                      <g transform={`translate(${originScreen.x}, ${originScreen.y})`}>
                        <circle r="4" fill="#10b981" />
                        <text x="6" y="3" fill="#10b981" fontSize="10" fontFamily="var(--font-mono)">
                          (0,0,0)
                        </text>
                      </g>
                    );
                  })()}

                  {/* Render Visible Paths */}
                  {visibleDirectPaths.map((path) => (
                    <g key={`path-${path.id}`}>
                      {path.segments.map((seg, sIdx) => {
                        return (
                          <line
                            key={`seg-${path.id}-${sIdx}`}
                            x1={seg.s1.x}
                            y1={seg.s1.y}
                            x2={seg.s2.x}
                            y2={seg.s2.y}
                            stroke={path.color}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            onMouseEnter={() => {
                              setHoveredInfo({
                                title: `${path.name} - Step ${sIdx + 1}`,
                                details: [
                                  `Action: ${seg.actionDesc}`,
                                  `From: (${Math.round(seg.p1.x)}, ${Math.round(seg.p1.y)}, ${Math.round(seg.p1.z)})`,
                                  `To: (${Math.round(seg.p2.x)}, ${Math.round(seg.p2.y)}, ${Math.round(seg.p2.z)})`,
                                ],
                              });
                            }}
                            onMouseLeave={() => setHoveredInfo(null)}
                          />
                        );
                      })}

                      {/* Head beacon */}
                      {path.headScreen && (
                        <g transform={`translate(${path.headScreen.x}, ${path.headScreen.y})`}>
                          <circle r="5" fill={path.color} filter="url(#glowDirect3D)" />
                          <circle r="12" fill="none" stroke={path.color} strokeWidth="1.5">
                            <animate attributeName="r" values="5;14;5" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                          </circle>
                          {isOverlayActive && (
                            <text
                              x="9"
                              y="4"
                              fill={path.color}
                              fontSize="10"
                              fontFamily="var(--font-mono)"
                              fontWeight="700"
                            >
                              M{path.id}
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  ))}

                  {/* 3D Coordinate Axis Triad */}
                  <g transform="translate(60, 60)">
                    {(() => {
                      const ox = project3DTo2D({ x: 0, y: 0, z: 0 }, directAzimuth3D, directElevation3D, 20, 0, 0, false);
                      const xx = project3DTo2D({ x: 1.5, y: 0, z: 0 }, directAzimuth3D, directElevation3D, 20, 0, 0, false);
                      const yy = project3DTo2D({ x: 0, y: 1.5, z: 0 }, directAzimuth3D, directElevation3D, 20, 0, 0, false);
                      const zz = project3DTo2D({ x: 0, y: 0, z: 1.5 }, directAzimuth3D, directElevation3D, 20, 0, 0, false);
                      return (
                        <>
                          <circle cx={ox.x} cy={ox.y} r="2" fill="#ffffff" />
                          <line x1={ox.x} y1={ox.y} x2={xx.x} y2={xx.y} stroke="#ef4444" strokeWidth="2" />
                          <text x={xx.x + 3} y={xx.y + 3} fill="#ef4444" fontSize="10" fontFamily="var(--font-mono)">
                            +X
                          </text>
                          <line x1={ox.x} y1={ox.y} x2={yy.x} y2={yy.y} stroke="#10b981" strokeWidth="2" />
                          <text x={yy.x + 3} y={yy.y + 3} fill="#10b981" fontSize="10" fontFamily="var(--font-mono)">
                            +Y
                          </text>
                          <line x1={ox.x} y1={ox.y} x2={zz.x} y2={zz.y} stroke="#3b82f6" strokeWidth="2" />
                          <text x={zz.x + 3} y={zz.y + 3} fill="#3b82f6" fontSize="10" fontFamily="var(--font-mono)">
                            +Z
                          </text>
                        </>
                      );
                    })()}
                  </g>
                </svg>
              ) : (
                /* 2D Direct Walk with Grid Snap Viewport */
                <svg
                  className={styles.graphSvg}
                  viewBox="0 0 640 520"
                  onWheel={handleWheelDirect}
                >
                  <defs>
                    <filter id="glowDirect2D" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  <g transform={`translate(${activeDirect2DPan.x}, ${activeDirect2DPan.y}) scale(${activeDirect2DZoom})`}>
                    {/* Grid Snap slot boundary lines */}
                    {directCenterMode === '2d_grid_snap' && (() => {
                      const unitPixels = Math.max(1, directSnapN * directStepSize);
                      const minX = fullDirectWalk.overallBounds.minX - unitPixels * 2;
                      const maxX = fullDirectWalk.overallBounds.maxX + unitPixels * 3;
                      const minY = fullDirectWalk.overallBounds.minY - 50;
                      const maxY = fullDirectWalk.overallBounds.maxY + 50;
                      const slotLines: number[] = [];

                      const startSlot = Math.floor(minX / unitPixels);
                      const endSlot = Math.ceil(maxX / unitPixels);

                      for (let k = startSlot; k <= endSlot; k++) {
                        slotLines.push(k * unitPixels);
                      }

                      return slotLines.map((gx) => (
                        <g key={`snap-line-${gx}`}>
                          <line
                            x1={gx}
                            y1={minY}
                            x2={gx}
                            y2={maxY}
                            stroke="rgba(255, 255, 255, 0.1)"
                            strokeDasharray="4,4"
                          />
                          <text
                            x={gx + 4}
                            y={minY + 14}
                            fill="rgba(255, 255, 255, 0.3)"
                            fontSize="9"
                            fontFamily="var(--font-mono)"
                          >
                            X={Math.round(gx / directStepSize)}
                          </text>
                        </g>
                      ));
                    })()}

                    {/* Origin marker */}
                    <circle cx="0" cy="0" r="4" fill="#10b981" />
                    <text x="6" y="4" fill="#10b981" fontSize="10" fontFamily="var(--font-mono)">
                      (0,0)
                    </text>

                    {/* Render paths */}
                    {visibleDirectPaths.map((path) => (
                      <g key={`path2d-${path.id}`}>
                        {path.rawSegments.map((seg, sIdx) => {
                          if (seg.isSnap) {
                            // Snap jump segment (dashed amber/cyan)
                            return (
                              <line
                                key={`snap-seg-${path.id}-${sIdx}`}
                                x1={seg.p1.x}
                                y1={seg.p1.y}
                                x2={seg.p2.x}
                                y2={seg.p2.y}
                                stroke="#f59e0b"
                                strokeWidth="1.8"
                                strokeDasharray="3,3"
                                opacity="0.8"
                                onMouseEnter={() => {
                                  setHoveredInfo({
                                    title: `${path.name} - Grid Snap`,
                                    details: [
                                      seg.actionDesc,
                                      `From X=${Math.round(seg.p1.x / directStepSize)}`,
                                      `To X=${Math.round(seg.p2.x / directStepSize)}`,
                                    ],
                                  });
                                }}
                                onMouseLeave={() => setHoveredInfo(null)}
                              />
                            );
                          }

                          return (
                            <line
                              key={`norm-seg-${path.id}-${sIdx}`}
                              x1={seg.p1.x}
                              y1={seg.p1.y}
                              x2={seg.p2.x}
                              y2={seg.p2.y}
                              stroke={path.color}
                              strokeWidth={Math.max(1.5, 2.4 / Math.sqrt(activeDirect2DZoom))}
                              strokeLinecap="round"
                              onMouseEnter={() => {
                                setHoveredInfo({
                                  title: `${path.name} - Step ${sIdx + 1}`,
                                  details: [
                                    seg.actionDesc,
                                    `Coords: (${Math.round(seg.p2.x / directStepSize)}, ${Math.round(seg.p2.y / directStepSize)})`,
                                  ],
                                });
                              }}
                              onMouseLeave={() => setHoveredInfo(null)}
                            />
                          );
                        })}

                        {/* Head beacon */}
                        {path.head2D && (
                          <g transform={`translate(${path.head2D.x}, ${path.head2D.y})`}>
                            <circle r="5" fill={path.color} filter="url(#glowDirect2D)" />
                            <circle r="12" fill="none" stroke={path.color} strokeWidth="1.5">
                              <animate attributeName="r" values="5;14;5" dur="2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                            </circle>
                            {isOverlayActive && (
                              <text
                                x="9"
                                y="4"
                                fill={path.color}
                                fontSize="10"
                                fontFamily="var(--font-mono)"
                                fontWeight="700"
                              >
                                M{path.id}
                              </text>
                            )}
                          </g>
                        )}
                      </g>
                    ))}
                  </g>
                </svg>
              )}
            </>
          )}

          {/* Overlaid Messages Legend Overlay */}
          {isOverlayActive && (
            <div className={styles.overlayLegendPanel}>
              <span className={styles.overlayLegendTitle}>Overlaid Messages ({visibleTracks.length})</span>
              {visibleTracks.map((t) => (
                <div key={t.messageIndex} className={styles.overlayLegendItem} style={{ color: t.color }}>
                  <span className={styles.msgColorDot} style={{ background: t.color }} />
                  <span>M{t.messageIndex} ({t.name.split('(')[1]?.replace(')', '') || ''})</span>
                </div>
              ))}
            </div>
          )}

          {/* Interactive Hover Tooltip */}
          {hoveredInfo && (
            <div className={styles.tooltipOverlay}>
              <div className={styles.tooltipTitle}>{hoveredInfo.title}</div>
              <div className={styles.tooltipDetails}>
                {hoveredInfo.details.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Viewport Stats Footer */}
        <footer className={styles.statsFooterBar}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Active Elements:</span>
            <span className={styles.statValue}>{effectivePlaybackStep}</span>
          </div>

          {activeMode === 'turtle' && (
            <>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Strokes Drawn:</span>
                <span className={styles.statValue}>{turtlePlaybackStats.penDown}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Pen-Up Advances:</span>
                <span className={styles.statValue}>{turtlePlaybackStats.penUp}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Bounding Envelope:</span>
                <span className={styles.statValue}>
                  {Math.round(fullTurtleWalk.bounds.width)} x {Math.round(fullTurtleWalk.bounds.height)} px
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Distance:</span>
                <span className={styles.statValue}>{Math.round(turtlePlaybackStats.dist)} px</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Trail Span:</span>
                <span className={styles.statValue}>
                  X [{Math.round(fullTurtleWalk.bounds.minX)}..{Math.round(fullTurtleWalk.bounds.maxX)}], Y [{Math.round(fullTurtleWalk.bounds.minY)}..{Math.round(fullTurtleWalk.bounds.maxY)}]
                </span>
              </div>
            </>
          )}

          {activeMode === 'turn_walk_3d' && (
            <>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>3D Steps Walked:</span>
                <span className={styles.statValue}>{turnWalk3DPlaybackStats.stepCount}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Turns Taken:</span>
                <span className={styles.statValue}>{turnWalk3DPlaybackStats.turnCount}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>3D Bounds:</span>
                <span className={styles.statValue}>
                  X [{Math.round(fullTurnWalk3D.bounds.minX)}..{Math.round(fullTurnWalk3D.bounds.maxX)}], Y [{Math.round(fullTurnWalk3D.bounds.minY)}..{Math.round(fullTurnWalk3D.bounds.maxY)}], Z [{Math.round(fullTurnWalk3D.bounds.minZ)}..{Math.round(fullTurnWalk3D.bounds.maxZ)}]
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Distance:</span>
                <span className={styles.statValue}>{Math.round(turnWalk3DPlaybackStats.totalDistance)} px</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Camera:</span>
                <span className={styles.statValue}>
                  Yaw: {azimuth3D} deg | Pitch: {elevation3D} deg | Zoom: {Math.round(activeZoom3D * 10) / 10}
                </span>
              </div>
            </>
          )}

          {activeMode === 'direct_walk' && (
            <>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Paths:</span>
                <span className={styles.statValue}>
                  {visibleDirectPaths.length} of {fullDirectWalk.paths.length}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Steps:</span>
                <span className={styles.statValue}>{directPlaybackStats.stepCount}</span>
              </div>
              {directCenterMode === '2d_grid_snap' && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Grid Snaps:</span>
                  <span className={styles.statValue}>{directPlaybackStats.snapCount}</span>
                </div>
              )}
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Bounds:</span>
                <span className={styles.statValue}>
                  X [{Math.round(fullDirectWalk.overallBounds.minX)}..{Math.round(fullDirectWalk.overallBounds.maxX)}], Y [{Math.round(fullDirectWalk.overallBounds.minY)}..{Math.round(fullDirectWalk.overallBounds.maxY)}]{directCenterMode === '3d_z_step' ? `, Z [${Math.round(fullDirectWalk.overallBounds.minZ)}..${Math.round(fullDirectWalk.overallBounds.maxZ)}]` : ''}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Distance:</span>
                <span className={styles.statValue}>{Math.round(directPlaybackStats.totalDistance)} px</span>
              </div>
            </>
          )}
        </footer>
      </section>
    </div>
  );
};
