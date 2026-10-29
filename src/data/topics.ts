export interface TopicItem {
  id: string;
  title: string;
  subtitle: string;
}

export const TOPICS: TopicItem[] = [
  {
    id: 'intro',
    title: 'Introduction',
    subtitle: '',
  },
  {
    id: 'topic-1',
    title: 'Image Extraction & Overlay',
    subtitle: 'PNG visualizer, coordinate mapping & dataset',
  },
  {
    id: 'topic-2',
    title: 'Trigram Analysis',
    subtitle: '125 quinary trigrams, frequencies & distribution',
  },
  {
    id: 'topic-3',
    title: 'Inverted Return Decoder',
    subtitle: '83-character quinary mapping (0..82), candidate alphabets & cryptanalysis',
  },
  {
    id: 'topic-4',
    title: 'Scrolling Window & Modulo',
    subtitle: 'Cumulative sums, sliding windows, modulo sweeps & frequency shaping',
  },
  {
    id: 'topic-5',
    title: 'Visual Plotter & Coordinate Grapher',
    subtitle: 'Turtle vector walks & experimental 3D turn-and-walk space tracer',
  },
];
