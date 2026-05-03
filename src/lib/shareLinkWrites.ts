import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from './firebase';
import { generateShareSlug } from './slug';

/** Points slug → crossword document id (public read). */
export async function upsertShareLink(slug: string, crosswordId: string): Promise<boolean> {
  try {
    await setDoc(doc(db, 'shareLinks', slug), { crosswordId }, { merge: true });
    return true;
  } catch (e) {
    console.error('[upsertShareLink] error:', e);
    handleFirestoreError(e, 'create', `/shareLinks/${slug}`);
    return false;
  }
}

export async function removeShareLink(slug: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shareLinks', slug));
  } catch (e) {
    handleFirestoreError(e, 'delete', `/shareLinks/${slug}`);
  }
}

export async function allocateUniqueShareSlug(maxAttempts = 28): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const s = generateShareSlug(8);
    const snap = await getDoc(doc(db, 'shareLinks', s));
    if (!snap.exists()) return s;
  }
  throw new Error('Could not allocate a unique share slug');
}
