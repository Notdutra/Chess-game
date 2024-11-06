import js from "@eslint/js";

const boardLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

let squareLetter;
let squareNumber;
let player;

var whiteKingInCheck;
var blackKingInCheck;
var checkmate;
var stalemate;
var winner;

const directionLetterBy = (direction, num) => {
    const index = boardLetters.indexOf(squareLetter) + direction * num;
    return boardLetters[index] || null;
};

const directionNumberBy = (direction, num) => {
    const newNumber = squareNumber + direction * num;
    return newNumber >= 1 && newNumber <= 8 ? newNumber : null;
};

export function createStartingPositionBoardArray() {
    return [
        ['BR1', 'BN1', 'BB1', 'BQ', 'BK', 'BB2', 'BN2', 'BR2'],
        ['BP1', 'BP2', 'BP3', 'BP4', 'BP5', 'BP6', 'BP7', 'BP8'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['WP1', 'WP2', 'WP3', 'WP4', 'WP5', 'WP6', 'WP7', 'WP8'],
        ['WR1', 'WN1', 'WB1', 'WQ', 'WK', 'WB2', 'WN2', 'WR2']
    ];
}

let possibleMoves = [];
let logOfMoves = [];

export function handleSquareClick(clickedSquare, gameState) {

    if (checkmate) {
        endGame(checkmate);
        return;
    } else if (stalemate) {
        endGame('stalemate');
        return;
    }

    const { selectedSquare, currentPlayer, boardArray, setSelectedSquare, setBoardArray, setCurrentPlayer, setHighlightedSquares } = gameState;
    const piece = squareHasPiece(clickedSquare, boardArray);
    const pieceColor = piece ? getPieceColor(piece) : null;
    player = currentPlayer;

    if (piece && pieceColor === currentPlayer && selectedSquare !== clickedSquare) {
        hideLegalMovesSquares();
        setSelectedSquare(clickedSquare);
        possibleMoves = getPossibleMoves(piece, clickedSquare, boardArray);
        let safeMoves = possibleMoves.filter(move => isMoveSafe(boardArray, clickedSquare, move));
        const pieceInfo = getAllPieceInfo(gameState.boardArray);
        const isCheck = isBoardInCheck(pieceInfo, boardArray);
        let isCheckmate = checkmateCheck(pieceInfo, boardArray);

        if (stalemate) {
            console.log('Game Over - Stalemate');
        }
        if (isCheckmate) {
            console.log(`Game Over - Checkmate player ${player} won`);
            return;
        } else if (isCheck) {
            console.log('Check');
        } else if (possibleMoves.length === 0) {
            console.log('Piece is blocked')
            setSelectedSquare(null);
            return;
        } else if (safeMoves.length === 0) {
            setSelectedSquare(null);
            return;
        }

        showLegalMovesSquares(safeMoves, boardArray);
        return;

    } else if (selectedSquare && possibleMoves != [] && possibleMoves.includes(clickedSquare)) {
        const preMoveBoard = movePiece(boardArray, selectedSquare, clickedSquare);
        const pieceInfo = getAllPieceInfo(preMoveBoard);
        const isCheck = isBoardInCheck(pieceInfo, boardArray);

        if (isCheck) {
            setSelectedSquare(null);
            hideLegalMovesSquares();
        } else {
            setBoardArray(preMoveBoard);
            logOfMoves.push({ from: selectedSquare, to: clickedSquare });

            let check = isBoardInCheckNow(pieceInfo);
            if (check) {
                console.log('now check if checkmate');
            }

            setSelectedSquare(null);
            let isCheckmate = checkmateCheck(pieceInfo, boardArray);
            if (isCheckmate) {
                console.log(`Game Over - Checkmate player ${player} won`);
                return;
            }
            hideLegalMovesSquares();
            setCurrentPlayer(changeCurrentPlayer(currentPlayer));
            possibleMoves = [];
        }

    } else {
        setSelectedSquare(null);
        hideLegalMovesSquares();
        possibleMoves = [];
    }
}

function endGame(type) {
    if (type === 'checkmate') {
        console.log(`Game Over - Checkmate player ${winner} won`);
    } else if (type === 'stalemate') {
        console.log('Game Over - Stalemate');
    }
}

// Helper function to simulate a move and check if the king is in check
function isMoveSafe(boardArray, from, to) {
    // Create a deep copy of the board
    const newBoardArray = boardArray.map(row => row.slice());

    // Simulate the move
    const [startColumn, startRow] = from.split('');
    const [endColumn, endRow] = to.split('');
    const startRowIndex = 8 - parseInt(startRow);
    const startColumnIndex = startColumn.charCodeAt(0) - 97;
    const endRowIndex = 8 - parseInt(endRow);
    const endColumnIndex = endColumn.charCodeAt(0) - 97;

    const piece = newBoardArray[startRowIndex][startColumnIndex];
    newBoardArray[startRowIndex][startColumnIndex] = '';
    newBoardArray[endRowIndex][endColumnIndex] = piece;

    // Get all piece info after the move
    const pieceInfo = getAllPieceInfo(newBoardArray);

    let isCheck = isBoardInCheck(pieceInfo, newBoardArray);
    // Check if the king is in check

    // console.log(`piece ${piece}`)
    return !isCheck;
}

function getValidMoves(piece, position, boardArray) {
    const possibleMoves = getPossibleMoves(piece, position, boardArray);
    return possibleMoves.filter(move => isMoveSafe(boardArray, position, move));

}

function checkmateCheck(pieceInfo, boardArray) {
    if (checkmate) return true;

    let totalSafeMoves = [];

    pieceInfo.forEach(info => {
        if (getPieceColor(info.piece) === player) {
            let safeMoves = getValidMoves(info.piece, info.position, boardArray);
            safeMoves.length !== 0 && totalSafeMoves.push(...safeMoves)
        }
    });


    if (totalSafeMoves.length === 0) {
        if (whiteKingInCheck) {
            winner = 'black';
            checkmate = true;
            return true;
        } else if (blackKingInCheck) {
            winner = 'white';
            checkmate = true;
            return true;
        } else {
            stalemate = true;
        }
    }

    return false
}

export function getPossibleMoves(piece, position, boardArray) {
    squareLetter = position[0];
    squareNumber = parseInt(position[1]);
    let moves = [];

    const pieceType = getPieceType(piece)
    const pieceColor = getPieceColor(piece)

    switch (pieceType) {
        case 'pawn':
            moves = pawnMoves(piece, position, boardArray);
            break;
        case 'rook':
            moves = rookMoves(position, pieceColor, boardArray);
            break;
        case 'knight':
            moves = knightMoves(position, pieceColor, boardArray);
            break;
        case 'bishop':
            moves = bishopMoves(position, pieceColor, boardArray);
            break;
        case 'queen':
            moves = queenMoves(position, pieceColor, boardArray);
            break;
        case 'king':
            moves = kingMoves(position, pieceColor, boardArray);
            break;
        default:
    }

    return moves;
}

function pawnMoves(piece, aPieceSquare, boardArray) {
    squareLetter = aPieceSquare[0];
    squareNumber = parseInt(aPieceSquare[1]);
    let moves = [];

    const aPieceColor = getPieceColor(piece)
    const direction = aPieceColor === 'white' ? 1 : -1; // 1 for White (up), -1 for Black (down)
    const startingRow = aPieceColor === 'white' ? 2 : 7;
    const promotionRow = aPieceColor === 'white' ? 8 : 1;

    // Check for promotion row
    if (squareNumber === promotionRow) {
        console.log('Promote Pawn');
        return moves;
    }

    // Forward move by 1 square
    const squareInFront = `${squareLetter}${squareNumber + direction}`;
    if (squareInFront && !boardArray[8 - (squareNumber + direction)][boardLetters.indexOf(squareLetter)]) { // check if square exists and is empty
        moves.push(squareInFront);

        // Double move if pawn is on starting row
        if (squareNumber === startingRow) { // if pawn is on starting row
            const doubleSquareInFront = `${squareLetter}${squareNumber + 2 * direction}`;
            if (doubleSquareInFront && !boardArray[8 - (squareNumber + 2 * direction)][boardLetters.indexOf(squareLetter)]) { // check if square exists and is also empty
                moves.push(doubleSquareInFront);
            }
        }
    }



    // Check diagonal captures (left and right)
    const diagonals = [
        squareLetter !== 'a' && `${directionLetterBy(-1, 1)}${squareNumber + direction}`,
        squareLetter !== 'h' && `${directionLetterBy(1, 1)}${squareNumber + direction}`
    ];

    diagonals.forEach(diagonal => {
        if (diagonal) {
            const captureSquare = boardArray[8 - (squareNumber + direction)][boardLetters.indexOf(diagonal[0])];
            if (captureSquare && isOpponentPiece(captureSquare, aPieceColor)) {
                if (!moves.includes(diagonal)) {  // Avoid duplicate entries
                    moves.push(diagonal);
                }
            }
        }
    });

    return moves;
}

function rookMoves(aPieceSquare, aPieceColor, boardArray) {
    squareLetter = aPieceSquare[0];
    squareNumber = parseInt(aPieceSquare[1]);
    let moves = [];

    // Define directions for rook: up, down, right, left
    const directions = [
        { letterDirection: 0, numberDirection: 1 },  // Up
        { letterDirection: 0, numberDirection: -1 }, // Down
        { letterDirection: 1, numberDirection: 0 },  // Right
        { letterDirection: -1, numberDirection: 0 }  // Left
    ];

    // Iterate over each direction
    directions.forEach(({ letterDirection, numberDirection }) => {
        for (let i = 1; i <= 7; i++) {
            const letter = directionLetterBy(letterDirection, i);
            const number = directionNumberBy(numberDirection, i);

            // Ensure we're within board bounds
            if (!letter || number < 1 || number > 8) break;

            const square = `${letter}${number}`;
            const piece = boardArray[8 - number][boardLetters.indexOf(letter)];

            if (!addMoveIfOpponentOrEmpty(square, piece, aPieceColor, moves)) break;
        }
    });
    return moves;
}

function bishopMoves(aPieceSquare, aPieceColor, boardArray) {
    squareLetter = aPieceSquare[0];
    squareNumber = parseInt(aPieceSquare[1]);
    let moves = [];

    // Define diagonal directions: [up-right, up-left, down-right, down-left]
    const directions = [
        { letterDirection: 1, numberDirection: 1 },
        { letterDirection: -1, numberDirection: 1 },
        { letterDirection: 1, numberDirection: -1 },
        { letterDirection: -1, numberDirection: -1 }
    ];

    // Iterate over each diagonal direction
    directions.forEach(({ letterDirection, numberDirection }) => {
        for (let i = 1; i <= 7; i++) {
            const letter = directionLetterBy(letterDirection, i);
            const number = directionNumberBy(numberDirection, i);

            // Ensure we're within board bounds
            if (!letter || number < 1 || number > 8) break;

            const square = `${letter}${number}`;
            const piece = boardArray[8 - number][boardLetters.indexOf(letter)];

            if (!addMoveIfOpponentOrEmpty(square, piece, aPieceColor, moves)) break;
        }
    });

    return moves;
}

function knightMoves(aPieceSquare, aPieceColor, boardArray) {
    squareLetter = aPieceSquare[0];
    squareNumber = parseInt(aPieceSquare[1]);
    let moves = [];

    const directions = [
        { numberDirection: -2, letterDirection: 1 }, // 2 down 1 right (Upright L)
        { numberDirection: 1, letterDirection: 2 }, // 1 up 2 right (1 clockwise turn)
        { numberDirection: 2, letterDirection: -1 }, // 2 up 1 left (Upside down L)
        { numberDirection: -1, letterDirection: -2 }, // 1 down 2 left (1 counter clockwise turn)
        { numberDirection: -2, letterDirection: -1 }, // 2 down 1 left (Backwards L)
        { numberDirection: -1, letterDirection: 2 }, // 1 down 2 right (Backwards L, 1 clockwise turn)
        { numberDirection: 2, letterDirection: 1 }, // 2 up 1 right (Backwards L, UpsideDown)
        { numberDirection: 1, letterDirection: -2 } // 1 up 2 left (Backwards L, 1 counter clockwise turn)
    ];

    directions.forEach(({ numberDirection, letterDirection }) => {
        const letter = directionLetterBy(letterDirection, 1);
        const number = directionNumberBy(numberDirection, 1);

        if (!letter || number < 1 || number > 8) return;

        const square = `${letter}${number}`;
        const piece = boardArray[8 - number][boardLetters.indexOf(letter)];

        addMoveIfOpponentOrEmpty(square, piece, aPieceColor, moves);
    });

    return moves;
}

function queenMoves(aPieceSquare, aPieceColor, boardArray) {
    let moves = [];
    moves.push(...rookMoves(aPieceSquare, aPieceColor, boardArray));
    moves.push(...bishopMoves(aPieceSquare, aPieceColor, boardArray));

    return moves;
}

function kingMoves(aPieceSquare, aPieceColor, boardArray) {
    squareLetter = aPieceSquare[0];
    squareNumber = parseInt(aPieceSquare[1]);
    let moves = [];

    const directions = [
        { letterDirection: 0, numberDirection: 1 }, // Up
        { letterDirection: 1, numberDirection: 1 }, // Up-Right
        { letterDirection: 1, numberDirection: 0 }, // Right
        { letterDirection: 1, numberDirection: -1 }, // Down-Right
        { letterDirection: 0, numberDirection: -1 }, // Down
        { letterDirection: -1, numberDirection: -1 }, // Down-Left
        { letterDirection: -1, numberDirection: 0 }, // Left
        { letterDirection: -1, numberDirection: 1 } // Up-Left
    ];

    directions.forEach(({ letterDirection, numberDirection }) => {
        const letter = directionLetterBy(letterDirection, 1);
        const number = directionNumberBy(numberDirection, 1);

        if (!letter || number < 1 || number > 8) return;

        const square = `${letter}${number}`;
        const piece = boardArray[8 - number][boardLetters.indexOf(letter)];

        addMoveIfOpponentOrEmpty(square, piece, aPieceColor, moves);
    });

    return moves;
}

function movePiece(boardArray, selectedSquare, squareName) {
    let newBoardArray = boardArray.map(row => row.slice());
    const [startColumn, startRow] = selectedSquare.split('');
    const [endColumn, endRow] = squareName.split('');
    const startRowIndex = 8 - parseInt(startRow);
    const startColumnIndex = startColumn.charCodeAt(0) - 97;
    const endRowIndex = 8 - parseInt(endRow);
    const endColumnIndex = endColumn.charCodeAt(0) - 97;

    const piece = newBoardArray[startRowIndex][startColumnIndex];
    newBoardArray[startRowIndex][startColumnIndex] = '';
    newBoardArray[endRowIndex][endColumnIndex] = piece;
    return newBoardArray;
}

function isBoardInCheck(currentPlayerInfo, boardArray) {
    const currentAttackAndThreats = currentPlayerInfo.pop();
    let threat = currentAttackAndThreats.threat;

    if (!threat) return false;


    threat.includes('WK') ? whiteKingInCheck = true : whiteKingInCheck = false;
    threat.includes('BK') ? blackKingInCheck = true : blackKingInCheck = false;

    return whiteKingInCheck || blackKingInCheck;

}

function isBoardInCheckNow(currentPlayerInfo) {
    // Filter pieces that have any attacks listed
    const threats = currentPlayerInfo.filter(piece => piece.attacks.length > 0);

    // Check if any piece is attacking the White King (WK) or Black King (BK)
    const wkInCheck = threats.some(piece => piece.attacks.includes('WK'));
    const bkInCheck = threats.some(piece => piece.attacks.includes('BK'));

    if (wkInCheck) {
        console.log('White King is in check');
        return whiteKingInCheck = true;
    } else if (bkInCheck) {
        console.log('Black King is in check');
        return blackKingInCheck = true;
    } else return false;
}

function getAllPieceInfo(boardArray) {
    const currentPlayerInfo = [];
    const opponentInfo = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardArray[row][col];
            if (piece) {
                const position = `${boardLetters[col]}${8 - row}`;
                const pieceColor = getPieceColor(piece);
                const pieceInfo = createPieceInfo(piece, position, pieceColor, boardArray);

                pieceColor === player ? currentPlayerInfo.push(pieceInfo) : opponentInfo.push(pieceInfo);
            }
        }
    }

    const allAtackedPieces = new Set(currentPlayerInfo.flatMap(piece => piece.attacks || []));
    const allThreatenedPieces = new Set(opponentInfo.flatMap(piece => piece.attacks || []));

    let color = player === 'white' ? 'white' : 'black';

    let attack = `Pieces ${color} can capture: ${[...allAtackedPieces].join(', ')}`;
    let threat = `Pieces ${color} could lose: ${[...allThreatenedPieces].join(', ')}`;

    currentPlayerInfo.push({ attack, threat });

    return currentPlayerInfo;
}

function createPieceInfo(piece, position, pieceColor, boardArray) {
    const possibleMoves = getPossibleMoves(piece, position, boardArray);
    const moves = getMovesOnly(possibleMoves, boardArray);;
    const attacks = getCapturesOnly(pieceColor, possibleMoves, boardArray).map(square => squareHasPiece(square, boardArray));

    const pieceInfo = {
        piece: piece,
        position: position,
        moves: moves,
        attacks: attacks
    };

    return pieceInfo;
}

function getMovesOnly(moves, boardArray) {
    return moves.filter(square => !squareHasPiece(square, boardArray));
}

function getCapturesOnly(color, moves, boardArray) {
    return moves.filter(square => squareHasOpponentPiece(color, square, boardArray));
}

function addMoveIfOpponentOrEmpty(square, piece, clickedPieceColor, moves) {
    if (!piece) {
        moves.push(square);
        return true;
    } else if (isOpponentPiece(piece, clickedPieceColor)) {
        moves.push(square);
        return false;
    }
    return false;
}

function isOpponentPiece(piece, clickedPieceColor) {
    return getPieceColor(piece) !== clickedPieceColor;
}

function squareHasPiece(squareName, boardArray) {
    const [column, row] = squareName.split('');
    const columnNumber = boardLetters.indexOf(column);
    const rowNumber = 8 - row;

    const piece = boardArray[rowNumber][columnNumber];

    return piece ? piece : null;
}

function squareHasOpponentPiece(color, squareName, boardArray) {
    const piece = squareHasPiece(squareName, boardArray);
    return piece && getPieceColor(piece) !== color;
}

function hideLegalMovesSquares() {
    const squares = document.querySelectorAll('.legal-move, .capture-hint');
    squares.forEach(square => {
        square.classList.remove('legal-move', 'capture-hint');
    });
}

function showLegalMovesSquares(squares, boardArray) {
    hideLegalMovesSquares();
    squares.forEach(squareName => {
        const square = document.getElementById(squareName);
        if (square) {
            const pieceElement = squareHasPiece(squareName, boardArray);
            if (pieceElement) {
                square.classList.add('capture-hint');
            } else {
                square.classList.add('legal-move');
            }
        }
    });
}

function getPieceColor(piece) {
    if (piece[0] === 'W' || piece[0] === 'w') {
        return 'white';
    } else {
        return 'black';
    }
}

function getPieceType(piece) {
    const pieces = {
        'P': 'pawn',
        'R': 'rook',
        'N': 'knight',
        'B': 'bishop',
        'Q': 'queen',
        'K': 'king'
    };

    return piece.length <= 3 ? pieces[piece[1]] : piece.split('-')[1];
}

function changeCurrentPlayer(currentPlayer) {
    return currentPlayer === 'white' ? 'black' : 'white';
}