// Visual Plotter & Coordinate Grapher Utilities
// Mathematical generators for Turtle Vector Walks, 3D Lattice Cube,
// 2D Pairwise Maps, Phase Space / Recurrence Plots, and Constellation Disks.

import type { EyeGlyph, EyeInversionSettings } from '../types/eye';
import { ALL_EYES } from '../data/allEyes';
import {
  extractMessageEyesWithPattern,
  type SixEyePattern,
} from './orientationExtractor';
import { extractDecimalsForDecoder } from './decoderUtils';

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export const MESSAGE_COLORS: Record<number, string> = {
  1: '#00f0ff', // Cyan (East 1)
  2: '#3b82f6', // Blue (West 1)
  3: '#10b981', // Emerald (East 2)
  4: '#a3e635', // Lime (West 2)
  5: '#eab308', // Amber / Yellow (East 3)
  6: '#f97316', // Orange (West 3)
  7: '#ef4444', // Red (East 4)
  8: '#d946ef', // Fuchsia (West 4)
  9: '#8b5cf6', // Purple (East 5)
};

export const MESSAGE_NAMES: Record<number, string> = {
  1: 'Message 1 (East 1)',
  2: 'Message 2 (West 1)',
  3: 'Message 3 (East 2)',
  4: 'Message 4 (West 2)',
  5: 'Message 5 (East 3)',
  6: 'Message 6 (West 3)',
  7: 'Message 7 (East 4)',
  8: 'Message 8 (West 4)',
  9: 'Message 9 (East 5)',
};

export interface MessageTrack {
  messageIndex: number;
  name: string;
  color: string;
  stream: number[];
  trigrams: Array<{
    rawValues: [number, number, number];
    trigramDecimal: number;
    quinaryCode: string;
    messageIndex: number;
  }>;
  length: number;
}

export interface TurtleSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stepIndex: number;
  isPenUp: boolean;
  value: number;
  label?: string;
  messageIndex?: number;
  color?: string;
}

export interface TurtleHeadBeacon {
  messageIndex: number;
  name: string;
  color: string;
  point: Point2D;
}

export interface TurtleTrackData {
  messageIndex: number;
  name: string;
  color: string;
  segments: TurtleSegment[];
  points: Point2D[];
}

export interface TurtleWalkResult {
  segments: TurtleSegment[];
  points: Point2D[];
  tracks: TurtleTrackData[];
  headBeacons: TurtleHeadBeacon[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  totalDistance: number;
  penDownSegments: number;
  penUpJumps: number;
}

export type TurtleDirectionMode = 'cardinal_4' | 'radial_5' | 'relative_turn' | 'trigram_3stroke';

export interface TurtleOptions {
  directionMode: TurtleDirectionMode;
  stepLength: number;
  penUpOnZero: boolean;
  advanceWidth: number;
  wrapWidth: number;
  resetYOnAdvance: boolean;
  turnAngleDeg: number;
  overlayAtOrigin?: boolean;
  tracks?: MessageTrack[];
}

// 1. Turtle Vector Walk Generator
export function generateTurtleWalk(
  stream: number[],
  options: TurtleOptions
): TurtleWalkResult {
  const {
    directionMode,
    stepLength,
    penUpOnZero,
    advanceWidth,
    wrapWidth,
    resetYOnAdvance,
    turnAngleDeg,
    overlayAtOrigin = false,
    tracks,
  } = options;

  const segments: TurtleSegment[] = [];
  const points: Point2D[] = [];
  const headBeacons: TurtleHeadBeacon[] = [];
  const tracksData: TurtleTrackData[] = [];

  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let totalDist = 0;
  let penDownCount = 0;
  let penUpCount = 0;

  const updateBounds = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  const effectiveTracks: MessageTrack[] =
    tracks && tracks.length > 0
      ? tracks
      : [
          {
            messageIndex: 1,
            name: 'Stream',
            color: '#00f0ff',
            stream,
            trigrams: [],
            length: stream.length,
          },
        ];

  if (overlayAtOrigin) {
    // Overlay Mode: Every track starts from origin (0,0)
    for (const track of effectiveTracks) {
      let curX = 0;
      let curY = 0;
      let curHeading = -90; // Facing upward initially (-Y)
      let originX = 0;
      let originY = 0;

      const trackPts: Point2D[] = [{ x: curX, y: curY }];
      const trackSegs: TurtleSegment[] = [];

      points.push({ x: curX, y: curY });
      updateBounds(curX, curY);

      for (let i = 0; i < track.stream.length; i++) {
        const val = track.stream[i];
        let nextX = curX;
        let nextY = curY;
        let isPenUp = false;

        if (penUpOnZero && val === 0) {
          isPenUp = true;
          penUpCount++;
          originX += advanceWidth;

          if (wrapWidth > 0 && originX > wrapWidth) {
            originX = 0;
            originY += advanceWidth * 1.5;
          }

          nextX = originX;
          nextY = resetYOnAdvance ? originY : curY;
          curHeading = -90;
        } else {
          let dx = 0;
          let dy = 0;

          if (directionMode === 'cardinal_4') {
            switch (val % 5) {
              case 1: dy = -stepLength; break;
              case 2: dx = stepLength; break;
              case 3: dy = stepLength; break;
              case 4: dx = -stepLength; break;
              case 0: default: dx = 0; dy = 0; break;
            }
          } else if (directionMode === 'radial_5') {
            const angleRad = ((val % 5) * 72 - 90) * (Math.PI / 180);
            dx = Math.cos(angleRad) * stepLength;
            dy = Math.sin(angleRad) * stepLength;
          } else if (directionMode === 'relative_turn') {
            const turnSteps = [0, 1, 2, -2, -1][val % 5];
            curHeading += turnSteps * turnAngleDeg;
            const angleRad = curHeading * (Math.PI / 180);
            dx = Math.cos(angleRad) * stepLength;
            dy = Math.sin(angleRad) * stepLength;
          } else if (directionMode === 'trigram_3stroke') {
            const d1 = Math.floor(val / 25) % 5;
            const d2 = Math.floor(val / 5) % 5;
            const d3 = val % 5;
            const angleRad = (d1 * 72 - 90) * (Math.PI / 180);
            const strokeDist = stepLength * (1 + (d2 % 3));
            dx = Math.cos(angleRad) * strokeDist;
            dy = Math.sin(angleRad) * strokeDist;
            if (d3 === 0) isPenUp = true;
          }

          nextX = curX + dx;
          nextY = curY + dy;

          if (!isPenUp && (dx !== 0 || dy !== 0)) {
            penDownCount++;
            totalDist += Math.hypot(dx, dy);
          }
        }

        const seg: TurtleSegment = {
          x1: curX,
          y1: curY,
          x2: nextX,
          y2: nextY,
          stepIndex: i,
          isPenUp,
          value: val,
          messageIndex: track.messageIndex,
          color: track.color,
        };

        segments.push(seg);
        trackSegs.push(seg);

        curX = nextX;
        curY = nextY;
        points.push({ x: curX, y: curY });
        trackPts.push({ x: curX, y: curY });
        updateBounds(curX, curY);
      }

      tracksData.push({
        messageIndex: track.messageIndex,
        name: track.name,
        color: track.color,
        segments: trackSegs,
        points: trackPts,
      });

      headBeacons.push({
        messageIndex: track.messageIndex,
        name: track.name,
        color: track.color,
        point: { x: curX, y: curY },
      });
    }
  } else {
    // Continuous Chain Mode: Tracks trace end-to-end
    let curX = 0;
    let curY = 0;
    let curHeading = -90;
    let originX = 0;
    let originY = 0;
    let globalStepIndex = 0;

    points.push({ x: curX, y: curY });
    updateBounds(curX, curY);

    for (const track of effectiveTracks) {
      const trackPts: Point2D[] = [{ x: curX, y: curY }];
      const trackSegs: TurtleSegment[] = [];

      for (let i = 0; i < track.stream.length; i++) {
        const val = track.stream[i];
        let nextX = curX;
        let nextY = curY;
        let isPenUp = false;

        if (penUpOnZero && val === 0) {
          isPenUp = true;
          penUpCount++;
          originX += advanceWidth;

          if (wrapWidth > 0 && originX > wrapWidth) {
            originX = 0;
            originY += advanceWidth * 1.5;
          }

          nextX = originX;
          nextY = resetYOnAdvance ? originY : curY;
          curHeading = -90;
        } else {
          let dx = 0;
          let dy = 0;

          if (directionMode === 'cardinal_4') {
            switch (val % 5) {
              case 1: dy = -stepLength; break;
              case 2: dx = stepLength; break;
              case 3: dy = stepLength; break;
              case 4: dx = -stepLength; break;
              case 0: default: dx = 0; dy = 0; break;
            }
          } else if (directionMode === 'radial_5') {
            const angleRad = ((val % 5) * 72 - 90) * (Math.PI / 180);
            dx = Math.cos(angleRad) * stepLength;
            dy = Math.sin(angleRad) * stepLength;
          } else if (directionMode === 'relative_turn') {
            const turnSteps = [0, 1, 2, -2, -1][val % 5];
            curHeading += turnSteps * turnAngleDeg;
            const angleRad = curHeading * (Math.PI / 180);
            dx = Math.cos(angleRad) * stepLength;
            dy = Math.sin(angleRad) * stepLength;
          } else if (directionMode === 'trigram_3stroke') {
            const d1 = Math.floor(val / 25) % 5;
            const d2 = Math.floor(val / 5) % 5;
            const d3 = val % 5;
            const angleRad = (d1 * 72 - 90) * (Math.PI / 180);
            const strokeDist = stepLength * (1 + (d2 % 3));
            dx = Math.cos(angleRad) * strokeDist;
            dy = Math.sin(angleRad) * strokeDist;
            if (d3 === 0) isPenUp = true;
          }

          nextX = curX + dx;
          nextY = curY + dy;

          if (!isPenUp && (dx !== 0 || dy !== 0)) {
            penDownCount++;
            totalDist += Math.hypot(dx, dy);
          }
        }

        const seg: TurtleSegment = {
          x1: curX,
          y1: curY,
          x2: nextX,
          y2: nextY,
          stepIndex: globalStepIndex,
          isPenUp,
          value: val,
          messageIndex: track.messageIndex,
          color: track.color,
        };

        segments.push(seg);
        trackSegs.push(seg);

        globalStepIndex++;
        curX = nextX;
        curY = nextY;
        points.push({ x: curX, y: curY });
        trackPts.push({ x: curX, y: curY });
        updateBounds(curX, curY);
      }

      tracksData.push({
        messageIndex: track.messageIndex,
        name: track.name,
        color: track.color,
        segments: trackSegs,
        points: trackPts,
      });
    }

    if (points.length > 0) {
      headBeacons.push({
        messageIndex: effectiveTracks[effectiveTracks.length - 1].messageIndex,
        name: 'Head',
        color: '#f59e0b',
        point: { x: curX, y: curY },
      });
    }
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    segments,
    points,
    tracks: tracksData,
    headBeacons,
    bounds: { minX, maxX, minY, maxY, width, height },
    totalDistance: totalDist,
    penDownSegments: penDownCount,
    penUpJumps: penUpCount,
  };
}

// 2. 3D Lattice Wireframe Generator
export interface Lattice3DVertex {
  x: number; // 0..4
  y: number; // 0..4
  z: number; // 0..4
  stepIndex: number;
  trigramValue: number;
  quinaryCode: string;
}

export interface Lattice3DSegment {
  p1: Point3D;
  p2: Point3D;
  stepIndex: number;
  val1: number;
  val2: number;
}

export interface ProjectedPoint2D extends Point2D {
  zDepth: number;
}

export function generate3DLatticeTrajectory(
  trigrams: Array<{ rawValues: [number, number, number]; trigramDecimal: number; quinaryCode: string }>,
  axisPermutation: 'xyz' | 'xzy' | 'yxz' | 'yzx' | 'zxy' | 'zyx' = 'xyz'
): { vertices: Lattice3DVertex[]; segments: Lattice3DSegment[] } {
  const vertices: Lattice3DVertex[] = [];
  const segments: Lattice3DSegment[] = [];

  for (let i = 0; i < trigrams.length; i++) {
    const item = trigrams[i];
    const [d1, d2, d3] = item.rawValues;

    let x = d1;
    let y = d2;
    let z = d3;

    switch (axisPermutation) {
      case 'xzy':
        x = d1; y = d3; z = d2;
        break;
      case 'yxz':
        x = d2; y = d1; z = d3;
        break;
      case 'yzx':
        x = d2; y = d3; z = d1;
        break;
      case 'zxy':
        x = d3; y = d1; z = d2;
        break;
      case 'zyx':
        x = d3; y = d2; z = d1;
        break;
      case 'xyz':
      default:
        break;
    }

    vertices.push({
      x,
      y,
      z,
      stepIndex: i,
      trigramValue: item.trigramDecimal,
      quinaryCode: item.quinaryCode,
    });

    if (i > 0) {
      const prev = vertices[i - 1];
      segments.push({
        p1: { x: prev.x, y: prev.y, z: prev.z },
        p2: { x, y, z },
        stepIndex: i - 1,
        val1: prev.trigramValue,
        val2: item.trigramDecimal,
      });
    }
  }

  return { vertices, segments };
}

// 3D Projection to 2D Screen
export function project3DTo2D(
  point: Point3D,
  azimuthDeg: number,
  elevationDeg: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
  isPerspective = false,
  center: Point3D = { x: 0, y: 0, z: 0 },
  cameraDistance = 80.0
): ProjectedPoint2D {
  const cx = point.x - center.x;
  const cy = point.y - center.y;
  const cz = point.z - center.z;

  const azRad = (azimuthDeg * Math.PI) / 180;
  const elRad = (elevationDeg * Math.PI) / 180;

  // Yaw rotation around Y axis
  const x1 = cx * Math.cos(azRad) - cz * Math.sin(azRad);
  const y1 = cy;
  const z1 = cx * Math.sin(azRad) + cz * Math.cos(azRad);

  // Pitch rotation around X axis
  const x2 = x1;
  const y2 = y1 * Math.cos(elRad) - z1 * Math.sin(elRad);
  const z2 = y1 * Math.sin(elRad) + z1 * Math.cos(elRad);

  // Projection
  let factor = zoom;
  if (isPerspective) {
    const dist = Math.max(cameraDistance * 0.15, cameraDistance - z2);
    factor = zoom * (cameraDistance / dist);
  }

  const screenX = viewportWidth / 2 + x2 * factor;
  const screenY = viewportHeight / 2 - y2 * factor; // Invert Y for screen coordinates

  return {
    x: screenX,
    y: screenY,
    zDepth: z2,
  };
}

// 2b. 3D Turn and Walk Generator
// Relative 3D Turtle: Eye directions turn 90 degrees (1=Up/Pitch+, 3=Down/Pitch-, 2=Right/Yaw+, 4=Left/Yaw-),
// and blank (0) takes 1 unit step forward.
export type TurnWalk3DStepMode = 'blank_only' | 'every_command';

export interface TurnWalk3DOptions {
  stepMode: TurnWalk3DStepMode;
  stepSize: number;
  turnAngleDeg: number;
  initialHeading?: 'pos_x' | 'pos_y' | 'pos_z';
  overlayAtOrigin?: boolean;
  tracks?: MessageTrack[];
}

export interface TurnWalk3DHeadBeacon {
  messageIndex: number;
  name: string;
  color: string;
  pos: Point3D;
  heading: Point3D;
}

export interface TurnWalk3DSegment {
  p1: Point3D;
  p2: Point3D;
  stepIndex: number;
  rawVal: number;
  isStep: boolean;
  actionDesc: string;
  messageIndex?: number;
  color?: string;
}

export interface TurnWalk3DVertex {
  x: number;
  y: number;
  z: number;
  stepIndex: number;
  rawVal: number;
  heading: Point3D;
  up: Point3D;
  messageIndex?: number;
  color?: string;
}

export interface TurnWalk3DBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  width: number;
  height: number;
  depth: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
}

export interface TurnWalk3DTrackData {
  messageIndex: number;
  name: string;
  color: string;
  segments: TurnWalk3DSegment[];
  vertices: TurnWalk3DVertex[];
}

export interface TurnWalk3DResult {
  segments: TurnWalk3DSegment[];
  vertices: TurnWalk3DVertex[];
  tracks: TurnWalk3DTrackData[];
  headBeacons: TurnWalk3DHeadBeacon[];
  bounds: TurnWalk3DBounds;
  totalDistance: number;
  stepCount: number;
  turnCount: number;
}

export function generate3DTurnWalk(
  stream: number[],
  options: TurnWalk3DOptions
): TurnWalk3DResult {
  const {
    stepMode = 'blank_only',
    stepSize = 10,
    turnAngleDeg = 90,
    initialHeading = 'pos_x',
    overlayAtOrigin = false,
    tracks,
  } = options;

  const rad = (turnAngleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const getInitialFrame = (): { F: Point3D; U: Point3D; R: Point3D } => {
    let F: Point3D = { x: 1, y: 0, z: 0 };
    let U: Point3D = { x: 0, y: 1, z: 0 };
    let R: Point3D = { x: 0, y: 0, z: 1 };
    if (initialHeading === 'pos_y') {
      F = { x: 0, y: 1, z: 0 };
      U = { x: 0, y: 0, z: 1 };
      R = { x: 1, y: 0, z: 0 };
    } else if (initialHeading === 'pos_z') {
      F = { x: 0, y: 0, z: 1 };
      U = { x: 0, y: 1, z: 0 };
      R = { x: -1, y: 0, z: 0 };
    }
    return { F, U, R };
  };

  const segments: TurnWalk3DSegment[] = [];
  const vertices: TurnWalk3DVertex[] = [];
  const headBeacons: TurnWalk3DHeadBeacon[] = [];
  const tracksData: TurnWalk3DTrackData[] = [];

  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let minZ = 0;
  let maxZ = 0;
  let totalDist = 0;
  let stepCount = 0;
  let turnCount = 0;

  const updateBounds = (p: Point3D) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  };

  const effectiveTracks: MessageTrack[] =
    tracks && tracks.length > 0
      ? tracks
      : [
          {
            messageIndex: 1,
            name: 'Stream',
            color: '#00f0ff',
            stream,
            trigrams: [],
            length: stream.length,
          },
        ];

  if (overlayAtOrigin) {
    // Overlay Mode: Each track traces starting independently from (0, 0, 0)
    for (const track of effectiveTracks) {
      let curPos: Point3D = { x: 0, y: 0, z: 0 };
      let { F, U, R } = getInitialFrame();

      const trackVerts: TurnWalk3DVertex[] = [];
      const trackSegs: TurnWalk3DSegment[] = [];

      updateBounds(curPos);
      const v0: TurnWalk3DVertex = {
        x: curPos.x,
        y: curPos.y,
        z: curPos.z,
        stepIndex: 0,
        rawVal: -1,
        heading: { ...F },
        up: { ...U },
        messageIndex: track.messageIndex,
        color: track.color,
      };
      vertices.push(v0);
      trackVerts.push(v0);

      for (let i = 0; i < track.stream.length; i++) {
        const val = track.stream[i] % 5;
        let action = '';

        switch (val) {
          case 1: {
            const newF: Point3D = {
              x: F.x * cosA + U.x * sinA,
              y: F.y * cosA + U.y * sinA,
              z: F.z * cosA + U.z * sinA,
            };
            const newU: Point3D = {
              x: -F.x * sinA + U.x * cosA,
              y: -F.y * sinA + U.y * cosA,
              z: -F.z * sinA + U.z * cosA,
            };
            F = newF;
            U = newU;
            turnCount++;
            action = `Pitch Up ${turnAngleDeg} deg`;
            break;
          }
          case 3: {
            const newF: Point3D = {
              x: F.x * cosA - U.x * sinA,
              y: F.y * cosA - U.y * sinA,
              z: F.z * cosA - U.z * sinA,
            };
            const newU: Point3D = {
              x: F.x * sinA + U.x * cosA,
              y: F.y * sinA + U.y * cosA,
              z: F.z * sinA + U.z * cosA,
            };
            F = newF;
            U = newU;
            turnCount++;
            action = `Pitch Down ${turnAngleDeg} deg`;
            break;
          }
          case 2: {
            const newF: Point3D = {
              x: F.x * cosA + R.x * sinA,
              y: F.y * cosA + R.y * sinA,
              z: F.z * cosA + R.z * sinA,
            };
            const newR: Point3D = {
              x: -F.x * sinA + R.x * cosA,
              y: -F.y * sinA + R.y * cosA,
              z: -F.z * sinA + R.z * cosA,
            };
            F = newF;
            R = newR;
            turnCount++;
            action = `Yaw Right ${turnAngleDeg} deg`;
            break;
          }
          case 4: {
            const newF: Point3D = {
              x: F.x * cosA - R.x * sinA,
              y: F.y * cosA - R.y * sinA,
              z: F.z * cosA - R.z * sinA,
            };
            const newR: Point3D = {
              x: F.x * sinA + R.x * cosA,
              y: F.y * sinA + R.y * cosA,
              z: F.z * sinA + R.z * cosA,
            };
            F = newF;
            R = newR;
            turnCount++;
            action = `Yaw Left ${turnAngleDeg} deg`;
            break;
          }
          case 0:
          default: {
            action = 'Blank (0): Step Forward';
            break;
          }
        }

        R = {
          x: F.y * U.z - F.z * U.y,
          y: F.z * U.x - F.x * U.z,
          z: F.x * U.y - F.y * U.x,
        };
        const norm = (v: Point3D): Point3D => {
          const len = Math.hypot(v.x, v.y, v.z) || 1;
          return { x: v.x / len, y: v.y / len, z: v.z / len };
        };
        F = norm(F);
        U = norm(U);
        R = norm(R);

        if (val === 0 || stepMode === 'every_command') {
          stepCount++;
          const nextPos: Point3D = {
            x: curPos.x + F.x * stepSize,
            y: curPos.y + F.y * stepSize,
            z: curPos.z + F.z * stepSize,
          };

          const seg: TurnWalk3DSegment = {
            p1: { ...curPos },
            p2: { ...nextPos },
            stepIndex: i,
            rawVal: val,
            isStep: true,
            actionDesc: action,
            messageIndex: track.messageIndex,
            color: track.color,
          };
          segments.push(seg);
          trackSegs.push(seg);

          curPos = nextPos;
          totalDist += stepSize;
          updateBounds(curPos);
        } else {
          const seg: TurnWalk3DSegment = {
            p1: { ...curPos },
            p2: { ...curPos },
            stepIndex: i,
            rawVal: val,
            isStep: false,
            actionDesc: action,
            messageIndex: track.messageIndex,
            color: track.color,
          };
          segments.push(seg);
          trackSegs.push(seg);
        }

        const v: TurnWalk3DVertex = {
          x: curPos.x,
          y: curPos.y,
          z: curPos.z,
          stepIndex: i + 1,
          rawVal: val,
          heading: { ...F },
          up: { ...U },
          messageIndex: track.messageIndex,
          color: track.color,
        };
        vertices.push(v);
        trackVerts.push(v);
      }

      tracksData.push({
        messageIndex: track.messageIndex,
        name: track.name,
        color: track.color,
        segments: trackSegs,
        vertices: trackVerts,
      });

      headBeacons.push({
        messageIndex: track.messageIndex,
        name: track.name,
        color: track.color,
        pos: { ...curPos },
        heading: { ...F },
      });
    }
  } else {
    // Continuous Chain Mode
    let curPos: Point3D = { x: 0, y: 0, z: 0 };
    let { F, U, R } = getInitialFrame();
    let globalStepIndex = 0;

    updateBounds(curPos);
    vertices.push({
      x: curPos.x,
      y: curPos.y,
      z: curPos.z,
      stepIndex: 0,
      rawVal: -1,
      heading: { ...F },
      up: { ...U },
      messageIndex: effectiveTracks[0].messageIndex,
      color: effectiveTracks[0].color,
    });

    for (const track of effectiveTracks) {
      const trackVerts: TurnWalk3DVertex[] = [];
      const trackSegs: TurnWalk3DSegment[] = [];

      for (let i = 0; i < track.stream.length; i++) {
        const val = track.stream[i] % 5;
        let action = '';

        switch (val) {
          case 1: {
            const newF: Point3D = {
              x: F.x * cosA + U.x * sinA,
              y: F.y * cosA + U.y * sinA,
              z: F.z * cosA + U.z * sinA,
            };
            const newU: Point3D = {
              x: -F.x * sinA + U.x * cosA,
              y: -F.y * sinA + U.y * cosA,
              z: -F.z * sinA + U.z * cosA,
            };
            F = newF;
            U = newU;
            turnCount++;
            action = `Pitch Up ${turnAngleDeg} deg`;
            break;
          }
          case 3: {
            const newF: Point3D = {
              x: F.x * cosA - U.x * sinA,
              y: F.y * cosA - U.y * sinA,
              z: F.z * cosA - U.z * sinA,
            };
            const newU: Point3D = {
              x: F.x * sinA + U.x * cosA,
              y: F.y * sinA + U.y * cosA,
              z: F.z * sinA + U.z * cosA,
            };
            F = newF;
            U = newU;
            turnCount++;
            action = `Pitch Down ${turnAngleDeg} deg`;
            break;
          }
          case 2: {
            const newF: Point3D = {
              x: F.x * cosA + R.x * sinA,
              y: F.y * cosA + R.y * sinA,
              z: F.z * cosA + R.z * sinA,
            };
            const newR: Point3D = {
              x: -F.x * sinA + R.x * cosA,
              y: -F.y * sinA + R.y * cosA,
              z: -F.z * sinA + R.z * cosA,
            };
            F = newF;
            R = newR;
            turnCount++;
            action = `Yaw Right ${turnAngleDeg} deg`;
            break;
          }
          case 4: {
            const newF: Point3D = {
              x: F.x * cosA - R.x * sinA,
              y: F.y * cosA - R.y * sinA,
              z: F.z * cosA - R.z * sinA,
            };
            const newR: Point3D = {
              x: F.x * sinA + R.x * cosA,
              y: F.y * sinA + R.y * cosA,
              z: F.z * sinA + R.z * cosA,
            };
            F = newF;
            R = newR;
            turnCount++;
            action = `Yaw Left ${turnAngleDeg} deg`;
            break;
          }
          case 0:
          default: {
            action = 'Blank (0): Step Forward';
            break;
          }
        }

        R = {
          x: F.y * U.z - F.z * U.y,
          y: F.z * U.x - F.x * U.z,
          z: F.x * U.y - F.y * U.x,
        };
        const norm = (v: Point3D): Point3D => {
          const len = Math.hypot(v.x, v.y, v.z) || 1;
          return { x: v.x / len, y: v.y / len, z: v.z / len };
        };
        F = norm(F);
        U = norm(U);
        R = norm(R);

        if (val === 0 || stepMode === 'every_command') {
          stepCount++;
          const nextPos: Point3D = {
            x: curPos.x + F.x * stepSize,
            y: curPos.y + F.y * stepSize,
            z: curPos.z + F.z * stepSize,
          };

          const seg: TurnWalk3DSegment = {
            p1: { ...curPos },
            p2: { ...nextPos },
            stepIndex: globalStepIndex,
            rawVal: val,
            isStep: true,
            actionDesc: action,
            messageIndex: track.messageIndex,
            color: track.color,
          };
          segments.push(seg);
          trackSegs.push(seg);

          curPos = nextPos;
          totalDist += stepSize;
          updateBounds(curPos);
        } else {
          const seg: TurnWalk3DSegment = {
            p1: { ...curPos },
            p2: { ...curPos },
            stepIndex: globalStepIndex,
            rawVal: val,
            isStep: false,
            actionDesc: action,
            messageIndex: track.messageIndex,
            color: track.color,
          };
          segments.push(seg);
          trackSegs.push(seg);
        }

        globalStepIndex++;
        const v: TurnWalk3DVertex = {
          x: curPos.x,
          y: curPos.y,
          z: curPos.z,
          stepIndex: globalStepIndex,
          rawVal: val,
          heading: { ...F },
          up: { ...U },
          messageIndex: track.messageIndex,
          color: track.color,
        };
        vertices.push(v);
        trackVerts.push(v);
      }

      tracksData.push({
        messageIndex: track.messageIndex,
        name: track.name,
        color: track.color,
        segments: trackSegs,
        vertices: trackVerts,
      });
    }

    headBeacons.push({
      messageIndex: effectiveTracks[effectiveTracks.length - 1].messageIndex,
      name: 'Head',
      color: '#f59e0b',
      pos: { ...curPos },
      heading: { ...F },
    });
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const depth = Math.max(1, maxZ - minZ);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  let maxR = 1;
  for (const v of vertices) {
    const d = Math.hypot(v.x - centerX, v.y - centerY, v.z - centerZ);
    if (d > maxR) maxR = d;
  }

  return {
    segments,
    vertices,
    tracks: tracksData,
    headBeacons,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      width,
      height,
      depth,
      centerX,
      centerY,
      centerZ,
      radius: maxR,
    },
    totalDistance: totalDist,
    stepCount,
    turnCount,
  };
}

// 2c. Direct Vector Walk Generator
// Takes eye direction directly and moves in that direction (1=Up, 3=Down, 2=Right, 4=Left).
// Center eye (0) options:
// - 3D mode: steps once in Z direction
// - 2D Grid Snap mode: snaps to next N units to the right
// 3 Segments/Paths toggle: each eye of each trigram increments one of 3 parallel paths.

export type DirectWalkCenterMode = '3d_z_step' | '2d_grid_snap' | '2d_rest';

export interface DirectVectorOptions {
  centerMode: DirectWalkCenterMode;
  splitTrigramPaths: boolean;
  snapUnitN: number;
  stepSize: number;
  resetYOnSnap: boolean;
  pathSpacing: number;
  overlayAtOrigin?: boolean;
  tracks?: MessageTrack[];
}

export interface DirectWalkSegment {
  p1: Point3D;
  p2: Point3D;
  stepIndex: number;
  rawVal: number;
  isSnap: boolean;
  actionDesc: string;
}

export interface DirectWalkPath {
  id: number;
  name: string;
  color: string;
  segments: DirectWalkSegment[];
  points: Point3D[];
  bounds: TurnWalk3DBounds;
  totalDistance: number;
  stepCount: number;
  snapCount: number;
}

export interface DirectWalkResult {
  paths: DirectWalkPath[];
  overallBounds: TurnWalk3DBounds;
  totalDistance: number;
  stepCount: number;
  snapCount: number;
}

function traceSingleDirectPath(
  vals: number[],
  startPos: Point3D,
  pathId: number,
  pathName: string,
  pathColor: string,
  options: DirectVectorOptions
): DirectWalkPath {
  const { centerMode, snapUnitN, stepSize, resetYOnSnap } = options;

  let curX = startPos.x;
  let curY = startPos.y;
  let curZ = startPos.z;

  const points: Point3D[] = [{ x: curX, y: curY, z: curZ }];
  const segments: DirectWalkSegment[] = [];

  let minX = curX;
  let maxX = curX;
  let minY = curY;
  let maxY = curY;
  let minZ = curZ;
  let maxZ = curZ;
  let totalDist = 0;
  let stepCount = 0;
  let snapCount = 0;

  const updateBounds = (x: number, y: number, z: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  };

  for (let i = 0; i < vals.length; i++) {
    const val = vals[i] % 5;
    let nextX = curX;
    let nextY = curY;
    let nextZ = curZ;
    let isSnap = false;
    let actionDesc = '';

    if (val === 0) {
      if (centerMode === '3d_z_step') {
        nextZ = curZ + stepSize;
        actionDesc = 'Center (0): Step +Z';
        stepCount++;
      } else if (centerMode === '2d_grid_snap') {
        isSnap = true;
        snapCount++;
        const unitPixels = Math.max(1, snapUnitN * stepSize);
        const nextSlot = Math.floor(curX / unitPixels) + 1;
        nextX = nextSlot * unitPixels;
        if (resetYOnSnap) {
          nextY = startPos.y;
        }
        actionDesc = `Center (0): Snap to X=${nextX}`;
      } else {
        actionDesc = 'Center (0): Rest';
      }
    } else {
      stepCount++;
      switch (val) {
        case 1: // Up
          nextY = centerMode === '3d_z_step' ? curY + stepSize : curY - stepSize;
          actionDesc = 'Eye 1: Up';
          break;
        case 2: // Right
          nextX = curX + stepSize;
          actionDesc = 'Eye 2: Right';
          break;
        case 3: // Down
          nextY = centerMode === '3d_z_step' ? curY - stepSize : curY + stepSize;
          actionDesc = 'Eye 3: Down';
          break;
        case 4: // Left
          nextX = curX - stepSize;
          actionDesc = 'Eye 4: Left';
          break;
      }
    }

    const dist = Math.hypot(nextX - curX, nextY - curY, nextZ - curZ);
    totalDist += dist;

    segments.push({
      p1: { x: curX, y: curY, z: curZ },
      p2: { x: nextX, y: nextY, z: nextZ },
      stepIndex: i,
      rawVal: val,
      isSnap,
      actionDesc,
    });

    curX = nextX;
    curY = nextY;
    curZ = nextZ;
    points.push({ x: curX, y: curY, z: curZ });
    updateBounds(curX, curY, curZ);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const depth = Math.max(1, maxZ - minZ);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  let radius = 1;
  for (const p of points) {
    const d = Math.hypot(p.x - centerX, p.y - centerY, p.z - centerZ);
    if (d > radius) radius = d;
  }

  return {
    id: pathId,
    name: pathName,
    color: pathColor,
    segments,
    points,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      width,
      height,
      depth,
      centerX,
      centerY,
      centerZ,
      radius,
    },
    totalDistance: totalDist,
    stepCount,
    snapCount,
  };
}

export function generateDirectVectorWalk(
  stream: number[],
  options: DirectVectorOptions
): DirectWalkResult {
  const { splitTrigramPaths, pathSpacing = 0, overlayAtOrigin = false, tracks } = options;
  const paths: DirectWalkPath[] = [];

  const effectiveTracks: MessageTrack[] =
    tracks && tracks.length > 0
      ? tracks
      : [
          {
            messageIndex: 1,
            name: 'Stream',
            color: '#00f0ff',
            stream,
            trigrams: [],
            length: stream.length,
          },
        ];

  if (overlayAtOrigin) {
    if (!splitTrigramPaths) {
      // Each message track starts from (0, 0, 0)
      for (const track of effectiveTracks) {
        paths.push(
          traceSingleDirectPath(
            track.stream,
            { x: 0, y: 0, z: 0 },
            track.messageIndex,
            track.name,
            track.color,
            options
          )
        );
      }
    } else {
      for (const track of effectiveTracks) {
        const s1: number[] = [];
        const s2: number[] = [];
        const s3: number[] = [];
        for (let i = 0; i < track.stream.length; i++) {
          const mod = i % 3;
          if (mod === 0) s1.push(track.stream[i]);
          else if (mod === 1) s2.push(track.stream[i]);
          else s3.push(track.stream[i]);
        }
        paths.push(
          traceSingleDirectPath(
            s1,
            { x: 0, y: -pathSpacing, z: 0 },
            track.messageIndex * 10 + 1,
            `M${track.messageIndex} Eye 1`,
            track.color,
            options
          ),
          traceSingleDirectPath(
            s2,
            { x: 0, y: 0, z: 0 },
            track.messageIndex * 10 + 2,
            `M${track.messageIndex} Eye 2`,
            '#f59e0b',
            options
          ),
          traceSingleDirectPath(
            s3,
            { x: 0, y: pathSpacing, z: 0 },
            track.messageIndex * 10 + 3,
            `M${track.messageIndex} Eye 3`,
            '#d946ef',
            options
          )
        );
      }
    }
  } else {
    if (!splitTrigramPaths) {
      paths.push(
        traceSingleDirectPath(
          stream,
          { x: 0, y: 0, z: 0 },
          0,
          'Continuous Path',
          '#00f0ff',
          options
        )
      );
    } else {
      const s1: number[] = [];
      const s2: number[] = [];
      const s3: number[] = [];

      for (let i = 0; i < stream.length; i++) {
        const mod = i % 3;
        if (mod === 0) s1.push(stream[i]);
        else if (mod === 1) s2.push(stream[i]);
        else s3.push(stream[i]);
      }

      const p1 = traceSingleDirectPath(
        s1,
        { x: 0, y: -pathSpacing, z: 0 },
        1,
        'Path 1 (Eye 1)',
        '#00f0ff',
        options
      );
      const p2 = traceSingleDirectPath(
        s2,
        { x: 0, y: 0, z: 0 },
        2,
        'Path 2 (Eye 2)',
        '#f59e0b',
        options
      );
      const p3 = traceSingleDirectPath(
        s3,
        { x: 0, y: pathSpacing, z: 0 },
        3,
        'Path 3 (Eye 3)',
        '#d946ef',
        options
      );
      paths.push(p1, p2, p3);
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let totalDistance = 0;
  let stepCount = 0;
  let snapCount = 0;

  for (const p of paths) {
    totalDistance += p.totalDistance;
    stepCount += p.stepCount;
    snapCount += p.snapCount;
    if (p.bounds.minX < minX) minX = p.bounds.minX;
    if (p.bounds.maxX > maxX) maxX = p.bounds.maxX;
    if (p.bounds.minY < minY) minY = p.bounds.minY;
    if (p.bounds.maxY > maxY) maxY = p.bounds.maxY;
    if (p.bounds.minZ < minZ) minZ = p.bounds.minZ;
    if (p.bounds.maxZ > maxZ) maxZ = p.bounds.maxZ;
  }

  if (paths.length === 0 || minX === Infinity) {
    minX = 0; maxX = 10; minY = 0; maxY = 10; minZ = 0; maxZ = 10;
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const depth = Math.max(1, maxZ - minZ);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  let radius = 1;
  for (const p of paths) {
    for (const pt of p.points) {
      const d = Math.hypot(pt.x - centerX, pt.y - centerY, pt.z - centerZ);
      if (d > radius) radius = d;
    }
  }

  return {
    paths,
    overallBounds: {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      width,
      height,
      depth,
      centerX,
      centerY,
      centerZ,
      radius,
    },
    totalDistance,
    stepCount,
    snapCount,
  };
}

// Generate wireframe box lines for 5x5x5 lattice
export function getLatticeWireframeEdges(): Array<[Point3D, Point3D]> {
  const edges: Array<[Point3D, Point3D]> = [];
  const corners = [0, 4];

  // 12 edges of the bounding 5x5x5 cube
  for (const x of corners) {
    for (const y of corners) {
      edges.push([{ x, y, z: 0 }, { x, y, z: 4 }]);
    }
  }
  for (const x of corners) {
    for (const z of corners) {
      edges.push([{ x, y: 0, z }, { x, y: 4, z }]);
    }
  }
  for (const y of corners) {
    for (const z of corners) {
      edges.push([{ x: 0, y, z }, { x: 4, y, z }]);
    }
  }

  return edges;
}

// 3. 2D Pairwise Coordinate Map Generator
export type PairwiseMappingMode = 'consecutive_trigrams' | 'raw_pairs' | 'trigram_split' | 'modulo_grid';

export interface PairwisePoint {
  x: number;
  y: number;
  index: number;
  valA: number;
  valB: number;
  count: number;
}

export interface PairwiseSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stepIndex: number;
}

export function generatePairwiseMap(
  stream: number[],
  mode: PairwiseMappingMode,
  gridWidth = 10,
  trigrams?: Array<{ rawValues: [number, number, number]; trigramDecimal: number }>
): {
  points: PairwisePoint[];
  segments: PairwiseSegment[];
  rangeX: [number, number];
  rangeY: [number, number];
  densityMap: Record<string, number>;
} {
  const rawPairs: Array<{ x: number; y: number; valA: number; valB: number; index: number }> = [];

  if (mode === 'consecutive_trigrams') {
    // Pair (T[2k], T[2k+1])
    for (let i = 0; i + 1 < stream.length; i += 2) {
      rawPairs.push({
        x: stream[i],
        y: stream[i + 1],
        valA: stream[i],
        valB: stream[i + 1],
        index: Math.floor(i / 2),
      });
    }
  } else if (mode === 'raw_pairs') {
    // Pair (d[2k], d[2k+1]) in [0..4] x [0..4]
    for (let i = 0; i + 1 < stream.length; i += 2) {
      rawPairs.push({
        x: stream[i],
        y: stream[i + 1],
        valA: stream[i],
        valB: stream[i + 1],
        index: Math.floor(i / 2),
      });
    }
  } else if (mode === 'trigram_split' && trigrams) {
    // X = d1*5 + d2 in [0..24], Y = d3 in [0..4]
    for (let i = 0; i < trigrams.length; i++) {
      const [d1, d2, d3] = trigrams[i].rawValues;
      const x = d1 * 5 + d2;
      const y = d3;
      rawPairs.push({
        x,
        y,
        valA: trigrams[i].trigramDecimal,
        valB: d3,
        index: i,
      });
    }
  } else if (mode === 'modulo_grid') {
    // X = V mod W, Y = floor(V / W)
    const W = Math.max(2, gridWidth);
    for (let i = 0; i < stream.length; i++) {
      const v = stream[i];
      rawPairs.push({
        x: v % W,
        y: Math.floor(v / W),
        valA: v,
        valB: Math.floor(v / W),
        index: i,
      });
    }
  }

  // Calculate density and segments
  const densityMap: Record<string, number> = {};
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of rawPairs) {
    const key = `${p.x},${p.y}`;
    densityMap[key] = (densityMap[key] || 0) + 1;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  if (rawPairs.length === 0) {
    minX = 0; maxX = 10; minY = 0; maxY = 10;
  }

  const points: PairwisePoint[] = rawPairs.map((p) => ({
    x: p.x,
    y: p.y,
    index: p.index,
    valA: p.valA,
    valB: p.valB,
    count: densityMap[`${p.x},${p.y}`] || 1,
  }));

  const segments: PairwiseSegment[] = [];
  for (let i = 0; i + 1 < rawPairs.length; i++) {
    segments.push({
      x1: rawPairs[i].x,
      y1: rawPairs[i].y,
      x2: rawPairs[i + 1].x,
      y2: rawPairs[i + 1].y,
      stepIndex: i,
    });
  }

  return {
    points,
    segments,
    rangeX: [minX, maxX],
    rangeY: [minY, maxY],
    densityMap,
  };
}

// 4. Phase Space Attractor & Recurrence Plot Generator
export interface PhaseSpacePoint {
  x: number; // x(t)
  y: number; // x(t + tau)
  t: number;
}

export interface RecurrencePlotResult {
  matrix: Uint8Array; // N x N binary array (1 for recurrence, 0 for none)
  size: number;
  recurrenceRate: number; // percentage of recurring pairs
  determinism: number; // percentage of points forming diagonal lines >= 2
  maxDiagonalLength: number;
}

export function generatePhaseSpace(
  stream: number[],
  lag: number
): { points: PhaseSpacePoint[]; segments: Array<{ x1: number; y1: number; x2: number; y2: number; stepIndex: number }> } {
  const points: PhaseSpacePoint[] = [];
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number; stepIndex: number }> = [];

  for (let t = 0; t + lag < stream.length; t++) {
    points.push({
      x: stream[t],
      y: stream[t + lag],
      t,
    });
  }

  for (let i = 0; i + 1 < points.length; i++) {
    segments.push({
      x1: points[i].x,
      y1: points[i].y,
      x2: points[i + 1].x,
      y2: points[i + 1].y,
      stepIndex: i,
    });
  }

  return { points, segments };
}

export function computeRecurrencePlot(
  stream: number[],
  tolerance = 0,
  maxPoints = 120
): RecurrencePlotResult {
  const n = Math.min(stream.length, maxPoints);
  const matrix = new Uint8Array(n * n);
  let totalRecurrent = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const diff = Math.abs(stream[i] - stream[j]);
      if (diff <= tolerance) {
        matrix[i * n + j] = 1;
        totalRecurrent++;
      }
    }
  }

  // Calculate determinism: count points in diagonal lines parallel to main diagonal of length >= 2
  let diagonalPoints = 0;
  let maxDiag = 0;

  for (let k = 1 - n; k < n; k++) {
    if (k === 0) continue; // Skip main diagonal (always matches itself)
    let currentStreak = 0;
    for (let i = 0; i < n; i++) {
      const j = i + k;
      if (j >= 0 && j < n) {
        if (matrix[i * n + j] === 1) {
          currentStreak++;
        } else {
          if (currentStreak >= 2) {
            diagonalPoints += currentStreak;
            if (currentStreak > maxDiag) maxDiag = currentStreak;
          }
          currentStreak = 0;
        }
      }
    }
    if (currentStreak >= 2) {
      diagonalPoints += currentStreak;
      if (currentStreak > maxDiag) maxDiag = currentStreak;
    }
  }

  const recurrenceRate = n > 0 ? (totalRecurrent / (n * n)) * 100 : 0;
  const offDiagRecurrent = Math.max(1, totalRecurrent - n);
  const determinism = Math.min(100, (diagonalPoints / offDiagRecurrent) * 100);

  return {
    matrix,
    size: n,
    recurrenceRate,
    determinism,
    maxDiagonalLength: maxDiag,
  };
}

// 5. Constellation / Harmonic Disk Tracer Generator
export interface DiskNode {
  id: number;
  angleRad: number;
  x: number;
  y: number;
  count: number;
}

export interface DiskChord {
  fromId: number;
  toId: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  stepIndex: number;
  count: number;
}

export function generateConstellationDisk(
  stream: number[],
  numSymbols: number,
  radius = 200,
  centerX = 250,
  centerY = 250
): {
  nodes: DiskNode[];
  chords: DiskChord[];
  transitionMatrix: Record<string, number>;
  activeNodeCount: number;
  uniqueTransitionCount: number;
} {
  const M = Math.max(2, numSymbols);
  const nodeCounts: Record<number, number> = {};
  const transitionMatrix: Record<string, number> = {};

  for (let i = 0; i < stream.length; i++) {
    const val = stream[i] % M;
    nodeCounts[val] = (nodeCounts[val] || 0) + 1;
    if (i + 1 < stream.length) {
      const nextVal = stream[i + 1] % M;
      const key = `${val}->${nextVal}`;
      transitionMatrix[key] = (transitionMatrix[key] || 0) + 1;
    }
  }

  // Generate nodes around perimeter
  const nodes: DiskNode[] = [];
  for (let k = 0; k < M; k++) {
    const angleRad = (k * 2 * Math.PI) / M - Math.PI / 2;
    const x = centerX + radius * Math.cos(angleRad);
    const y = centerY + radius * Math.sin(angleRad);
    nodes.push({
      id: k,
      angleRad,
      x,
      y,
      count: nodeCounts[k] || 0,
    });
  }

  // Generate sequential chords
  const chords: DiskChord[] = [];
  for (let i = 0; i + 1 < stream.length; i++) {
    const fromId = stream[i] % M;
    const toId = stream[i + 1] % M;
    const fromNode = nodes[fromId];
    const toNode = nodes[toId];
    const key = `${fromId}->${toId}`;

    chords.push({
      fromId,
      toId,
      fromX: fromNode.x,
      fromY: fromNode.y,
      toX: toNode.x,
      toY: toNode.y,
      stepIndex: i,
      count: transitionMatrix[key] || 1,
    });
  }

  const activeNodeCount = Object.keys(nodeCounts).length;
  const uniqueTransitionCount = Object.keys(transitionMatrix).length;

  return {
    nodes,
    chords,
    transitionMatrix,
    activeNodeCount,
    uniqueTransitionCount,
  };
}

// 6. Dataset Stream & Metadata Extractor
export interface PlotterDataSource {
  selectedMessage: number | 'all';
  streamType: 'raw_digits' | 'trigram_decimals';
  trigramDomain: 'inverted_return_83' | 'base5_125';
  pattern: SixEyePattern;
  inversion: EyeInversionSettings;
  stepMode: 'non_overlapping' | 'overlapping';
}

export interface ExtractedPlotterData {
  stream: number[];
  trigrams: Array<{
    rawValues: [number, number, number];
    trigramDecimal: number;
    quinaryCode: string;
    messageIndex: number;
  }>;
  totalLength: number;
  messageBreakIndices: number[];
  messageTracks: MessageTrack[];
  maxTrackLength: number;
}

export function extractPlotterData(
  options: PlotterDataSource,
  eyes: EyeGlyph[] = ALL_EYES
): ExtractedPlotterData {
  const {
    selectedMessage,
    streamType,
    pattern,
    inversion,
    stepMode,
  } = options;

  const msgsToExtract: number[] =
    selectedMessage === 'all'
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
      : [selectedMessage];

  const stream: number[] = [];
  const trigrams: Array<{
    rawValues: [number, number, number];
    trigramDecimal: number;
    quinaryCode: string;
    messageIndex: number;
  }> = [];
  const messageBreakIndices: number[] = [];
  const messageTracks: MessageTrack[] = [];
  let maxTrackLength = 0;

  const decodedMap = extractDecimalsForDecoder(pattern, inversion, stepMode, eyes);

  for (const mIdx of msgsToExtract) {
    if (stream.length > 0) {
      messageBreakIndices.push(stream.length);
    }

    const trackStream: number[] = [];
    const trackTrigrams: Array<{
      rawValues: [number, number, number];
      trigramDecimal: number;
      quinaryCode: string;
      messageIndex: number;
    }> = [];

    const msgData = decodedMap[mIdx];

    if (streamType === 'raw_digits') {
      const msgEyes = extractMessageEyesWithPattern(mIdx, pattern, eyes, inversion);
      for (const e of msgEyes) {
        stream.push(e.val);
        trackStream.push(e.val);
      }
      if (msgData) {
        for (const item of msgData.items) {
          const tItem = {
            rawValues: item.rawValues,
            trigramDecimal: item.trigramDecimal,
            quinaryCode: item.quinaryCode,
            messageIndex: mIdx,
          };
          trigrams.push(tItem);
          trackTrigrams.push(tItem);
        }
      }
    } else {
      if (msgData) {
        for (const item of msgData.items) {
          stream.push(item.trigramDecimal);
          trackStream.push(item.trigramDecimal);
          const tItem = {
            rawValues: item.rawValues,
            trigramDecimal: item.trigramDecimal,
            quinaryCode: item.quinaryCode,
            messageIndex: mIdx,
          };
          trigrams.push(tItem);
          trackTrigrams.push(tItem);
        }
      }
    }

    if (trackStream.length > maxTrackLength) {
      maxTrackLength = trackStream.length;
    }

    messageTracks.push({
      messageIndex: mIdx,
      name: MESSAGE_NAMES[mIdx] || `Message ${mIdx}`,
      color: MESSAGE_COLORS[mIdx] || '#00f0ff',
      stream: trackStream,
      trigrams: trackTrigrams,
      length: trackStream.length,
    });
  }

  return {
    stream,
    trigrams,
    totalLength: stream.length,
    messageBreakIndices,
    messageTracks,
    maxTrackLength,
  };
}

