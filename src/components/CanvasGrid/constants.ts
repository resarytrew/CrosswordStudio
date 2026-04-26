export const COLORS = {
  background: '#FFFFFF',
  gridLine: '#1E2A35',
  blockFill: '#1E2A35',
  letter: '#1E2A35',
  completedLetter: '#16A34A',
  number: '#7A6A58',
  selectedCell: '#E8C97A',
  highlightedWord: '#F5EBDD',
  errorLetter: '#DC2626',
} as const;

export const LAYOUT = {
  lineWidth: 2,
  numberOffsetX: 3,
  numberOffsetY: 2,
  numberFontSize: 10,
  letterFontSize: 24,
  fontFamily: '"Source Serif 4", Georgia, serif',
} as const;

export const INTERACTION = {
  minCellSize: 20,
  maxCellSize: 80,
} as const;
