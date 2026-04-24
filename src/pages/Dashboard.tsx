import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, orderBy, limit } from 'firebase/firestore';
import { Crossword, BoardState } from '../types';
import { createEmptyGrid, updateGridNumbers } from '../lib/gridUtils';
import { Plus, Play, PenTool, LayoutTemplate } from 'lucide-react';
import { motion } from 'motion/react';
import { templates, Template } from '../lib/templates';

export function Dashboard() {
  const { user, login } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [crosswords, setCrosswords] = useState<Crossword[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPuzzles() {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        const q = query(
          collection(db, 'crosswords'),
          where('authorId', '==', user.uid),
            orderBy('updatedAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Crossword));
        setCrosswords(fetched);
      } catch (err) {
        handleFirestoreError(err, 'list');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPuzzles();
  }, [user]);

  const handleCreateFromTemplate = async (template: Template) => {
    if (!user) return;
    const newId = crypto.randomUUID();
    
    // Convert template string array to BoardState
    const grid = [];
    for (let y = 0; y < template.height; y++) {
      const row = template.layout[y] || "";
      for (let x = 0; x < template.width; x++) {
        const char = row[x] || " ";
        grid.push({
          x,
          y,
          isBlock: char === '#',
          isHidden: char === ' ',
          value: '',
          number: null
        });
      }
    }
    
    let boardState: BoardState = {
      width: template.width,
      height: template.height,
      grid: grid,
      clues: { across: [], down: [] }
    };
    
    boardState = updateGridNumbers(boardState);

    const newPw: Crossword = {
      authorId: user.uid,
      title: language === 'ru' ? template.nameRu : template.name,
      boardState: JSON.stringify(boardState),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublished: false
    };

    try {
      await setDoc(doc(db, 'crosswords', newId), newPw);
      navigate(`/editor/${newId}`);
    } catch (err) {
      handleFirestoreError(err, 'create', `/crosswords/${newId}`);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    const newId = crypto.randomUUID();
    const boardState = createEmptyGrid(15, 15);
    const newPw: Crossword = {
      authorId: user.uid,
      title: "Untitled Crossword",
      boardState: JSON.stringify(boardState),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublished: false
    };

    try {
      await setDoc(doc(db, 'crosswords', newId), newPw);
      navigate(`/editor/${newId}`);
    } catch (err) {
      handleFirestoreError(err, 'create', `/crosswords/${newId}`);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded shadow-xl p-8 text-center border border-slate-200"
        >
          <div className="mx-auto w-16 h-16 bg-slate-900 text-white flex items-center justify-center rounded mb-6">
            <LayoutTemplate size={32} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">{t('welcome')}</h2>
          <p className="text-slate-500 font-medium mb-6">{t('welcomeDesc')}</p>
          <button 
            onClick={login}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 transition-colors"
          >
            {t('signInGoogle')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl w-full mx-auto px-4 py-8 h-full overflow-auto">
      <div className="mb-12 border-b border-transparent pb-10">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">{t('templates')}</h2>
          <p className="text-slate-500 mt-1 mb-6 text-lg">{t('templatesDesc')}</p>
        </div>
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {templates.map((tpl, i) => (
            <motion.button 
              key={tpl.id}
              onClick={() => handleCreateFromTemplate(tpl)}
              variants={{
                hidden: { opacity: 0, scale: 0.95, y: 10 },
                visible: { opacity: 1, scale: 1, y: 0 }
              }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white group rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 border border-slate-200/60 flex flex-col h-full text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center">
                    <Plus size={18} />
                 </div>
              </div>
              <div className="flex items-center gap-4 mb-5">
                <div 
                  className="w-14 h-14 bg-slate-50 flex flex-col items-center justify-center rounded-xl overflow-hidden p-1.5 border border-slate-100 group-hover:border-indigo-200 group-hover:bg-indigo-50/50 transition-colors shadow-inner"
                >
                  <div 
                     className="grid w-full h-full gap-px" 
                     style={{ gridTemplateColumns: `repeat(${tpl.width}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${tpl.height}, minmax(0, 1fr))` }}
                  >
                     {tpl.layout.map((row, y) => (
                        row.split('').map((char, x) => (
                          <div 
                            key={`${x}-${y}`} 
                            className={
                              char === '#' ? "bg-slate-800 rounded-sm" : 
                              char === ' ' ? "bg-slate-100 rounded-sm" : "bg-white border-[0.5px] border-slate-300 rounded-sm shadow-sm"
                            }
                          />
                        ))
                     ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-xl tracking-tight text-slate-800 group-hover:text-indigo-600 transition-colors">
                    {language === 'ru' ? tpl.nameRu : tpl.name}
                  </h3>
                  <div className="text-sm font-medium text-slate-400 flex items-center gap-2 mt-1">
                    <span>{tpl.width} x {tpl.height} grid</span>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">{t('dashboard')}</h2>
          <p className="text-slate-500 mt-1 text-lg">{t('dashboardDesc')}</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-md hover:shadow-xl hover:shadow-slate-900/20 active:scale-[0.98]"
        >
          <Plus size={20} />
          <span>{t('newCrossword')}</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-56 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : crosswords.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-200 shadow-sm text-center px-4"
        >
          <div className="w-24 h-24 bg-indigo-50 text-indigo-400 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <PenTool size={40} />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-3">{t('noCrosswords')}</h3>
          <p className="text-slate-500 mb-8 max-w-sm text-lg leading-relaxed">{t('startBuildingDesc')}</p>
          <button 
            onClick={handleCreate} 
            className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-600/30 active:scale-95"
          >
            {t('startBuilding')}
          </button>
        </motion.div>
      ) : (
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {crosswords.map((cw, i) => (
            <motion.div 
              key={cw.id}
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4 }}
              className="bg-white group rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 border border-slate-200/80 flex flex-col h-full"
            >
              <div className="flex-1">
                <div className="flex items-start justify-between mb-4 gap-3">
                  <h3 className="font-extrabold text-xl tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight">
                    {cw.title || t('untitled')}
                  </h3>
                  {cw.isPublished && (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-full shrink-0 mt-1">
                      {t('live')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono mb-4 uppercase tracking-wider font-semibold">
                  {new Date(cw.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              
              <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
                <button 
                  onClick={() => navigate(`/editor/${cw.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 font-semibold transition-all text-sm active:scale-95"
                >
                  <PenTool size={16} /> {t('edit')}
                </button>
                <button 
                  onClick={() => navigate(`/play/${cw.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md text-sm active:scale-95"
                >
                  <Play size={16} /> {t('play')}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
