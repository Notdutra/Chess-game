import { GameState, MoveRecord, EnPassantStatus } from '../models/GameState';
import { Move, MoveResult } from '../models/Move';
import { PieceColor, PieceType, createPiece } from '../models/Piece';
import { Square } from '../models/Square';

const boardLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export class ChessEngine {
  private gameState: GameState;

  constructor(initialState?: GameState) {
    this.gameState = initialState || this.createInitialGameState();
  }

  getGameState(): GameState {
    // Return a deep copy to prevent external mutations
    return JSON.parse(JSON.stringify(this.gameState));
  }

  setGameState(newState: GameState): void {
    this.gameState = JSON.parse(JSON.stringify(newState));
  }

  createInitialGameState(): GameState {
    return {
      boardArray: [
        ['BR1', 'BN1', 'BB1', 'BQ', 'BK', 'BB2', 'BN2', 'BR2'],
        ['BP1', 'BP2', 'BP3', 'BP4', 'BP5', 'BP6', 'BP7', 'BP8'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['WP1', 'WP2', 'WP3', 'WP4', 'WP5', 'WP6', 'WP7', 'WP8'],
        ['WR1', 'WN1', 'WB1', 'WQ', 'WK', 'WB2', 'WN2', 'WR2'],
      ] as string[][],
      currentPlayer: 'white',
      selectedSquare: null,
      whiteKingInCheck: false,
      blackKingInCheck: false,
      checkmate: false,
      stalemate: false,
      winner: null,
      enPassantStatus: null,
      moveHistory: [],
      undoneMoves: [],
      highlightedSquares: [],
      validMoves: [],
      halfMoveCounter: 0,
      fullMoveCounter: 1,
      lastMoves: [],
      gameMode: 'ai', // Default to AI mode
    };
  }

  // Get piece at a given position
  getPieceAtPosition(position: string): string | null {
    const { file, rank } = this.squareFromNotation(position);
    if (file === -1 || rank === -1) return null;
    return this.gameState.boardArray[rank][file];
  }

  // Convert notation (e.g., "e4") to board coordinates
  squareFromNotation(notation: string): Square {
    if (notation.length !== 2) return { file: -1, rank: -1 };

    const file = notation.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(notation[1]);

    if (file < 0 || file > 7 || rank < 0 || rank > 7) {
      return { file: -1, rank: -1 };
    }

    return { file, rank };
  }

  // Convert board coordinates to notation (e.g., "e4")
  notationFromSquare(square: Square): string {
    if (
      square.file < 0 ||
      square.file > 7 ||
      square.rank < 0 ||
      square.rank > 7
    ) {
      return '';
    }

    const file = String.fromCharCode('a'.charCodeAt(0) + square.file);
    const rank = 8 - square.rank;

    return `${file}${rank}`;
  }

  // Get the color of a piece
  getPieceColor(piece: string | null): PieceColor | null {
    if (!piece) return null;
    return piece[0] === 'W' ? 'white' : 'black';
  }

  // Get the type of a piece
  getPieceType(piece: string | null): PieceType | null {
    if (!piece) return null;

    if (piece.includes('PromotedPawn')) {
      piece = piece.split('PromotedPawn')[0];
    }

    const typeMap: Record<string, PieceType> = {
      P: 'pawn',
      R: 'rook',
      N: 'knight',
      B: 'bishop',
      Q: 'queen',
      K: 'king',
    };

    return typeMap[piece[1]] || null;
  }

  // Handle a click on a square
  handleSquareClick(clickedSquare: string): GameState {
    if (this.gameState.checkmate || this.gameState.stalemate) {
      return this.gameState;
    }

    const piece = this.getPieceAtPosition(clickedSquare);
    const pieceColor = piece ? this.getPieceColor(piece) : null;

    // If clicked on own piece, select it
    if (
      piece &&
      pieceColor === this.gameState.currentPlayer &&
      clickedSquare !== this.gameState.selectedSquare
    ) {
      // Get valid moves for this piece
      const validMoves = this.getValidMoves(piece, clickedSquare);

      // Update game state with selection and valid moves
      this.gameState = {
        ...this.gameState,
        selectedSquare: clickedSquare,
        highlightedSquares: [clickedSquare],
        validMoves,
      };
    }
    // If a piece is already selected and clicked on a valid move destination
    else if (
      this.gameState.selectedSquare &&
      this.gameState.validMoves.includes(clickedSquare)
    ) {
      // Execute the move
      const moveResult = this.makeMove(
        this.gameState.selectedSquare,
        clickedSquare
      );
      if (moveResult && moveResult.isValid) {
        this.gameState = moveResult.newGameState;
      }
    }
    // Otherwise deselect
    else {
      this.gameState = {
        ...this.gameState,
        selectedSquare: null,
        highlightedSquares: [],
        validMoves: [],
      };
    }

    return this.gameState;
  }

  // Make a move
  makeMove(from: string, to: string): MoveResult {
    const piece = this.getPieceAtPosition(from);
    if (!piece) {
      return {
        newGameState: this.gameState,
        move: { from, to, piece: '' },
        isValid: false,
        moveType: 'normal',
      };
    }

    // Create a copy of the game state
    const newGameState = JSON.parse(JSON.stringify(this.gameState));

    // Record move details
    const move: Move = { from, to, piece };
    let moveType: 'normal' | 'capture' | 'castle' | 'promotion' | 'en-passant' =
      'normal';

    // Check if capturing
    const capturedPiece = this.getPieceAtPosition(to);
    if (capturedPiece) {
      move.capturedPiece = capturedPiece;
      moveType = 'capture';
    }

    // Get piece type before moving
    const pieceType = this.getPieceType(piece);

    // Update the board
    const fromSquare = this.squareFromNotation(from);
    const toSquare = this.squareFromNotation(to);
    newGameState.boardArray[toSquare.rank][toSquare.file] =
      newGameState.boardArray[fromSquare.rank][fromSquare.file];
    newGameState.boardArray[fromSquare.rank][fromSquare.file] = '';

    // Special moves handling
    // Castling
    if (pieceType === 'king') {
      const rankIndex = this.gameState.currentPlayer === 'white' ? 7 : 0;

      // Kingside castling
      if (
        from === (this.gameState.currentPlayer === 'white' ? 'e1' : 'e8') &&
        to === (this.gameState.currentPlayer === 'white' ? 'g1' : 'g8')
      ) {
        // Move the rook as well
        const rookFrom = this.gameState.currentPlayer === 'white' ? 'h1' : 'h8';
        const rookTo = this.gameState.currentPlayer === 'white' ? 'f1' : 'f8';
        const rookFromSquare = this.squareFromNotation(rookFrom);
        const rookToSquare = this.squareFromNotation(rookTo);

        // Move rook
        newGameState.boardArray[rookToSquare.rank][rookToSquare.file] =
          newGameState.boardArray[rookFromSquare.rank][rookFromSquare.file];
        newGameState.boardArray[rookFromSquare.rank][rookFromSquare.file] = '';

        moveType = 'castle';
      }

      // Queenside castling
      if (
        from === (this.gameState.currentPlayer === 'white' ? 'e1' : 'e8') &&
        to === (this.gameState.currentPlayer === 'white' ? 'c1' : 'c8')
      ) {
        // Move the rook as well
        const rookFrom = this.gameState.currentPlayer === 'white' ? 'a1' : 'a8';
        const rookTo = this.gameState.currentPlayer === 'white' ? 'd1' : 'd8';
        const rookFromSquare = this.squareFromNotation(rookFrom);
        const rookToSquare = this.squareFromNotation(rookTo);

        // Move rook
        newGameState.boardArray[rookToSquare.rank][rookToSquare.file] =
          newGameState.boardArray[rookFromSquare.rank][rookFromSquare.file];
        newGameState.boardArray[rookFromSquare.rank][rookFromSquare.file] = '';

        moveType = 'castle';
      }
    }

    // En passant capture
    if (
      pieceType === 'pawn' &&
      newGameState.enPassantStatus &&
      to === newGameState.enPassantStatus.square &&
      piece[0] === (this.gameState.currentPlayer === 'white' ? 'W' : 'B')
    ) {
      const captureRank =
        toSquare.rank + (this.gameState.currentPlayer === 'white' ? 1 : -1);
      newGameState.boardArray[captureRank][toSquare.file] = '';
      moveType = 'en-passant';
    }

    // Pawn promotion
    if (
      pieceType === 'pawn' &&
      ((this.gameState.currentPlayer === 'white' && toSquare.rank === 0) ||
        (this.gameState.currentPlayer === 'black' && toSquare.rank === 7))
    ) {
      // Default promotion to queen
      const prefix = this.gameState.currentPlayer === 'white' ? 'W' : 'B';
      newGameState.boardArray[toSquare.rank][
        toSquare.file
      ] = `${prefix}QPromotedPawn`;
      moveType = 'promotion';
    }

    // Set en passant status for next move
    if (
      pieceType === 'pawn' &&
      Math.abs(fromSquare.rank - toSquare.rank) === 2
    ) {
      const passantRank = (fromSquare.rank + toSquare.rank) / 2;
      const passantSquare = this.notationFromSquare({
        rank: passantRank,
        file: fromSquare.file,
      });

      newGameState.enPassantStatus = {
        square: passantSquare,
        pawn: piece,
      };
    } else {
      newGameState.enPassantStatus = null;
    }

    // Update game state
    newGameState.selectedSquare = null;
    newGameState.highlightedSquares = [];
    newGameState.validMoves = [];
    newGameState.lastMoves = [from, to];
    newGameState.currentPlayer =
      this.gameState.currentPlayer === 'white' ? 'black' : 'white';

    // Add to move history
    newGameState.moveHistory.push({
      boardArray: JSON.parse(JSON.stringify(this.gameState.boardArray)),
      currentPlayer: this.gameState.currentPlayer,
      selectedPiece: piece,
      origin: from,
      destination: to,
      capturedPiece: capturedPiece || undefined,
      moveType: moveType,
      whiteKingInCheck: this.gameState.whiteKingInCheck,
      blackKingInCheck: this.gameState.blackKingInCheck,
      winner: this.gameState.winner,
    });

    // Update counters
    if (this.gameState.currentPlayer === 'black') {
      newGameState.fullMoveCounter++;
    }

    // Clear undone moves since we've made a new move
    newGameState.undoneMoves = [];

    // Update halfmove clock (reset after pawn move, capture, en-passant, or promotion)
    if (
      pieceType === 'pawn' ||
      moveType === 'capture' ||
      moveType === 'en-passant' ||
      moveType === 'promotion'
    ) {
      newGameState.halfMoveCounter = 0;
    } else {
      newGameState.halfMoveCounter++;
    }

    // Check for check, checkmate, stalemate
    this.updateGameStatus(newGameState);

    return {
      newGameState,
      move,
      isValid: true,
      moveType,
    };
  }

  // Get valid moves for a piece
  getValidMoves(piece: string, position: string): string[] {
    const pieceType = this.getPieceType(piece);
    const pieceColor = this.getPieceColor(piece);

    if (!pieceType || !pieceColor) return [];

    let moves: string[] = [];

    // Based on piece type, get potential moves
    switch (pieceType) {
      case 'pawn':
        moves = this.getPawnMoves(position, pieceColor);
        break;
      case 'knight':
        moves = this.getKnightMoves(position, pieceColor);
        break;
      case 'bishop':
        moves = this.getBishopMoves(position, pieceColor);
        break;
      case 'rook':
        moves = this.getRookMoves(position, pieceColor);
        break;
      case 'queen':
        moves = this.getQueenMoves(position, pieceColor);
        break;
      case 'king':
        moves = this.getKingMoves(position, pieceColor);
        break;
    }

    // Filter out moves that would put king in check
    return moves.filter((move) => this.isMoveSafe(piece, position, move));
  }

  // Get available moves (no full validation, just basic piece movement rules)
  getAvailableMoves(piece: string, position: string): string[] {
    const pieceType = this.getPieceType(piece);
    const pieceColor = this.getPieceColor(piece);

    if (!pieceType || !pieceColor) return [];

    // Based on piece type, get potential moves (no validation)
    switch (pieceType) {
      case 'pawn':
        return this.getPawnMoves(position, pieceColor);
      case 'knight':
        return this.getKnightMoves(position, pieceColor);
      case 'bishop':
        return this.getBishopMoves(position, pieceColor);
      case 'rook':
        return this.getRookMoves(position, pieceColor);
      case 'queen':
        return this.getQueenMoves(position, pieceColor);
      case 'king':
        return this.getKingMoves(position, pieceColor);
      default:
        return [];
    }
  }

  // Premove moves: wide, pseudo-legal options ignoring checks/pins
  getPremoveMoves(piece: string, position: string): string[] {
    const pieceType = this.getPieceType(piece);
    const pieceColor = this.getPieceColor(piece);
    if (!pieceType || !pieceColor) return [];

    switch (pieceType) {
      case 'pawn':
        return this.getPawnPremoveTargets(position, pieceColor);
      case 'knight':
        return this.getKnightPremoveTargets(position);
      case 'bishop':
        return this.getSlidingPremoveTargets(position, [
          { dr: 1, df: 1 },
          { dr: 1, df: -1 },
          { dr: -1, df: 1 },
          { dr: -1, df: -1 },
        ]);
      case 'rook':
        return this.getSlidingPremoveTargets(position, [
          { dr: 1, df: 0 },
          { dr: -1, df: 0 },
          { dr: 0, df: 1 },
          { dr: 0, df: -1 },
        ]);
      case 'queen':
        return this.getSlidingPremoveTargets(position, [
          { dr: 1, df: 1 },
          { dr: 1, df: -1 },
          { dr: -1, df: 1 },
          { dr: -1, df: -1 },
          { dr: 1, df: 0 },
          { dr: -1, df: 0 },
          { dr: 0, df: 1 },
          { dr: 0, df: -1 },
        ]);
      case 'king':
        return this.getKingPremoveTargets(position);
      default:
        return [];
    }
  }

  // Pawns: always allow forward and both diagonals (ignore occupation)
  private getPawnPremoveTargets(position: string, color: PieceColor): string[] {
    const { rank, file } = this.squareFromNotation(position);
    const dir = color === 'white' ? -1 : 1;
    const moves: string[] = [];
    // One forward
    if (rank + dir >= 0 && rank + dir < 8) {
      moves.push(this.notationFromSquare({ rank: rank + dir, file }));
      // Two forward from starting rank
      const startingRank = color === 'white' ? 6 : 1;
      if (rank === startingRank && rank + 2 * dir >= 0 && rank + 2 * dir < 8) {
        moves.push(this.notationFromSquare({ rank: rank + 2 * dir, file }));
      }
      // Diagonals
      if (file - 1 >= 0)
        moves.push(
          this.notationFromSquare({ rank: rank + dir, file: file - 1 })
        );
      if (file + 1 < 8)
        moves.push(
          this.notationFromSquare({ rank: rank + dir, file: file + 1 })
        );
    }
    return moves;
  }

  // Knights: all L-shaped moves (ignore occupation)
  private getKnightPremoveTargets(position: string): string[] {
    const { rank, file } = this.squareFromNotation(position);
    const moves: string[] = [];
    const offsets = [
      { dr: -2, df: -1 },
      { dr: -2, df: 1 },
      { dr: -1, df: -2 },
      { dr: -1, df: 2 },
      { dr: 1, df: -2 },
      { dr: 1, df: 2 },
      { dr: 2, df: -1 },
      { dr: 2, df: 1 },
    ];
    for (const { dr, df } of offsets) {
      const r = rank + dr,
        f = file + df;
      if (r >= 0 && r < 8 && f >= 0 && f < 8) {
        moves.push(this.notationFromSquare({ rank: r, file: f }));
      }
    }
    return moves;
  }

  // Sliding pieces: all squares in each direction (ignore occupation)
  private getSlidingPremoveTargets(
    position: string,
    directions: { dr: number; df: number }[]
  ): string[] {
    const square = this.squareFromNotation(position);
    const moves: string[] = [];

    for (const { dr, df } of directions) {
      let r = square.rank + dr;
      let f = square.file + df;

      while (r >= 0 && r < 8 && f >= 0 && f < 8) {
        moves.push(this.notationFromSquare({ rank: r, file: f }));
        r += dr;
        f += df;
      }
    }

    return moves;
  }

  // Get all potential king moves for premoves (including castling)
  private getKingPremoveTargets(position: string): string[] {
    const square = this.squareFromNotation(position);
    const moves: string[] = [];
    const kingOffsets = [
      { dr: -1, df: -1 },
      { dr: -1, df: 0 },
      { dr: -1, df: 1 },
      { dr: 0, df: -1 },
      { dr: 0, df: 1 },
      { dr: 1, df: -1 },
      { dr: 1, df: 0 },
      { dr: 1, df: 1 },
    ];

    // Regular king moves
    for (const { dr, df } of kingOffsets) {
      const r = square.rank + dr;
      const f = square.file + df;

      if (r >= 0 && r < 8 && f >= 0 && f < 8) {
        moves.push(this.notationFromSquare({ rank: r, file: f }));
      }
    }

    // Add castling targets (kingside and queenside)
    // For premoves, we'll add them without checking current game state
    if (square.file === 4 && (square.rank === 0 || square.rank === 7)) {
      moves.push(this.notationFromSquare({ rank: square.rank, file: 6 })); // Kingside
      moves.push(this.notationFromSquare({ rank: square.rank, file: 2 })); // Queenside
    }

    return moves;
  }

  // Check if a move is safe (doesn't put own king in check)
  isMoveSafe(piece: string, from: string, to: string): boolean {
    // Create a temporary game state with the move applied
    const tempGameState = JSON.parse(JSON.stringify(this.gameState));
    const fromSquare = this.squareFromNotation(from);
    const toSquare = this.squareFromNotation(to);

    // Apply the move
    tempGameState.boardArray[toSquare.rank][toSquare.file] =
      tempGameState.boardArray[fromSquare.rank][fromSquare.file];
    tempGameState.boardArray[fromSquare.rank][fromSquare.file] = '';

    // Check if king is in check after this move
    const pieceColor = this.getPieceColor(piece);
    const kingPosition = this.findKingPosition(
      tempGameState,
      pieceColor || 'white'
    );

    return !this.isSquareAttacked(
      kingPosition,
      pieceColor === 'white' ? 'black' : 'white',
      tempGameState
    );
  }

  // Find king's position
  findKingPosition(state: GameState, color: PieceColor): string {
    const kingId = color === 'white' ? 'WK' : 'BK';

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = state.boardArray[rank][file];
        if (piece && piece.startsWith(kingId)) {
          return this.notationFromSquare({ rank, file });
        }
      }
    }

    return ''; // Should never happen in a valid game state
  }

  // Check if a square is attacked by any enemy piece
  isSquareAttacked(
    position: string,
    attackingColor: PieceColor,
    state = this.gameState
  ): boolean {
    const targetSquare = this.squareFromNotation(position);
    if (targetSquare.file === -1 || targetSquare.rank === -1) return false;

    // Check knight attacks
    const knightOffsets = [
      { rank: -2, file: -1 },
      { rank: -2, file: 1 },
      { rank: -1, file: -2 },
      { rank: -1, file: 2 },
      { rank: 1, file: -2 },
      { rank: 1, file: 2 },
      { rank: 2, file: -1 },
      { rank: 2, file: 1 },
    ];

    for (const offset of knightOffsets) {
      const rank = targetSquare.rank + offset.rank;
      const file = targetSquare.file + offset.file;

      if (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
        const piece = state.boardArray[rank][file];

        if (
          piece &&
          this.getPieceColor(piece) === attackingColor &&
          this.getPieceType(piece) === 'knight'
        ) {
          return true;
        }
      }
    }

    // Check pawn attacks
    const pawnDirection = attackingColor === 'white' ? -1 : 1;
    const pawnOffsets = [
      { rank: pawnDirection, file: -1 },
      { rank: pawnDirection, file: 1 },
    ];

    for (const offset of pawnOffsets) {
      const rank = targetSquare.rank + offset.rank;
      const file = targetSquare.file + offset.file;

      if (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
        const piece = state.boardArray[rank][file];

        if (
          piece &&
          this.getPieceColor(piece) === attackingColor &&
          this.getPieceType(piece) === 'pawn'
        ) {
          return true;
        }
      }
    }

    // Check king attacks (for adjacent squares)
    const kingOffsets = [
      { rank: -1, file: -1 },
      { rank: -1, file: 0 },
      { rank: -1, file: 1 },
      { rank: 0, file: -1 },
      { rank: 0, file: 1 },
      { rank: 1, file: -1 },
      { rank: 1, file: 0 },
      { rank: 1, file: 1 },
    ];

    for (const offset of kingOffsets) {
      const rank = targetSquare.rank + offset.rank;
      const file = targetSquare.file + offset.file;

      if (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
        const piece = state.boardArray[rank][file];

        if (
          piece &&
          this.getPieceColor(piece) === attackingColor &&
          this.getPieceType(piece) === 'king'
        ) {
          return true;
        }
      }
    }

    // Check attacks from sliding pieces (queen, rook, bishop)
    const slidingPieceDirections = [
      { rankDir: -1, fileDir: 0, pieces: ['rook', 'queen'] }, // up
      { rankDir: 1, fileDir: 0, pieces: ['rook', 'queen'] }, // down
      { rankDir: 0, fileDir: -1, pieces: ['rook', 'queen'] }, // left
      { rankDir: 0, fileDir: 1, pieces: ['rook', 'queen'] }, // right
      { rankDir: -1, fileDir: -1, pieces: ['bishop', 'queen'] }, // up-left
      { rankDir: -1, fileDir: 1, pieces: ['bishop', 'queen'] }, // up-right
      { rankDir: 1, fileDir: -1, pieces: ['bishop', 'queen'] }, // down-left
      { rankDir: 1, fileDir: 1, pieces: ['bishop', 'queen'] }, // down-right
    ];

    for (const dir of slidingPieceDirections) {
      let rank = targetSquare.rank + dir.rankDir;
      let file = targetSquare.file + dir.fileDir;

      while (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
        const piece = state.boardArray[rank][file];

        if (piece) {
          const pieceType = this.getPieceType(piece);
          const pieceColor = this.getPieceColor(piece);

          // Check if this piece can attack along this direction
          if (
            pieceColor === attackingColor &&
            dir.pieces.includes(pieceType || '')
          ) {
            return true;
          }

          // If we hit any piece, we can't look further in this direction
          break;
        }

        rank += dir.rankDir;
        file += dir.fileDir;
      }
    }

    // No attacks found
    return false;
  }

  // Update game status (check, checkmate, stalemate)
  updateGameStatus(state: GameState): void {
    // Check if current player is in check
    const currentKingPosition = this.findKingPosition(
      state,
      state.currentPlayer
    );

    const isInCheck = this.isSquareAttacked(
      currentKingPosition,
      state.currentPlayer === 'white' ? 'black' : 'white',
      state
    );

    // Check if either side is in check
    const whiteKingPosition = this.findKingPosition(state, 'white');
    const blackKingPosition = this.findKingPosition(state, 'black');

    state.whiteKingInCheck = this.isSquareAttacked(
      whiteKingPosition,
      'black',
      state
    );
    state.blackKingInCheck = this.isSquareAttacked(
      blackKingPosition,
      'white',
      state
    );

    // Check for checkmate or stalemate
    // This requires checking if any legal moves are available for any piece
    const hasLegalMoves = this.hasAnyLegalMoves(state, state.currentPlayer);

    if (!hasLegalMoves) {
      if (isInCheck) {
        // Checkmate - king is in check and no legal moves
        state.checkmate = true;
        state.winner = state.currentPlayer === 'white' ? 'black' : 'white';
      } else {
        // Stalemate - not in check but no legal moves
        state.stalemate = true;
      }
    } else {
      state.checkmate = false;
      state.stalemate = false;
    }
  }

  // Check if the current player has any legal moves
  hasAnyLegalMoves(state: GameState, color: PieceColor): boolean {
    // Create temporary engine to evaluate possible moves
    const tempEngine = new ChessEngine(JSON.parse(JSON.stringify(state)));

    // Scan the board for pieces of the current player
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = state.boardArray[rank][file];

        if (piece && this.getPieceColor(piece) === color) {
          const position = this.notationFromSquare({ rank, file });
          const pieceType = this.getPieceType(piece);

          // Get all potential moves for this piece
          let potentialMoves: string[] = [];

          switch (pieceType) {
            case 'pawn':
              potentialMoves = tempEngine.getPawnMoves(position, color);
              break;
            case 'knight':
              potentialMoves = tempEngine.getKnightMoves(position, color);
              break;
            case 'bishop':
              potentialMoves = tempEngine.getBishopMoves(position, color);
              break;
            case 'rook':
              potentialMoves = tempEngine.getRookMoves(position, color);
              break;
            case 'queen':
              potentialMoves = tempEngine.getQueenMoves(position, color);
              break;
            case 'king':
              potentialMoves = tempEngine.getKingMoves(position, color);
              break;
          }

          // Filter to only include legal moves that don't leave king in check
          for (const move of potentialMoves) {
            if (tempEngine.isMoveSafe(piece, position, move)) {
              return true; // Found at least one legal move
            }
          }
        }
      }
    }

    // No legal moves found
    return false;
  }

  // Individual piece move generators
  getPawnMoves(position: string, color: PieceColor): string[] {
    const square = this.squareFromNotation(position);
    if (square.file === -1 || square.rank === -1) return [];

    const moves: string[] = [];
    const direction = color === 'white' ? -1 : 1;
    const startingRank = color === 'white' ? 6 : 1;

    // Forward move (1 square)
    const oneSquareForward = {
      rank: square.rank + direction,
      file: square.file,
    };

    if (
      oneSquareForward.rank >= 0 &&
      oneSquareForward.rank < 8 &&
      !this.gameState.boardArray[oneSquareForward.rank][oneSquareForward.file]
    ) {
      moves.push(this.notationFromSquare(oneSquareForward));

      // Two squares forward (from starting position)
      if (square.rank === startingRank) {
        const twoSquaresForward = {
          rank: square.rank + 2 * direction,
          file: square.file,
        };

        if (
          !this.gameState.boardArray[twoSquaresForward.rank][
            twoSquaresForward.file
          ]
        ) {
          moves.push(this.notationFromSquare(twoSquaresForward));
        }
      }
    }

    // Captures (diagonally)
    const captureSquares = [
      { rank: square.rank + direction, file: square.file - 1 },
      { rank: square.rank + direction, file: square.file + 1 },
    ];

    for (const captureSquare of captureSquares) {
      if (
        captureSquare.rank >= 0 &&
        captureSquare.rank < 8 &&
        captureSquare.file >= 0 &&
        captureSquare.file < 8
      ) {
        const pieceOnSquare =
          this.gameState.boardArray[captureSquare.rank][captureSquare.file];

        // Regular capture
        if (pieceOnSquare) {
          const pieceColor = this.getPieceColor(pieceOnSquare);

          if (pieceColor !== color) {
            moves.push(this.notationFromSquare(captureSquare));
          }
        }
        // En passant capture
        else if (this.gameState.enPassantStatus) {
          const enPassantSquare = this.squareFromNotation(
            this.gameState.enPassantStatus.square
          );

          if (
            enPassantSquare.rank === captureSquare.rank &&
            enPassantSquare.file === captureSquare.file
          ) {
            moves.push(this.notationFromSquare(captureSquare));
          }
        }
      }
    }

    return moves;
  }

  getKnightMoves(position: string, color: PieceColor): string[] {
    const square = this.squareFromNotation(position);
    if (square.file === -1 || square.rank === -1) return [];

    const moves: string[] = [];
    const knightOffsets = [
      { rank: -2, file: -1 },
      { rank: -2, file: 1 },
      { rank: -1, file: -2 },
      { rank: -1, file: 2 },
      { rank: 1, file: -2 },
      { rank: 1, file: 2 },
      { rank: 2, file: -1 },
      { rank: 2, file: 1 },
    ];

    for (const offset of knightOffsets) {
      const targetRank = square.rank + offset.rank;
      const targetFile = square.file + offset.file;

      // Check if target square is on the board
      if (
        targetRank >= 0 &&
        targetRank < 8 &&
        targetFile >= 0 &&
        targetFile < 8
      ) {
        const pieceOnSquare = this.gameState.boardArray[targetRank][targetFile];

        // Square is empty or has opponent's piece
        if (!pieceOnSquare || this.getPieceColor(pieceOnSquare) !== color) {
          moves.push(
            this.notationFromSquare({ rank: targetRank, file: targetFile })
          );
        }
      }
    }

    return moves;
  }

  getBishopMoves(position: string, color: PieceColor): string[] {
    const square = this.squareFromNotation(position);
    if (square.file === -1 || square.rank === -1) return [];

    // Bishop moves along diagonals
    const directions = [
      { rankDir: -1, fileDir: -1 }, // top-left
      { rankDir: -1, fileDir: 1 }, // top-right
      { rankDir: 1, fileDir: -1 }, // bottom-left
      { rankDir: 1, fileDir: 1 }, // bottom-right
    ];

    return this.getSlidingPieceMoves(square, color, directions);
  }

  getRookMoves(position: string, color: PieceColor): string[] {
    const square = this.squareFromNotation(position);
    if (square.file === -1 || square.rank === -1) return [];

    // Rook moves along ranks and files
    const directions = [
      { rankDir: -1, fileDir: 0 }, // up
      { rankDir: 1, fileDir: 0 }, // down
      { rankDir: 0, fileDir: -1 }, // left
      { rankDir: 0, fileDir: 1 }, // right
    ];

    return this.getSlidingPieceMoves(square, color, directions);
  }

  getQueenMoves(position: string, color: PieceColor): string[] {
    const square = this.squareFromNotation(position);
    if (square.file === -1 || square.rank === -1) return [];

    // Queen moves in all directions (combination of rook and bishop)
    const directions = [
      { rankDir: -1, fileDir: 0 }, // up
      { rankDir: 1, fileDir: 0 }, // down
      { rankDir: 0, fileDir: -1 }, // left
      { rankDir: 0, fileDir: 1 }, // right
      { rankDir: -1, fileDir: -1 }, // top-left
      { rankDir: -1, fileDir: 1 }, // top-right
      { rankDir: 1, fileDir: -1 }, // bottom-left
      { rankDir: 1, fileDir: 1 }, // bottom-right
    ];

    return this.getSlidingPieceMoves(square, color, directions);
  }

  // Helper method for sliding pieces (bishop, rook, queen)
  private getSlidingPieceMoves(
    square: Square,
    color: PieceColor,
    directions: { rankDir: number; fileDir: number }[]
  ): string[] {
    const moves: string[] = [];

    for (const dir of directions) {
      let currentRank = square.rank + dir.rankDir;
      let currentFile = square.file + dir.fileDir;

      // Continue in this direction until we hit a piece or the edge of the board
      while (
        currentRank >= 0 &&
        currentRank < 8 &&
        currentFile >= 0 &&
        currentFile < 8
      ) {
        const pieceOnSquare =
          this.gameState.boardArray[currentRank][currentFile];

        if (!pieceOnSquare) {
          // Empty square, add as valid move
          moves.push(
            this.notationFromSquare({ rank: currentRank, file: currentFile })
          );
        } else {
          // Square has a piece
          const pieceColor = this.getPieceColor(pieceOnSquare);

          // If it's an opponent's piece, we can capture it (add as valid move)
          if (pieceColor !== color) {
            moves.push(
              this.notationFromSquare({ rank: currentRank, file: currentFile })
            );
          }

          // Either way, we can't move further in this direction
          break;
        }

        // Move to the next square in this direction
        currentRank += dir.rankDir;
        currentFile += dir.fileDir;
      }
    }

    return moves;
  }

  getKingMoves(position: string, color: PieceColor): string[] {
    const square = this.squareFromNotation(position);
    if (square.file === -1 || square.rank === -1) return [];

    const moves: string[] = [];
    const kingOffsets = [
      { rank: -1, file: -1 }, // top-left
      { rank: -1, file: 0 }, // top
      { rank: -1, file: 1 }, // top-right
      { rank: 0, file: -1 }, // left
      { rank: 0, file: 1 }, // right
      { rank: 1, file: -1 }, // bottom-left
      { rank: 1, file: 0 }, // bottom
      { rank: 1, file: 1 }, // bottom-right
    ];

    // Regular king moves
    for (const offset of kingOffsets) {
      const targetRank = square.rank + offset.rank;
      const targetFile = square.file + offset.file;

      // Check if target square is on the board
      if (
        targetRank >= 0 &&
        targetRank < 8 &&
        targetFile >= 0 &&
        targetFile < 8
      ) {
        const pieceOnSquare = this.gameState.boardArray[targetRank][targetFile];

        // Square is empty or has opponent's piece
        if (!pieceOnSquare || this.getPieceColor(pieceOnSquare) !== color) {
          const targetSquare = this.notationFromSquare({
            rank: targetRank,
            file: targetFile,
          });

          // Check if the king would be in check on this square
          if (
            !this.isSquareAttacked(
              targetSquare,
              color === 'white' ? 'black' : 'white'
            )
          ) {
            moves.push(targetSquare);
          }
        }
      }
    }

    // Check for castling
    if (!this.isKingInCheck(color)) {
      // Kingside castling
      const kingsideMoves = this.getCastlingMoves(position, color, 'kingside');
      moves.push(...kingsideMoves);

      // Queenside castling
      const queensideMoves = this.getCastlingMoves(
        position,
        color,
        'queenside'
      );
      moves.push(...queensideMoves);
    }

    return moves;
  }

  // Helper method for castling
  private getCastlingMoves(
    kingPosition: string,
    color: PieceColor,
    side: 'kingside' | 'queenside'
  ): string[] {
    // Check if the king has moved before
    if (this.hasPieceMoved(kingPosition)) {
      return [];
    }

    const rank = color === 'white' ? 7 : 0;
    const kingFile = 4; // King starts at e1/e8

    const rookFile = side === 'kingside' ? 7 : 0;
    const rookPosition = this.notationFromSquare({ rank, file: rookFile });

    // Check if the rook has moved before
    if (this.hasPieceMoved(rookPosition)) {
      return [];
    }

    // Check if squares between king and rook are empty
    const emptySquareFiles = side === 'kingside' ? [5, 6] : [1, 2, 3];

    for (const file of emptySquareFiles) {
      if (this.gameState.boardArray[rank][file]) {
        return [];
      }
    }

    // Check if squares the king moves through are attacked
    const kingTraversalFiles = side === 'kingside' ? [4, 5, 6] : [2, 3, 4];
    const opposingColor = color === 'white' ? 'black' : 'white';

    for (const file of kingTraversalFiles) {
      const square = this.notationFromSquare({ rank, file });

      if (this.isSquareAttacked(square, opposingColor)) {
        return [];
      }
    }

    // Castling is valid, return the target square for the king
    const targetFile = side === 'kingside' ? 6 : 2;
    return [this.notationFromSquare({ rank, file: targetFile })];
  }

  // Check if a piece has moved before (used for castling)
  private hasPieceMoved(position: string): boolean {
    // Check move history to see if this piece was ever moved
    return this.gameState.moveHistory.some(
      (move) => move.origin === position || move.destination === position
    );
  }

  // Check if the king of a specific color is in check
  isKingInCheck(color: PieceColor): boolean {
    const kingPosition = this.findKingPosition(this.gameState, color);
    const opposingColor = color === 'white' ? 'black' : 'white';

    return this.isSquareAttacked(kingPosition, opposingColor);
  }

  // Undo the last move
  undoMove(): GameState {
    if (this.gameState.moveHistory.length === 0) {
      return this.gameState;
    }

    const lastMove = this.gameState.moveHistory.pop();
    if (!lastMove) return this.gameState;

    // Add to undone moves stack
    this.gameState.undoneMoves.push(lastMove);

    // Restore the previous state
    this.gameState.boardArray = JSON.parse(JSON.stringify(lastMove.boardArray));
    this.gameState.currentPlayer = lastMove.currentPlayer;
    this.gameState.whiteKingInCheck = lastMove.whiteKingInCheck;
    this.gameState.blackKingInCheck = lastMove.blackKingInCheck;
    this.gameState.winner = lastMove.winner;
    this.gameState.selectedSquare = null;
    this.gameState.highlightedSquares = [];
    this.gameState.validMoves = [];

    return this.gameState;
  }

  // Redo a previously undone move
  redoMove(): GameState {
    if (this.gameState.undoneMoves.length === 0) {
      return this.gameState;
    }

    const moveToRedo = this.gameState.undoneMoves.pop();
    if (!moveToRedo) return this.gameState;

    // Execute the move again
    const from = moveToRedo.origin;
    const to = moveToRedo.destination;
    const result = this.makeMove(from, to);

    return result.isValid ? result.newGameState : this.gameState;
  }

  // Convert board to FEN notation for external engine compatibility
  convertBoardArrayToFEN(): string {
    let fen = '';

    // 1. Board position
    for (let rank = 0; rank < 8; rank++) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        const piece = this.gameState.boardArray[rank][file];
        if (!piece) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount.toString();
            emptyCount = 0;
          }
          let fenChar = '';
          const pieceType = this.getPieceType(piece);
          const pieceColor = this.getPieceColor(piece);
          switch (pieceType) {
            case 'pawn':
              fenChar = 'p';
              break;
            case 'knight':
              fenChar = 'n';
              break;
            case 'bishop':
              fenChar = 'b';
              break;
            case 'rook':
              fenChar = 'r';
              break;
            case 'queen':
              fenChar = 'q';
              break;
            case 'king':
              fenChar = 'k';
              break;
          }
          fen += pieceColor === 'white' ? fenChar.toUpperCase() : fenChar;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount.toString();
      }
      if (rank < 7) {
        fen += '/';
      }
    }

    // Active color
    fen += ' ' + (this.gameState.currentPlayer === 'white' ? 'w' : 'b');

    // Castling rights
    let castlingRights = '';
    // White king/rook
    const whiteKing = this.gameState.boardArray[7][4] === 'WK';
    const whiteRook1 = this.gameState.boardArray[7][0] === 'WR1';
    const whiteRook2 = this.gameState.boardArray[7][7] === 'WR2';
    // Black king/rook
    const blackKing = this.gameState.boardArray[0][4] === 'BK';
    const blackRook1 = this.gameState.boardArray[0][0] === 'BR1';
    const blackRook2 = this.gameState.boardArray[0][7] === 'BR2';
    if (whiteKing && whiteRook2) castlingRights += 'K';
    if (whiteKing && whiteRook1) castlingRights += 'Q';
    if (blackKing && blackRook2) castlingRights += 'k';
    if (blackKing && blackRook1) castlingRights += 'q';
    if (!castlingRights) castlingRights = '-';
    fen += ' ' + castlingRights;

    // En passant - disabled for chess API compatibility
    // The chess API we're using doesn't accept standard FEN en passant notation
    let enPassantSquare = '-';
    // if (this.gameState.enPassantStatus?.square) {
    //   enPassantSquare = this.gameState.enPassantStatus.square;
    // }
    fen += ' ' + enPassantSquare;

    // Halfmove clock
    fen += ' ' + (this.gameState.halfMoveCounter ?? 0);

    // Fullmove number
    fen += ' ' + (this.gameState.fullMoveCounter ?? 1);

    return fen;
  }
}

export const ChessEngineInstance = new ChessEngine();
