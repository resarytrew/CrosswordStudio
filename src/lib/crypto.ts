import { BoardState } from '../types';

export function computeAnswersHash(board: BoardState): string {
  const answers: Record<string, string> = {};
  
  for (const cell of board.grid) {
    if (!cell.isBlock && !cell.isHidden && cell.value) {
      answers[`${cell.x},${cell.y}`] = cell.value.toUpperCase();
    }
  }
  
  const sorted = Object.keys(answers).sort();
  const combined = sorted.map(k => `${k}:${answers[k]}`).join('|');
  
  return hashString(combined);
}

export function hashString(str: string): string {
  let hash1 = 0;
  let hash2 = 0;
  let hash3 = 0;
  let hash4 = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = (hash1 * 31 + char) | 0;
    hash2 = (hash2 * 17 + char * 2) | 0;
    hash3 = (hash3 * 13 + char * 3) | 0;
    hash4 = (hash4 * 19 + char * 5) | 0;
  }
  
  const result = [];
  result.push((hash1 >>> 0).toString(16).padStart(8, '0'));
  result.push((hash2 >>> 0).toString(16).padStart(8, '0'));
  result.push((hash3 >>> 0).toString(16).padStart(8, '0'));
  result.push((hash4 >>> 0).toString(16).padStart(8, '0'));
  
  return result.join('');
}

export function verifyAnswers(userAnswers: Record<string, string>, correctAnswers: Record<string, string>): boolean {
  for (const key in correctAnswers) {
    const userAnswer = (userAnswers[key] || '').toUpperCase();
    const correctAnswer = correctAnswers[key].toUpperCase();
    if (userAnswer !== correctAnswer) {
      return false;
    }
  }
  return true;
}

export function extractAnswersFromBoard(board: BoardState): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const cell of board.grid) {
    if (!cell.isBlock && !cell.isHidden && cell.value) {
      answers[`${cell.x},${cell.y}`] = cell.value.toUpperCase();
    }
  }
  return answers;
}