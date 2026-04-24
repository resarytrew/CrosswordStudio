import React, { useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCafe } from '../contexts/CafeContext';
import { BoardState, Crossword } from '../types';
import { Download, Share2, Instagram, Twitter, Copy, Check, Palette, Sparkles, Type, Sunrise } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type WordArtStyle = 'classic' | 'neon' | 'minimalist' | 'vintage' | 'modern';

interface WordArtStyleOption {
  id: WordArtStyle;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const styles: WordArtStyleOption[] = [
  { id: 'classic', name: 'Classic', description: 'Traditional book style', icon: <Type size={20} /> },
  { id: 'neon', name: 'Neon', description: 'Glowing night effect', icon: <Sparkles size={20} /> },
  { id: 'minimalist', name: 'Minimal', description: 'Clean and simple', icon: <Palette size={20} /> },
  { id: 'vintage', name: 'Vintage', description: 'Old newspaper feel', icon: <Sunrise size={20} /> },
  { id: 'modern', name: 'Modern', description: 'Contemporary design', icon: <Sparkles size={20} /> },
];

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
};

export function WordArtExport() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { playSound } = useCafe();
  const navigate = useNavigate();

  const [cw, setCw] = useState<Crossword | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  const [style, setStyle] = useState<WordArtStyle>('classic');
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const d = await getDoc(doc(db, 'crosswords', id));
        if (d.exists()) {
          const data = d.data() as Crossword;
          setCw(data);
          setBoard(JSON.parse(data.boardState) as BoardState);
        }
      } catch (err) {
        handleFirestoreError(err, 'get', `/crosswords/${id}`);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const getCell = (x: number, y: number) => board?.grid.find(c => c.x === x && c.y === y);

  const renderWordArt = useCallback(() => {
    if (!board || !canvasRef.current || !cw) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config = styleConfigs[style];
    const padding = 40;
    const cellSize = Math.min(600 / board.width, 600 / board.height);
    const gridWidth = board.width * cellSize;
    const gridHeight = board.height * cellSize;
    const titleHeight = 80;
    const footerHeight = 60;

    canvas.width = gridWidth + padding * 2;
    canvas.height = gridWidth + padding * 2 + titleHeight + footerHeight;

    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (config.background.includes('gradient')) {
      const colors = config.background.match(/#[a-f0-9]{6}/gi) || ['#FDF8F3', '#F7F3E8'];
      bgGradient.addColorStop(0, colors[0]);
      bgGradient.addColorStop(1, colors[1] || colors[0]);
    } else {
      bgGradient.addColorStop(0, config.background);
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `bold 28px ${config.fontFamily}`;
    ctx.fillStyle = config.titleColor;
    ctx.textAlign = 'center';
    ctx.fillText(cw.title || 'Crossword', canvas.width / 2, padding + 25);

    ctx.font = `14px ${config.fontFamily}`;
    ctx.fillStyle = config.numberColor;
    const date = new Date(cw.updatedAt).toLocaleDateString();
    ctx.fillText(`Created: ${date}`, canvas.width / 2, padding + 45);

    const startY = padding + titleHeight;
    const startX = (canvas.width - gridWidth) / 2;

    ctx.font = `bold ${cellSize * 0.6}px ${config.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = getCell(x, y);
        if (!cell) continue;

        const cellX = startX + x * cellSize;
        const cellY = startY + y * cellSize;

        if (cell.isBlock) {
          ctx.fillStyle = style === 'neon' ? '#0f0f23' : config.cellBorder;
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
        } else if (!cell.isHidden) {
          ctx.fillStyle = config.cellBg;
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
          
          ctx.strokeStyle = config.cellBorder;
          ctx.lineWidth = style === 'neon' ? 2 : 1;
          if (style === 'neon') {
            ctx.shadowColor = config.accentColor;
            ctx.shadowBlur = 10;
          }
          ctx.strokeRect(cellX, cellY, cellSize, cellSize);
          ctx.shadowBlur = 0;

          if (cell.number) {
            ctx.font = `bold ${cellSize * 0.25}px ${config.fontFamily}`;
            ctx.fillStyle = config.numberColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(cell.number.toString(), cellX + 4, cellY + 4);
          }

          if (cell.value) {
            ctx.font = `bold ${cellSize * 0.6}px ${config.fontFamily}`;
            ctx.fillStyle = config.letterColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            if (style === 'neon') {
              ctx.shadowColor = config.accentColor;
              ctx.shadowBlur = 15;
            }
            ctx.fillText(cell.value, cellX + cellSize / 2, cellY + cellSize / 2 + cellSize * 0.1);
            ctx.shadowBlur = 0;
          }
        }
      }
    }

    ctx.font = `12px ${config.fontFamily}`;
    ctx.fillStyle = config.numberColor;
    ctx.textAlign = 'center';
    ctx.fillText('Crossword Studio', canvas.width / 2, canvas.height - 20);

  }, [board, cw, style, getCell]);

  React.useEffect(() => {
    if (board && cw) {
      renderWordArt();
    }
  }, [board, cw, style, renderWordArt]);

  const downloadImage = useCallback(() => {
    if (!canvasRef.current) return;
    playSound('save');
    
    const link = document.createElement('a');
    link.download = `${cw?.title || 'crossword'}-wordart.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }, [cw, playSound]);

  const copyToClipboard = useCallback(async () => {
    if (!canvasRef.current) return;
    playSound('success');
    
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob(resolve, 'image/png');
      });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [playSound]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-display text-xl text-cafe-espresso/60">Loading...</div>
      </div>
    );
  }

  if (!board || !cw) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-display text-xl text-cafe-espresso/60">Crossword not found</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center p-8 overflow-auto">
      <div className="max-w-3xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-cafe-paper rounded-sm shadow-xl p-8"
        >
          <h2 className="text-display text-2xl font-bold text-cafe-leather mb-6 flex items-center gap-3">
            <Sparkles className="text-cafe-gold" />
            Word Art Export
          </h2>

          <div className="mb-6">
            <p className="text-body text-cafe-espresso/70 mb-4">Choose a style:</p>
            <div className="grid grid-cols-5 gap-3">
              {styles.map((s) => (
                <motion.button
                  key={s.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setStyle(s.id);
                    playSound('cell-select');
                  }}
                  className={`p-4 rounded-sm border-2 transition-all ${
                    style === s.id
                      ? 'border-cafe-gold bg-cafe-gold/10'
                      : 'border-cafe-leather/20 hover:border-cafe-leather/40'
                  }`}
                >
                  <div className="flex justify-center mb-2 text-cafe-leather">{s.icon}</div>
                  <div className="text-subhead font-semibold text-sm text-cafe-leather">{s.name}</div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="mb-6 flex justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full shadow-lg"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>

          <div className="flex gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={downloadImage}
              className="flex items-center gap-2 px-6 py-3 bg-cafe-leather text-cafe-paper rounded-sm font-subhead font-semibold hover:bg-cafe-espresso transition-all shadow-lg"
            >
              <Download size={20} />
              Download PNG
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-6 py-3 bg-cafe-paper border border-cafe-leather/20 text-cafe-leather rounded-sm font-subhead font-semibold hover:bg-cafe-leather/5 transition-all shadow-md"
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
              {copied ? 'Copied!' : 'Copy'}
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => navigate('/')}
            className="mt-6 text-center w-full text-cafe-espresso/50 hover:text-cafe-leather transition-colors text-sm"
          >
            ← Back to Dashboard
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}