export const COLORS = {
  background: '#F7F2E8',
  backgroundTop: '#FCF8EF',
  backgroundBottom: '#EDE3D2',
  gridLine: '#8D7A61',
  gridLineSoft: '#C8B79E',
  blockFill: '#1F2A36',
  blockEdge: '#44576B',
  letter: '#1B242D',
  completedLetter: '#16A34A',
  number: '#6F5D48',
  selectedCell: '#D5A960',
  selectedCellSoft: '#F0D9A7',
  selectedGlow: 'rgba(213, 169, 96, 0.45)',
  highlightedWord: '#EEDFC3',
  highlightedWordSoft: '#FAF1E2',
  filledCellTop: '#FFF8EC',
  filledCellBottom: '#F3E2C4',
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
