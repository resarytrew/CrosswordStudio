export const COLORS = {
  background: '#FAFAF7',
  gridLine: '#2C1810',
  blockFill: '#2C1810',
  letter: '#2C1810',
  completedLetter: '#16A34A',
  number: '#666666',
  selectedCell: '#FCD34D',
  highlightedWord: '#FEF3C7',
  errorLetter: '#DC2626',
} as const;

export const LAYOUT = {
  lineWidth: 2,
  numberOffsetX: 3,
  numberOffsetY: 2,
  numberFontSize: 10,
  letterFontSize: 24,
  fontFamily: 'Inter, system-ui, sans-serif',
} as const;

export const INTERACTION = {
  minCellSize: 20,
  maxCellSize: 80,
} as const;