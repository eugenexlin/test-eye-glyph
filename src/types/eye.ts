export type PupilDirection = 'center' | 'up' | 'right' | 'down' | 'left';

export type EyeInversionMode = 'none' | 'return_only' | 'all';

export interface EyeInversionSettings {
  mode: EyeInversionMode;
  swapUpDown: boolean;
  swapLeftRight: boolean;
}

export const DEFAULT_EYE_INVERSION: EyeInversionSettings = {
  mode: 'none',
  swapUpDown: true,
  swapLeftRight: true,
};

export interface EyeGlyph {
  id: string;
  source: 'east' | 'west';
  sectionName: string;
  messageIndex: number; // 1 to 9 (corresponds to line in noitaeye.txt)
  rowIndex: number;
  colIndex: number;
  charIndex: number;
  cx: number;
  cy: number;
  val: number; // 0, 1, 2, 3, 4
  dir: PupilDirection;
}

export interface EyeMessageSummary {
  messageIndex: number;
  source: 'east' | 'west';
  sectionName: string;
  charCount: number;
  rowCount: number;
  rawString: string;
  noitaEyeString: string;
  isMatch: boolean;
  eyes: EyeGlyph[];
}
