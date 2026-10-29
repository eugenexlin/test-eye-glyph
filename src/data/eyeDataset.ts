import type { EyeMessageSummary } from '../types/eye';
import { ALL_EYES } from './allEyes';
import { NOITA_EYE_LINES } from './noitaEyeLines';

export interface ImageSectionConfig {
  source: 'east' | 'west';
  sectionName: string;
  messageIndex: number;
  startY: number;
  endY: number;
}

export const SECTION_CONFIGS: ImageSectionConfig[] = [
  { source: 'east', sectionName: 'east 1', messageIndex: 1, startY: 35, endY: 100 },
  { source: 'west', sectionName: 'west 1', messageIndex: 2, startY: 35, endY: 100 },
  { source: 'east', sectionName: 'east 2', messageIndex: 3, startY: 135, endY: 215 },
  { source: 'west', sectionName: 'west 2', messageIndex: 4, startY: 135, endY: 205 },
  { source: 'east', sectionName: 'east 3', messageIndex: 5, startY: 250, endY: 345 },
  { source: 'west', sectionName: 'west 3', messageIndex: 6, startY: 235, endY: 315 },
  { source: 'east', sectionName: 'east 4', messageIndex: 7, startY: 375, endY: 460 },
  { source: 'west', sectionName: 'west 4', messageIndex: 8, startY: 350, endY: 430 },
  { source: 'east', sectionName: 'east 5', messageIndex: 9, startY: 490, endY: 575 },
];

export function getMessageSummaries(): EyeMessageSummary[] {
  const summaries: EyeMessageSummary[] = [];

  for (let msgIdx = 1; msgIdx <= 9; msgIdx++) {
    const eyes = ALL_EYES.filter(e => e.messageIndex === msgIdx);
    const firstEye = eyes[0];
    const source = firstEye ? firstEye.source : (msgIdx % 2 === 1 ? 'east' : 'west');
    const sectionName = firstEye ? firstEye.sectionName : `${source} ${Math.ceil(msgIdx / 2)}`;
    const rowIndices = new Set(eyes.map(e => e.rowIndex));
    const rawString = eyes.map(e => e.val).join('');
    const noitaEyeString = NOITA_EYE_LINES[msgIdx - 1] ?? '';
    const isMatch = rawString === noitaEyeString;

    summaries.push({
      messageIndex: msgIdx,
      source,
      sectionName,
      charCount: eyes.length,
      rowCount: rowIndices.size,
      rawString,
      noitaEyeString,
      isMatch,
      eyes,
    });
  }

  return summaries;
}
