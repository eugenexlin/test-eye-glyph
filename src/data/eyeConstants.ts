export type OverlayMode = 'numbers' | 'shapes' | 'boxes' | 'none';

export const DIR_NAMES: Record<number, string> = {
  0: 'Center',
  1: 'Up (North)',
  2: 'Right (East)',
  3: 'Down (South)',
  4: 'Left (West)',
};

export const DIR_COLORS: Record<number, string> = {
  0: '#a855f7', // Purple
  1: '#3b82f6', // Blue
  2: '#10b981', // Green
  3: '#f59e0b', // Amber
  4: '#ef4444', // Red
};
