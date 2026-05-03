import type { Crossword } from '../types';

export type PlayAccessResult = 'allowed' | 'sign_in_required' | 'forbidden';

/**
 * Decide whether the current viewer may load/play this crossword from the server-loaded doc.
 * Firestore rules must mirror this for anonymous reads (visibility / publish).
 */
export function evaluatePlayAccess(crossword: Crossword, userId: string | undefined): PlayAccessResult {
  const owner = Boolean(userId && crossword.authorId === userId);
  if (owner) return 'allowed';

  const vis = crossword.visibility;

  if (vis === 'private') {
    if (!userId) return 'sign_in_required';
    return 'forbidden';
  }

  if (vis === 'link' || vis === 'public') return 'allowed';

  // Legacy docs without visibility
  if (crossword.isPublished) return 'allowed';

  return 'sign_in_required';
}
