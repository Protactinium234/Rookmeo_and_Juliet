const chessboard = document.getElementById('chessboard');

const pieceMap = {
    'P': '♙', 'p': '♟',
    'R': '♖', 'r': '♜',
    'N': '♘', 'n': '♞',
    'B': '♗', 'b': '♝',
    'Q': '♕', 'q': '♛',
    'K': '♔', 'k': '♚'
};

function renderBoardFromGameState(game_state) {
    const [position] = game_state.split(" ");
    const rows = position.split("/");
    const squares = document.querySelectorAll('.square');

    // Clear the board
    squares.forEach(square => {
        square.textContent = "";
        square.classList.remove('highlight');
    });

    rows.forEach((row, i) => {
        let col = 0;
        for (const char of row) {
            if (isNaN(char)) {
                // Place piece
                const square = document.querySelector(`[data-pos="${i}-${col}"]`);
                square.textContent = pieceMap[char] || ""; // Map piece to Unicode
                col++;
            } else {
                // Skip empty squares
                col += parseInt(char);
            }
        }
    });
}

function createBoard() {
    chessboard.innerHTML = ''; // Clear any existing squares

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const square = document.createElement('div');
            square.classList.add('square', (i + j) % 2 === 0 ? 'white' : 'black');
            square.setAttribute('data-pos', `${i}-${j}`);
            chessboard.appendChild(square);
        }
    }
}

createBoard();
