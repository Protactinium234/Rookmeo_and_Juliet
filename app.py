import os
import chess
import random
import string
import secrets
from flask import Flask, render_template, session, request
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
socketio = SocketIO(app, cors_allowed_origins="*")

# Dictionary to store games and their states
games = {}

def generate_game_code():
    """Generate a random 6-character game code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def assign_rookmeo_and_juliet():
    """Randomly assign one rook for each side as Rookmeo and Juliet."""
    white_rooks = ["a1", "h1"]
    black_rooks = ["a8", "h8"]
    rookmeo = random.choice(white_rooks)
    juliet = random.choice(black_rooks)
    return rookmeo, juliet

@app.route('/')
def home():
    print("Serving index.html")
    return render_template('index.html')

@socketio.on('create_game')
def create_game():
    print("Event: create_game")
    game_code = generate_game_code()
    rookmeo, juliet = assign_rookmeo_and_juliet()
    games[game_code] = {
        "state": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "players": {"white": None, "black": None},
        "rookmeo": rookmeo,
        "juliet": juliet,
        "rookmeo_captured": False,
        "juliet_captured": False,
    }
    session['game_code'] = game_code
    session['role'] = 'white'
    session['sid'] = secrets.token_hex(16)
    games[game_code]["players"]["white"] = session['sid']
    join_room(game_code)
    print(f"Game created with code: {game_code}")

    # Send the initial game state to the creator
    emit('game_created', {'game_code': game_code, 'state': games[game_code]["state"]}, room=request.sid)

@socketio.on('join_game')
def join_game(data):
    print("Event: join_game")
    game_code = data.get('game_code').upper()
    print(f"Player attempting to join game: {game_code}")

    if game_code not in games:
        print(f"Invalid game code: {game_code}")
        emit('error', {'message': 'Invalid game code'})
        return

    if games[game_code]["players"]["black"] is None:
        session['game_code'] = game_code
        session['role'] = 'black'
        session['sid'] = secrets.token_hex(16)
        games[game_code]["players"]["black"] = session['sid']
        join_room(game_code)
        print(f"Player joined game {game_code} as black")
        emit('game_joined', {
            'role': 'black',
            'state': games[game_code]["state"]
        }, room=request.sid)
        emit('player_joined', {'message': 'Black has joined the game!'}, room=game_code, include_self=False)
    else:
        print(f"Role already taken in game {game_code}")
        emit('error', {'message': 'Role already taken'}, room=request.sid)

@socketio.on('make_move')
def make_move(data):
    print("Event: make_move")
    game_code = session.get('game_code')
    move = data.get('move')
    print(f"Move received: {move} for game: {game_code}")

    if not game_code or game_code not in games:
        print("Invalid game code")
        emit('error', {'message': 'Invalid game code'})
        return

    game = games[game_code]
    board = chess.Board(game["state"])
    chess_move = chess.Move.from_uci(move)

    if chess_move in board.legal_moves:
        print(f"Valid move: {move}")
        source_square = chess_move.from_square
        target_square = chess_move.to_square
        target_pos = chess.SQUARE_NAMES[target_square]

        # Handle Rookmeo capture
        if target_pos == game["rookmeo"]:
            print(f"Rookmeo captured in game {game_code}")
            game["rookmeo_captured"] = True
            if game["juliet"]:  # Ensure Juliet's position is valid before parsing
                juliet_square = chess.parse_square(game["juliet"])
                board.remove_piece_at(juliet_square)
                board.set_piece_at(juliet_square, chess.Piece(chess.QUEEN, chess.WHITE))
                print(f"Juliet promoted to queen for White at {game['juliet']}")
            game["rookmeo"] = None
            game["juliet"] = None
            emit('alert', {'message': 'Rookmeo captured! Juliet becomes a queen for White!'}, room=game_code)

        # Handle Juliet capture
        elif target_pos == game["juliet"]:
            print(f"Juliet captured in game {game_code}")
            game["juliet_captured"] = True
            if game["rookmeo"]:  # Ensure Rookmeo's position is valid before parsing
                rookmeo_square = chess.parse_square(game["rookmeo"])
                board.remove_piece_at(rookmeo_square)
                board.set_piece_at(rookmeo_square, chess.Piece(chess.QUEEN, chess.BLACK))
                print(f"Rookmeo promoted to queen for Black at {game['rookmeo']}")
            game["rookmeo"] = None
            game["juliet"] = None
            emit('alert', {'message': 'Juliet captured! Rookmeo becomes a queen for Black!'}, room=game_code)

        # Update Rookmeo/Juliet positions if moved
        if game["rookmeo"] and chess_move.from_square == chess.parse_square(game["rookmeo"]):
            game["rookmeo"] = chess.SQUARE_NAMES[chess_move.to_square]
            print(f"Rookmeo moved to {game['rookmeo']} in game {game_code}")
        elif game["juliet"] and chess_move.from_square == chess.parse_square(game["juliet"]):
            game["juliet"] = chess.SQUARE_NAMES[chess_move.to_square]
            print(f"Juliet moved to {game['juliet']} in game {game_code}")

        # Apply the move and update state
        board.push(chess_move)
        game["state"] = board.fen()
        print(f"Game state updated for game {game_code}: {game['state']}")
        emit('update_game', {'state': game["state"]}, room=game_code)
    else:
        print(f"Invalid move: {move}")
        emit('error', {'message': 'Invalid move'})

@socketio.on('legal_moves')
def legal_moves(data):
    game_code = session.get('game_code')
    square = data.get('square')
    print(f"Legal moves requested for square: {square} in game: {game_code}")

    if not game_code or game_code not in games:
        print("Invalid game code")
        return {'error': 'Invalid game code'}

    game = games[game_code]
    board = chess.Board(game["state"])
    legal_moves = [
        move.uci()[2:] for move in board.legal_moves if move.uci().startswith(square)
    ]
    print(f"Legal moves for {square}: {legal_moves}")
    return {'moves': legal_moves}

# Main entry point
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))  # Use PORT from the environment or default to 5000
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
