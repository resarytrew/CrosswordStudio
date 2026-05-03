export type CrosswordVisibility = 'private' | 'link' | 'public';

export type CrosswordDifficulty = 'easy' | 'medium' | 'hard';

export interface Crossword {
  id?: string;
  authorId: string;
  /** Cached display name for share cards / previews */
  authorDisplayName?: string;
  title: string;
  boardState: BoardState;
  answersHash?: string;
  createdAt: number;
  updatedAt: number;
  isPublished: boolean;
  isTemplate?: boolean;
  /** Short share handle; resolves via shareLinks/{slug} */
  slug?: string;
  visibility?: CrosswordVisibility;
  difficulty?: CrosswordDifficulty;
}

export interface CrosswordAnswers {
  crosswordId: string;
  authorId: string;
  answers: string;
}

export interface BoardState {
  width: number;
  height: number;
  grid: GridCell[];
  clues: {
    across: Clue[];
    down: Clue[];
  };
}

export interface GridCell {
  x: number;
  y: number;
  isBlock: boolean;
  isHidden?: boolean;
  value: string;
  number: number | null;
}

export interface Clue {
  number: number;
  text: string;
  x: number;
  y: number;
  length: number;
}

export interface Progress {
  id?: string;
  userId: string;
  crosswordId: string;
  answers: string;
  timer: number;
  isCompleted: boolean;
  lastUpdated: number;
}
