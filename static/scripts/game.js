const socket = io(); // Initialize Socket.IO connection
let gameCode = null;
let role = null;

// Ensure the script runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded, attaching event listeners...");

    // Attach event listener to the Create Game button
    document.getElementById('create-game').addEventListener('click', () => {
    console.log("Create Game button clicked");
    socket.emit('create_game'); // Emit event to create a new game

    // Ensure the board is rotated to default for White
    chessboard.style.transform = 'rotate(0deg)';
    document.querySelectorAll('.square').forEach((square) => {
        square.style.transform = 'rotate(0deg)';
    });
});

    // Attach event listener to the Join Game button
    document.getElementById('join-game').addEventListener('click', () => {
        const gameCodeInput = document.getElementById('join-game-code').value.trim().toUpperCase();
        console.log("Join Game button clicked with code:", gameCodeInput);
        socket.emit('join_game', { game_code: gameCodeInput }); // Emit event to join a game
    });

    // Listen for the game creation event from the server
    socket.on('game_created', (data) => {
    console.log("Game created:", data);
    gameCode = data.game_code;
    role = 'white';
    document.getElementById('game-info').textContent = `Game Code: ${gameCode} (You are White)`;

    // Render the initial board state
    renderBoardFromGameState(data.state);
});

    // Listen for the game joined event from the server
    socket.on('game_joined', (data) => {
        console.log("Game joined:", data);
        gameCode = document.getElementById('join-game-code').value.trim().toUpperCase();
        role = data.role;
        renderBoardFromGameState(data.state); // Let board.js handle the rendering
        document.getElementById('game-info').textContent = `Joined Game: ${gameCode} (You are ${role})`;

        // Rotate board if role is black
        if (role === 'black') {
            console.log("Rotating board for Black player.");
            chessboard.style.transform = 'rotate(180deg)';
            document.querySelectorAll('.square').forEach(square => {
                square.style.transform = 'rotate(180deg)';
            });
        }
    });

    // Listen for game state updates from the server
    socket.on('update_game', (data) => {
        console.log("Game state updated:", data);
        renderBoardFromGameState(data.state); // Let board.js handle the rendering
    });

    // Listen for alerts (e.g., Rookmeo/Juliet captured) from the server
    socket.on('alert', (data) => {
        console.log("Alert received:", data);
        alert(data.message); // Display alert to the user
    });

    // Listen for error messages from the server
    socket.on('error', (data) => {
        console.error("Error received:", data);
        alert(data.message); // Display error to the user
    });
});

// Function to make a move
async function makeMove(move) {
    console.log("Making move:", move);
    socket.emit('make_move', { move }); // Emit move event to the server
}

// Function to fetch legal moves from the server
async function getLegalMoves(square) {
    console.log("Requesting legal moves for:", square);
    return new Promise((resolve, reject) => {
        socket.emit('legal_moves', { square }, (response) => {
            if (!response) {
                console.error("No response received from server");
                reject("No response received from server");
            } else if (response.error) {
                console.error("Error fetching legal moves:", response.error);
                reject(response.error);
            } else {
                console.log("Legal moves received:", response.moves);
                resolve(response.moves);
            }
        });
    });
}

window.addEventListener('beforeunload', (event) => {
    if (gameCode) {
        // Standard message for page unload warning
        event.preventDefault();
        event.returnValue = "You have an active game. Are you sure you want to leave?";
    }
});

let selectedSquare = null; // Declare selectedSquare as a global variable

chessboard.addEventListener('click', async (event) => {
    const square = event.target;
    const pos = square.getAttribute('data-pos');
    if (!pos) {
        console.log("Click ignored: No data-pos attribute");
        return;
    }

    const [row, col] = pos.split('-').map(Number);
    const file = String.fromCharCode(97 + col); // Convert to 'a'-'h'
    const rank = 8 - row; // Convert to 1-8
    const algebraicPos = `${file}${rank}`;
    console.log(`Square clicked: ${algebraicPos}`);

    // If a piece is already selected
    if (selectedSquare) {
        const highlightedSquares = document.querySelectorAll('.highlight');
        const isHighlighted = Array.from(highlightedSquares).some(
            (sq) => sq.getAttribute('data-pos') === `${row}-${col}`
        );

        if (isHighlighted) {
    // Make the move if the clicked square is highlighted
    const move = `${selectedSquare}${algebraicPos}`;
    console.log(`Attempting move: ${move}`);
    await makeMove(move);

    // Clear selection and highlights after the move
    selectedSquare = null;
    highlightedSquares.forEach((sq) => sq.classList.remove('highlight'));
} else {
    // Immediately start selecting the clicked square
    console.log("Clicked square is not a valid target. Selecting new square.");
    highlightedSquares.forEach((sq) => sq.classList.remove('highlight'));
    selectedSquare = algebraicPos;

    const legalMoves = await getLegalMoves(selectedSquare);
    legalMoves.forEach((target) => {
        const targetRow = 8 - parseInt(target[1]);
        const targetCol = target[0].charCodeAt(0) - 97;
        const targetSquare = document.querySelector(`[data-pos="${targetRow}-${targetCol}"]`);
        if (targetSquare) {
            console.log(`Highlighting square: ${targetRow}-${targetCol}`);
            targetSquare.classList.add('highlight');
        }
    });
}
    } else {
        // Select the square and fetch legal moves if it's a valid piece
        const piece = square.textContent;
        const isWhitePiece = piece && "♙♖♘♗♕♔".includes(piece);
        const isBlackPiece = piece && "♟♜♞♝♛♚".includes(piece);
        const isValidSelection =
            (role === "white" && isWhitePiece) || (role === "black" && isBlackPiece);

        if (isValidSelection) {
            console.log(`Square selected: ${algebraicPos}`);
            selectedSquare = algebraicPos;

            const legalMoves = await getLegalMoves(selectedSquare);
            legalMoves.forEach((target) => {
                const targetRow = 8 - parseInt(target[1]);
                const targetCol = target[0].charCodeAt(0) - 97;
                const targetSquare = document.querySelector(`[data-pos="${targetRow}-${targetCol}"]`);
                if (targetSquare) {
                    console.log(`Highlighting square: ${targetRow}-${targetCol}`);
                    targetSquare.classList.add('highlight');
                }
            });
        } else {
            console.log("Invalid piece selected.");
        }
    }
});
