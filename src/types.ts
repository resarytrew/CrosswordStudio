export interface Crossword {
  id?: string;
  authorId: string;
  title: string;
  boardState: string; // JSON string of BoardState
  createdAt: number;
  updatedAt: number;
  isPublished: boolean;
}

export interface BoardState {
  width: number;
  height: number;
  grid: GridCell[]; // width * height length
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
  value: string; // The correct letter
  number: number | null; // e.g., 1, 2, 3...
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
  answers: string; // JSON Record<string, string> mapping "x,y" to letter
  timer: number;
  isCompleted: boolean;
  lastUpdated: number;
}
