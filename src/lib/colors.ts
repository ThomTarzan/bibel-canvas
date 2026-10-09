/** Word fills are saturated enough to read as analysis marks, and still light enough for dark text. */
export const FILL_COLORS = [
  '#f5c400',
  '#ff7a1a',
  '#ef4444',
  '#e23d8c',
  '#7c5cfc',
  '#2f6fed',
  '#12a36a',
  '#12b5c9',
];

export const INK_COLORS = ['#1c1917', '#b42318', '#9a3412', '#1d4ed8', '#166534', '#6d28d9'];

/** Frame strokes are stronger and more saturated than the word fills. */
export const FRAME_PRESETS: { color: string; name: string }[] = [
  { color: '#e10600', name: 'subjekt' },
  { color: '#1d4ed8', name: 'verb' },
  { color: '#15803d', name: 'gjentakelse' },
];

export const EXTRA_FRAME_COLORS = ['#c2410c', '#7e22ce', '#0f766e', '#be185d', '#a16207'];

/** Single outline used by relation arrows. Null on an arrow means this colour. */
export const ARROW_OUTLINE = '#3a3935';

export const ARROW_OUTLINE_CHOICES = ['#3a3935', '#5c564c', '#1f1d1a'];
