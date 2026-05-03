import { BoardState, Crossword } from '../types';

type WordArtStyle = 'classic' | 'neon' | 'minimalist' | 'vintage' | 'modern' | 'print' | 'newspaper' | 'braille';
type ExportType = 'filled' | 'empty' | 'clues';

interface ExportOptions {
  resolution?: number;
  showNumbers?: boolean;
  showWatermark?: boolean;
  showDate?: boolean;
}

const styleConfigs: Record<WordArtStyle, {
  background: string;
  cellBg: string;
  cellBorder: string;
  letterColor: string;
  numberColor: string;
  accentColor: string;
  fontFamily: string;
  titleColor: string;
}> = {
  classic: {
    background: 'linear-gradient(135deg, #FDF8F3 0%, #F7F3E8 100%)',
    cellBg: '#ffffff',
    cellBorder: '#2C1810',
    letterColor: '#2C1810',
    numberColor: '#4A3728',
    accentColor: '#D4A853',
    fontFamily: 'Playfair Display, serif',
    titleColor: '#2C1810',
  },
  neon: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    cellBg: '#0f0f23',
    cellBorder: '#00ff88',
    letterColor: '#00ff88',
    numberColor: '#ff00ff',
    accentColor: '#00ffff',
    fontFamily: 'JetBrains Mono, monospace',
    titleColor: '#00ff88',
  },
  minimalist: {
    background: '#ffffff',
    cellBg: '#ffffff',
    cellBorder: '#000000',
    letterColor: '#000000',
    numberColor: '#666666',
    accentColor: '#000000',
    fontFamily: 'Inter, sans-serif',
    titleColor: '#000000',
  },
  vintage: {
    background: 'linear-gradient(135deg, #f4e4c9 0%, #e8d9b0 100%)',
    cellBg: '#fffef5',
    cellBorder: '#5c4a32',
    letterColor: '#3d2b1f',
    numberColor: '#8b7355',
    accentColor: '#8b4513',
    fontFamily: 'Source Serif 4, serif',
    titleColor: '#3d2b1f',
  },
  modern: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    cellBg: 'rgba(255,255,255,0.95)',
    cellBorder: '#667eea',
    letterColor: '#1a1a2e',
    numberColor: '#764ba2',
    accentColor: '#f5af19',
    fontFamily: 'Inter, sans-serif',
    titleColor: '#ffffff',
  },
  print: {
    background: '#ffffff',
    cellBg: '#ffffff',
    cellBorder: '#000000',
    letterColor: '#000000',
    numberColor: '#000000',
    accentColor: '#333333',
    fontFamily: 'Times New Roman, serif',
    titleColor: '#000000',
  },
  newspaper: {
    background: '#f5f5dc',
    cellBg: '#fffef5',
    cellBorder: '#2c2c2c',
    letterColor: '#1a1a1a',
    numberColor: '#666666',
    accentColor: '#8b0000',
    fontFamily: 'Georgia, serif',
    titleColor: '#1a1a1a',
  },
  braille: {
    background: '#ffffff',
    cellBg: '#ffffff',
    cellBorder: '#000000',
    letterColor: '#000000',
    numberColor: '#000000',
    accentColor: '#000000',
    fontFamily: 'Arial, sans-serif',
    titleColor: '#000000',
  },
};

function getCell(board: BoardState, x: number, y: number) {
  return board.grid.find(c => c.x === x && c.y === y);
}

function hexToRgb(hex: string): string {
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function getBackgroundFill(config: typeof styleConfigs[keyof typeof styleConfigs]): string {
  if (config.background.includes('gradient')) {
    const colors = config.background.match(/#[a-f0-9]{6}/gi) || ['#FDF8F3', '#F7F3E8'];
    return `url(#grad)`;
  }
  return config.background;
}

export function generateSVG(
  board: BoardState,
  cw: Crossword,
  style: WordArtStyle,
  exportType: ExportType,
  options: ExportOptions = {}
): string {
  const {
    showNumbers = true,
    showWatermark = false,
    showDate = true,
  } = options;

  const config = styleConfigs[style];
  const padding = 40;
  const cellSize = 24;
  const gridWidth = board.width * cellSize;
  const gridHeight = board.height * cellSize;
  const titleHeight = 80;
  const footerHeight = showWatermark ? 60 : 20;
  
  let cluesHeight = 0;
  if (exportType === 'clues') {
    const maxClues = Math.max(board.clues.across.length, board.clues.down.length);
    cluesHeight = maxClues * 20 + 40;
  }

  const width = gridWidth + padding * 2;
  const height = width + titleHeight + footerHeight + cluesHeight;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
`;

  if (config.background.includes('gradient')) {
    const colors = config.background.match(/#[a-f0-9]{6}/gi) || ['#FDF8F3', '#F7F3E8'];
    svg += `  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors[1] || colors[0]};stop-opacity:1" />
    </linearGradient>
  </defs>
`;
  }

  svg += `  <rect width="100%" height="100%" fill="${getBackgroundFill(config)}"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(config.fontFamily.split(',')[0].trim())}&display=swap');
  </style>
`;

  svg += `  <text x="${width / 2}" y="${padding + 25}" font-family="${config.fontFamily}" font-size="28" font-weight="bold" fill="${config.titleColor}" text-anchor="middle">${cw.title || 'Crossword'}</text>
`;
  
  if (showDate) {
    const date = new Date(cw.updatedAt).toLocaleDateString();
    svg += `  <text x="${width / 2}" y="${padding + 48}" font-family="${config.fontFamily}" font-size="14" fill="${config.numberColor}" text-anchor="middle">Created: ${date}</text>
`;
  }

  const startY = padding + titleHeight;
  const startX = (width - gridWidth) / 2;

  svg += `  <g transform="translate(${startX}, ${startY})">
`;

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = getCell(board, x, y);
      if (!cell) continue;

      const cellX = x * cellSize;
      const cellY = y * cellSize;

      if (cell.isBlock) {
        const fill = style === 'neon' ? '#0f0f23' : config.cellBorder;
        svg += `    <rect x="${cellX}" y="${cellY}" width="${cellSize}" height="${cellSize}" fill="${fill}"/>\n`;
      } else if (!cell.isHidden) {
        svg += `    <rect x="${cellX}" y="${cellY}" width="${cellSize}" height="${cellSize}" fill="${config.cellBg}" stroke="${config.cellBorder}" stroke-width="1"/>\n`;

        if (cell.number && showNumbers) {
          svg += `    <text x="${cellX + 4}" y="${cellY + 8}" font-family="${config.fontFamily}" font-size="${cellSize * 0.25}" fill="${config.numberColor}">${cell.number}</text>\n`;
        }

        if (exportType === 'filled' && cell.value) {
          svg += `    <text x="${cellX + cellSize / 2}" y="${cellY + cellSize / 2 + cellSize * 0.1}" font-family="${config.fontFamily}" font-size="${cellSize * 0.6}" font-weight="bold" fill="${config.letterColor}" text-anchor="middle">${cell.value}</text>\n`;
        } else if (exportType === 'empty' || exportType === 'clues') {
          svg += `    <text x="${cellX + cellSize / 2}" y="${cellY + cellSize / 2}" font-family="${config.fontFamily}" font-size="${cellSize * 0.5}" fill="${config.numberColor}" text-anchor="middle" opacity="0.3">_</text>\n`;
        }
      }
    }
  }

  svg += `  </g>\n`;

  if (exportType === 'clues') {
    const cluesStartY = startY + gridHeight + 30;
    const colWidth = width - padding * 2;
    
    svg += `  <text x="${padding}" y="${cluesStartY}" font-family="${config.fontFamily}" font-size="16" font-weight="bold" fill="${config.titleColor}">ACROSS</text>
`;
    svg += `  <text x="${padding + colWidth / 2}" y="${cluesStartY}" font-family="${config.fontFamily}" font-size="16" font-weight="bold" fill="${config.titleColor}" text-anchor="end">DOWN</text>
`;

    const acrossClues = board.clues.across.filter(c => c.text);
    const downClues = board.clues.down.filter(c => c.text);
    const maxRows = Math.max(acrossClues.length, downClues.length);

    for (let i = 0; i < maxRows; i++) {
      const y = cluesStartY + 22 + i * 18;
      
      if (acrossClues[i]) {
        svg += `  <text x="${padding}" y="${y}" font-family="${config.fontFamily}" font-size="12" fill="${config.letterColor}">${acrossClues[i].number}. ${acrossClues[i].text}</text>\n`;
      }
      
      if (downClues[i]) {
        svg += `  <text x="${padding + colWidth / 2}" y="${y}" font-family="${config.fontFamily}" font-size="12" fill="${config.letterColor}" text-anchor="end">${downClues[i].number}. ${downClues[i].text}</text>\n`;
      }
    }
  }

  if (showWatermark) {
    svg += `  <text x="${width / 2}" y="${height - 20}" font-family="${config.fontFamily}" font-size="12" fill="${config.numberColor}" text-anchor="middle">Crossword Studio</text>\n`;
  }

  svg += `</svg>`;

  return svg;
}

export function generateHTML(
  board: BoardState,
  cw: Crossword,
  style: WordArtStyle,
  exportType: ExportType,
  options: ExportOptions = {}
): string {
  const {
    showNumbers = true,
    showWatermark = false,
  } = options;

  const config = styleConfigs[style];
  const cellSize = 28;
  const padding = cellSize;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cw.title || 'Crossword'}</title>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(config.fontFamily.split(',')[0].trim())}&amp;display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: ${config.fontFamily}, serif; 
      background: ${config.background.includes('gradient') ? '#FDF8F3' : config.background};
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    h1 { color: ${config.titleColor}; font-size: 28px; margin-bottom: 8px; }
    .date { color: ${config.numberColor}; font-size: 14px; margin-bottom: 24px; }
    .crossword-container { display: inline-block; }
    .grid { 
      display: grid; 
      grid-template-columns: repeat(${board.width}, ${cellSize}px);
      gap: 0;
      background: ${config.cellBorder};
      border: 1px solid ${config.cellBorder};
    }
    .cell {
      width: ${cellSize}px;
      height: ${cellSize}px;
      background: ${config.cellBg};
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      position: relative;
    }
    .cell.block { background: ${style === 'neon' ? '#0f0f23' : config.cellBorder}; }
    .cell .number {
      font-size: 8px;
      color: ${config.numberColor};
      padding: 2px;
      line-height: 1;
    }
    .cell .letter {
      font-size: 16px;
      font-weight: bold;
      color: ${config.letterColor};
      width: 100%;
      text-align: center;
      padding-top: 4px;
    }
    .cell .empty {
      font-size: 14px;
      color: ${config.numberColor};
      opacity: 0.3;
      width: 100%;
      text-align: center;
      padding-top: 4px;
    }
    .watermark {
      margin-top: 24px;
      color: ${config.numberColor};
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>${cw.title || 'Crossword'}</h1>
  <p class="date">Created: ${new Date(cw.updatedAt).toLocaleDateString()}</p>
  <div class="crossword-container">
    <div class="grid">
`;

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = getCell(board, x, y);
      if (!cell) {
        html += `<div class="cell"></div>`;
        continue;
      }

      if (cell.isBlock) {
        html += `<div class="cell block"></div>`;
      } else if (cell.isHidden) {
        html += `<div class="cell" style="visibility:hidden"></div>`;
      } else {
        html += `<div class="cell">`;
        if (cell.number && showNumbers) {
          html += `<span class="number">${cell.number}</span>`;
        }
        if (exportType === 'filled' && cell.value) {
          html += `<span class="letter">${cell.value}</span>`;
        } else if (exportType === 'empty' || exportType === 'clues') {
          html += `<span class="empty">_</span>`;
        }
        html += `</div>`;
      }
    }
  }

  html += `    </div>
  </div>
  ${showWatermark ? '<p class="watermark">Crossword Studio</p>' : ''}
</body>
</html>`;

  return html;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSVG(
  board: BoardState,
  cw: Crossword,
  style: WordArtStyle,
  exportType: ExportType,
  options?: ExportOptions
): void {
  const svg = generateSVG(board, cw, style, exportType, options);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  downloadBlob(blob, `${cw.title || 'crossword'}.svg`);
}

export function downloadHTML(
  board: BoardState,
  cw: Crossword,
  style: WordArtStyle,
  exportType: ExportType,
  options?: ExportOptions
): void {
  const html = generateHTML(board, cw, style, exportType, options);
  const blob = new Blob([html], { type: 'text/html' });
  downloadBlob(blob, `${cw.title || 'crossword'}.html`);
}