import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Crossword } from '../types';

export interface ResolvedCrossword {
  id: string;
  crossword: Crossword;
}

/**
 * Resolve /play/:param — Firestore document id (UUID) or short slug via shareLinks/{slug}.
 */
export async function fetchCrosswordBySlugOrId(param: string): Promise<ResolvedCrossword | null> {
  const trimmed = param.trim();
  if (!trimmed) return null;

  const direct = await getDoc(doc(db, 'crosswords', trimmed));
  if (direct.exists()) {
    return { id: direct.id, crossword: direct.data() as Crossword };
  }

  const link = await getDoc(doc(db, 'shareLinks', trimmed));
  if (!link.exists()) return null;
  const crosswordId = link.data()?.crosswordId as string | undefined;
  if (!crosswordId || typeof crosswordId !== 'string') return null;

  const cw = await getDoc(doc(db, 'crosswords', crosswordId));
  if (!cw.exists()) return null;

  return { id: cw.id, crossword: cw.data() as Crossword };
}
