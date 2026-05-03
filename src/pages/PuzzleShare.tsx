import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, Coffee, Grid3X3, Play, Share2, User } from 'lucide-react';
import { fetchCrosswordBySlugOrId } from '../lib/crosswordResolve';
import { evaluatePlayAccess } from '../lib/crosswordAccess';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { parseBoardState } from '../lib/boardParser';
import type { Crossword, CrosswordDifficulty } from '../types';
import { ogImageUrl, playUrl, previewUrl } from '../lib/shareUrls';

function difficultyLabel(d: CrosswordDifficulty | undefined, language: string): string {
  const mapEn = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const mapRu = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' };
  const map = language === 'ru' ? mapRu : mapEn;
  const key = d ?? 'medium';
  return map[key];
}

export function PuzzleShare() {
  const { slugOrId } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [cw, setCw] = useState<Crossword | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'blocked' | 'missing'>('loading');

  useEffect(() => {
    if (!slugOrId) {
      setState('missing');
      return;
    }
    let cancelled = false;
    (async () => {
      setState('loading');
      const res = await fetchCrosswordBySlugOrId(slugOrId);
      if (cancelled) return;
      if (!res) {
        setState('missing');
        return;
      }
      const access = evaluatePlayAccess(res.crossword, user?.uid);
      if (access !== 'allowed') {
        setCw(res.crossword);
        setResolvedId(res.id);
        setState('blocked');
        return;
      }
      setCw(res.crossword);
      setResolvedId(res.id);
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [slugOrId, user?.uid]);

  const board = cw ? parseBoardState(cw.boardState) : null;
  const words = board ? board.clues.across.length + board.clues.down.length : 0;
  const canonicalSlugOrId = cw?.slug ?? resolvedId ?? slugOrId ?? '';
  const pageTitle = cw?.title || t('appTitle');
  const author =
    cw?.authorDisplayName ||
    (language === 'ru' ? 'Автор не указан' : 'Unknown author');
  const desc =
    language === 'ru'
      ? `${author} · ${board ? `${board.width}×${board.height}` : ''} · ${words} слов · ${difficultyLabel(cw?.difficulty, language)}`
      : `${author} · ${board ? `${board.width}×${board.height}` : ''} · ${words} words · ${difficultyLabel(cw?.difficulty, language)}`;

  if (state === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[linear-gradient(180deg,#1f2c22_0%,#2a3b2d_100%)]">
        <div className="w-11 h-11 border-2 border-[#9db897]/25 border-t-[#b8cf9d] rounded-full animate-spin" />
        <p className="font-subhead text-[#d8decb]/70 italic">{t('loadingPuzzle')}</p>
      </div>
    );
  }

  if (state === 'missing' || !cw || !resolvedId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 bg-[linear-gradient(180deg,#1f2c22_0%,#2a3b2d_100%)] text-center">
        <Coffee className="text-[#b8cf9d]/40 mb-4" size={40} />
        <h1 className="font-display text-2xl text-[#edf4e4] mb-2">{language === 'ru' ? 'Кроссворд не найден' : 'Puzzle not found'}</h1>
        <button type="button" className="mt-4 text-[#b8cf9d] underline font-subhead" onClick={() => navigate('/')}>
          {t('returnToPuzzles')}
        </button>
      </div>
    );
  }

  const blocked = state === 'blocked';

  return (
    <>
      <Helmet>
        <title>{`${pageTitle} · ${t('appTitle')}`}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={desc} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={previewUrl(canonicalSlugOrId)} />
        <meta property="og:image" content={ogImageUrl()} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={ogImageUrl()} />
      </Helmet>

      <div className="flex-1 min-h-[70vh] bg-[radial-gradient(circle_at_16%_14%,rgba(143,176,138,0.2),transparent_35%),linear-gradient(180deg,#162118_0%,#223126_55%,#2f4333_100%)] px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl mx-auto rounded-sm border border-[#8bab84]/35 bg-[linear-gradient(165deg,rgba(244,237,223,0.97)_0%,rgba(227,219,203,0.94)_100%)] shadow-[0_28px_70px_rgba(12,10,8,0.45)] overflow-hidden"
        >
          <div className="h-1.5 bg-gradient-to-r from-[#c4a035]/70 via-[#8bab84] to-[#c4a035]/70" />
          <div className="p-8 sm:p-10">
            <p className="font-subhead text-xs uppercase tracking-[0.22em] text-[#5a7058] mb-3">{t('shareCardTagline')}</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1f2a36] mb-6 leading-tight">{cw.title || t('untitled')}</h1>

            <div className="grid gap-3 mb-8">
              <div className="flex items-start gap-3 text-[#253241]">
                <User size={18} className="text-[#5a7b52] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#5a7058]/80 font-subhead">{t('shareAuthor')}</div>
                  <div className="font-body text-lg">{author}</div>
                </div>
              </div>
              <div className="flex items-start gap-3 text-[#253241]">
                <Grid3X3 size={18} className="text-[#5a7b52] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#5a7058]/80 font-subhead">{t('shareSizeWords')}</div>
                  <div className="font-body text-lg">
                    {board ? `${board.width}×${board.height}` : '—'} · {words}{' '}
                    {language === 'ru' ? 'слов' : 'words'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 text-[#253241]">
                <Share2 size={18} className="text-[#5a7b52] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#5a7058]/80 font-subhead">{t('shareDifficulty')}</div>
                  <div className="font-body text-lg">{difficultyLabel(cw.difficulty, language)}</div>
                </div>
              </div>
            </div>

            {board && (
              <div className="mb-8 rounded-sm border border-[#c4b79f]/55 bg-[#fcf9f3] p-3 shadow-inner">
                <div
                  className="grid w-full aspect-square max-h-52 mx-auto gap-[1px] bg-[#2c241c]/25 rounded-sm overflow-hidden"
                  style={{
                    gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${board.height}, minmax(0, 1fr))`,
                  }}
                >
                  {board.grid.map((cell, i) => (
                    <div
                      key={i}
                      className={
                        cell.isBlock
                          ? 'bg-[#2c241c]'
                          : cell.isHidden
                            ? 'bg-[#ebe4d8]'
                            : 'bg-[#fffdf9] border-[0.5px] border-[#d9cfc0]'
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {blocked ? (
              <p className="font-body text-[#6b5346] mb-6">{t('sharePrivateHint')}</p>
            ) : (
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Link
                  to={`/play/${canonicalSlugOrId}`}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-[#334a35] text-[#eef3e7] rounded-sm font-subhead font-bold text-lg hover:bg-[#48624a] transition-colors shadow-lg"
                >
                  <Play size={20} />
                  {t('shareSolveCta')}
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            )}

            {!blocked && (
              <button
                type="button"
                className="mt-4 w-full py-3 text-sm font-subhead text-[#3a5240]/80 hover:text-[#5a7b52] transition-colors"
                onClick={() => {
                  void navigator.clipboard.writeText(playUrl(canonicalSlugOrId));
                  toast.success(t('shareLinkCopied'));
                }}
              >
                {t('shareCopySolveLink')}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
