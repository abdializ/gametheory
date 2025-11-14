import { Server } from 'socket.io';

// Maximum number of rounds in a game
const MAX_ROUNDS = 15;

// In-memory game state
let io;
let rooms = {}; // Map of room codes to game states

// Bot strategies 
const BOT_STRATEGIES = ['tit-for-tat', 'always-defect', 'always-cooperate', 'random'];

// Initialize a new room
const initializeRoom = (roomCode, mode = 'multiplayer', botStrategy = null) => {
    rooms[roomCode] = {
        players: [],
        playersById: {}, // Map of socketId to player data
        scores: { p1: 0, p2: 0 },
        roundCount: 0,
        isTieBreak: false,
        gameHistory: [],
        gameMode: mode,
        botStrategy: botStrategy,
        gameInProgress: false,
        lastActivity: Date.now()
    };

    console.log(`Room created: ${roomCode} with mode: ${mode}`);

    // If it's a bot game, add a bot player
    if (mode === 'bot') {
        rooms[roomCode].playersById['bot'] = {
            socketId: 'bot',
            playerId: 'p2',
            choice: null,
            connected: true,
            lastChoice: null
        };
    }

    return rooms[roomCode];
};

// Calculate cooperation streaks for each player
const calculateStreaks = (gameHistory, currentP1Choice, currentP2Choice) => {
    let p1Streak = 0;
    let p2Streak = 0;
    
    // Count consecutive cooperations from the end
    for (let i = gameHistory.length - 1; i >= 0; i--) {
        if (gameHistory[i].p1Choice === 'cooperate') {
            p1Streak++;
        } else {
            break;
        }
    }
    
    for (let i = gameHistory.length - 1; i >= 0; i--) {
        if (gameHistory[i].p2Choice === 'cooperate') {
            p2Streak++;
        } else {
            break;
        }
    }
    
    // Add current round if cooperating
    if (currentP1Choice === 'cooperate') p1Streak++;
    if (currentP2Choice === 'cooperate') p2Streak++;
    
    return { p1Streak, p2Streak };
};

// Calculate defection rate (reputation)
const calculateDefectionRate = (gameHistory, playerId) => {
    if (gameHistory.length === 0) return 0;
    
    const choiceKey = playerId === 1 ? 'p1Choice' : 'p2Choice';
    const defects = gameHistory.filter(round => round[choiceKey] === 'defect').length;
    return defects / gameHistory.length;
};

// Check if player switched from defect to cooperate (forgiveness bonus)
const checkForgiveness = (gameHistory, currentChoice, playerId) => {
    if (gameHistory.length === 0) return false;
    
    const choiceKey = playerId === 1 ? 'p1Choice' : 'p2Choice';
    const lastChoice = gameHistory[gameHistory.length - 1][choiceKey];
    return lastChoice === 'defect' && currentChoice === 'cooperate';
};

// Calculate payoffs with enhanced mechanics to balance the game
const calculatePayoffs = (p1Choice, p2Choice, gameHistory = []) => {
    let p1Payoff = 0;
    let p2Payoff = 0;
    
    // Base payoffs from standard Prisoner's Dilemma
    if (p1Choice === 'cooperate' && p2Choice === 'cooperate') {
        p1Payoff = 3;
        p2Payoff = 3;
    } else if (p1Choice === 'cooperate' && p2Choice === 'defect') {
        p1Payoff = 0;
        p2Payoff = 5;
    } else if (p1Choice === 'defect' && p2Choice === 'cooperate') {
        p1Payoff = 5;
        p2Payoff = 0;
    } else if (p1Choice === 'defect' && p2Choice === 'defect') {
        p1Payoff = 1;
        p2Payoff = 1;
    }
    
    // Calculate streaks
    const { p1Streak, p2Streak } = calculateStreaks(gameHistory, p1Choice, p2Choice);
    
    // Cooperation streak bonus: +1 point for every 2 consecutive cooperations
    if (p1Choice === 'cooperate' && p2Choice === 'cooperate') {
        const p1Bonus = Math.floor(p1Streak / 2);
        const p2Bonus = Math.floor(p2Streak / 2);
        p1Payoff += p1Bonus;
        p2Payoff += p2Bonus;
    }
    
    // Reputation penalty: if defection rate > 60%, reduce defection rewards
    const p1DefectRate = calculateDefectionRate(gameHistory, 1);
    const p2DefectRate = calculateDefectionRate(gameHistory, 2);
    
    if (p1Choice === 'defect' && p2Choice === 'cooperate') {
        // P1 defects against cooperator
        if (p1DefectRate > 0.6) {
            // Reduce reward for excessive defection
            p1Payoff = Math.max(2, p1Payoff - Math.floor(p1DefectRate * 3));
        }
    }
    
    if (p2Choice === 'defect' && p1Choice === 'cooperate') {
        // P2 defects against cooperator
        if (p2DefectRate > 0.6) {
            // Reduce reward for excessive defection
            p2Payoff = Math.max(2, p2Payoff - Math.floor(p2DefectRate * 3));
        }
    }
    
    // Forgiveness bonus: +2 points for switching from defect to cooperate
    if (checkForgiveness(gameHistory, p1Choice, 1) && p2Choice === 'cooperate') {
        p1Payoff += 2;
    }
    
    if (checkForgiveness(gameHistory, p2Choice, 2) && p1Choice === 'cooperate') {
        p2Payoff += 2;
    }
    
    // Mutual defection penalty: if both defect repeatedly, reduce points further
    if (p1Choice === 'defect' && p2Choice === 'defect') {
        const mutualDefects = gameHistory.filter(r => 
            r.p1Choice === 'defect' && r.p2Choice === 'defect'
        ).length;
        
        if (mutualDefects >= 3) {
            // After 3+ mutual defections, both get 0 points
            p1Payoff = 0;
            p2Payoff = 0;
        }
    }
    
    return { p1Payoff, p2Payoff };
};

// Check if both players in a room have made their choices
const bothPlayersChosen = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return false;

    let p1Choice = null;
    let p2Choice = null;

    // Find choices for both players
    Object.values(room.playersById).forEach(player => {
        if (player.playerId === 'p1') {
            p1Choice = player.choice;
        }
        if (player.playerId === 'p2') {
            p2Choice = player.choice;
        }
    });

    // In bot mode, trigger the bot to make a choice if the human has chosen
    if (room.gameMode === 'bot' && p1Choice !== null && p2Choice === null && room.playersById['bot']) {
        room.playersById['bot'].choice = getBotDecision(roomCode);
        p2Choice = room.playersById['bot'].choice;
        console.log(`Room ${roomCode}: Bot made choice: ${p2Choice}`);
    }

    return p1Choice !== null && p2Choice !== null;
};

// Get choices from both players in a room
const getChoices = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return { p1Choice: null, p2Choice: null };

    let p1Choice = null;
    let p2Choice = null;

    Object.values(room.playersById).forEach(player => {
        if (player.playerId === 'p1') {
            p1Choice = player.choice;
        }
        if (player.playerId === 'p2') {
            p2Choice = player.choice;
        }
    });

    return { p1Choice, p2Choice };
};

// Reset choices for all players in a room
const resetChoices = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    Object.keys(room.playersById).forEach(socketId => {
        if (room.playersById[socketId]) {
            room.playersById[socketId].choice = null;
        }
    });

    console.log(`Room ${roomCode}: Reset all player choices`);
};

// Process round results and emit to all clients in a room
const processRoundResults = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    // Get choices
    const { p1Choice, p2Choice } = getChoices(roomCode);

    // Calculate payoffs using history BEFORE adding current round
    const { p1Payoff, p2Payoff } = calculatePayoffs(p1Choice, p2Choice, room.gameHistory);

    // Store in history for bot strategies (after calculating payoffs)
    room.gameHistory.push({
        p1Choice,
        p2Choice
    });

    // Update scores
    room.scores.p1 += p1Payoff;
    room.scores.p2 += p2Payoff;

    // Increment round count (only in normal game phase)
    if (!room.isTieBreak) {
        room.roundCount++;
    }

    // Check if we should enter tie-break mode
    if (room.roundCount === MAX_ROUNDS && room.scores.p1 === room.scores.p2) {
        room.isTieBreak = true;
    }

    // Check if the game is over
    const isGameOver = (room.roundCount >= MAX_ROUNDS && room.scores.p1 !== room.scores.p2) ||
        (room.isTieBreak && room.scores.p1 !== room.scores.p2);

    // Emit round result to all clients in the room
    room.players.forEach(socketId => {
        if (io) {
            io.to(socketId).emit('roundResult', {
                round: room.roundCount,
                isTieBreak: room.isTieBreak,
                isGameOver,
                result: {
                    p1Choice,
                    p2Choice,
                    pts1: p1Payoff,
                    pts2: p2Payoff,
                    scores: { ...room.scores }
                }
            });
        }
    });

    // Reset choices for next round
    resetChoices(roomCode);

    // If the game is over, clean up after a short delay
    if (isGameOver) {
        setTimeout(() => {
            if (rooms[roomCode]) {
                // If there are still players in the room, reset the game state
                if (room.players.length > 0) {
                    room.scores = { p1: 0, p2: 0 };
                    room.roundCount = 0;
                    room.isTieBreak = false;
                    room.gameHistory = [];
                    room.gameInProgress = false;
                } else {
                    // If no players left, delete the room
                    delete rooms[roomCode];
                    console.log(`Room ${roomCode} deleted (game over, no players)`);
                }
            }
        }, 10000); // 10 seconds delay
    }
};

// Reset the game state for a room
const resetGame = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.scores = { p1: 0, p2: 0 };
    room.roundCount = 0;
    room.isTieBreak = false;
    resetChoices(roomCode);
    room.gameHistory = [];
    room.gameInProgress = false;

    console.log(`Room ${roomCode}: Game state reset`);

    // Notify all players in the room
    room.players.forEach(socketId => {
        if (io) {
            io.to(socketId).emit('gameReset');
        }
    });
};

// Evaluate the round when both players have chosen
const evaluateRound = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    console.log(`Room ${roomCode}: Evaluating round`);

    // In bot mode, make the bot choose if it hasn't already
    if (room.gameMode === 'bot' && room.playersById['bot'] && !room.playersById['bot'].choice) {
        room.playersById['bot'].choice = getBotDecision(roomCode);
        console.log(`Room ${roomCode}: Bot chose: ${room.playersById['bot'].choice}`);
    }

    // Process round results if both players have chosen
    if (bothPlayersChosen(roomCode)) {
        const { p1Choice, p2Choice } = getChoices(roomCode);

        // Save choices for next round (used by some bot strategies)
        Object.values(room.playersById).forEach(player => {
            if (player.playerId === 'p1') {
                player.lastChoice = p1Choice;
            } else if (player.playerId === 'p2') {
                player.lastChoice = p2Choice;
            }
        });

        // Process the round and update scores
        processRoundResults(roomCode);
    }
};

// Bot decision making function
const getBotDecision = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return 'defect';

    const strategy = room.botStrategy || 'random';

    // Default to random choice if no valid strategy
    if (!BOT_STRATEGIES.includes(strategy)) {
        return Math.random() < 0.5 ? 'cooperate' : 'defect';
    }

    switch (strategy) {
        case 'always-cooperate':
            return 'cooperate';

        case 'always-defect':
            return 'defect';

        case 'tit-for-tat':
            // First round, cooperate
            if (room.roundCount === 0) {
                return 'cooperate';
            }
            // Otherwise, do what human did last round
            const humanPlayer = Object.values(room.playersById).find(p => p.playerId === 'p1');
            return humanPlayer && humanPlayer.lastChoice ? humanPlayer.lastChoice : 'cooperate';

        case 'random':
            return Math.random() < 0.5 ? 'cooperate' : 'defect';

        default:
            return Math.random() < 0.5 ? 'cooperate' : 'defect';
    }
};

// Emit game state to all clients in a room
const emitGameState = (roomCode) => {
    const room = rooms[roomCode];
    if (!room || !io) return;

    // Get player status
    const p1Socket = Object.values(room.playersById).find(p => p.playerId === 'p1')?.socketId;
    const p2Socket = Object.values(room.playersById).find(p => p.playerId === 'p2')?.socketId;

    const gameState = {
        roomCode,
        players: Object.values(room.playersById).map(p => ({
            playerId: p.playerId,
            hasChoice: p.choice !== null,
            isBot: p.socketId === 'bot'
        })),
        playerCount: {
            total: room.players.length + (room.gameMode === 'bot' ? 0 : 0),
            p1: p1Socket ? 1 : 0,
            p2: p2Socket ? 1 : 0
        },
        round: room.roundCount,
        gameMode: room.gameMode,
        isGameActive: room.gameInProgress,
        isTieBreak: room.isTieBreak,
        isGameOver: room.roundCount >= MAX_ROUNDS || (room.isTieBreak && room.scores.p1 !== room.scores.p2),
        scores: { ...room.scores },
        timestamp: Date.now()
    };

    console.log(`Room ${roomCode}: Emitting game state - Round: ${room.roundCount}, Players: ${room.players.length}, Game active: ${room.gameInProgress}`);

    // Send to all clients in the room
    room.players.forEach(socketId => {
        io.to(socketId).emit('gameState', gameState);
    });
};

// Helper function to detect and handle stale connections
const isConnectionStale = (socket) => {
    return !socket.connected;
};

// Register socket handlers
const registerSocketHandlers = (socketIo) => {
    // Set up heartbeat mechanism
    setInterval(() => {
        if (socketIo.sockets && socketIo.sockets.sockets) {
            socketIo.sockets.sockets.forEach((socket) => {
                if (isConnectionStale(socket)) {
                    console.log(`Detected stale connection for ${socket.id}, forcing disconnect`);
                    try {
                        socket.disconnect(true);
                    } catch (e) {
                        console.error(`Error disconnecting stale socket ${socket.id}:`, e);
                    }
                }
            });
        }
    }, 30000); // Check every 30 seconds

    socketIo.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // Set up data structure for this socket
        socket.data = {
            roomCode: null,
            playerId: null
        };

        // Handle reconnection attempts
        socket.on('reconnect_attempt', () => {
            console.log(`Reconnection attempt from ${socket.id}`);
        });

        // Handle room creation
        socket.on('createRoom', ({ mode, botStrategy }) => {
            try {
                // Generate a random room code if not provided
                const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();

                // If room already exists, emit error
                if (rooms[roomCode]) {
                    socket.emit('error', { message: 'Room code already in use. Please try again.' });
                    return;
                }

                // Initialize the room
                const room = initializeRoom(roomCode, mode, botStrategy);

                // Add player to the room
                room.players.push(socket.id);
                room.playersById[socket.id] = {
                    socketId: socket.id,
                    playerId: 'p1', // First player is always p1
                    choice: null,
                    connected: true,
                    lastChoice: null
                };

                // Store room code in socket data
                socket.data.roomCode = roomCode;
                socket.data.playerId = 'p1';

                // Join socket to a room
                socket.join(roomCode);

                // For bot games, mark as in progress
                if (mode === 'bot') {
                    room.gameInProgress = true;
                }

                // Notify client that room was created
                socket.emit('roomCreated', {
                    roomCode,
                    playerId: 'p1',
                    gameMode: mode
                });

                // Emit initial game state
                emitGameState(roomCode);

                console.log(`Room ${roomCode} created by ${socket.id}, mode: ${mode}, players: ${room.players.length}`);
            } catch (error) {
                console.error('Error creating room:', error);
                socket.emit('error', { message: 'Failed to create room. Please try again.' });
            }
        });

        // Handle joining a room
        socket.on('joinRoom', ({ roomCode }) => {
            try {
                // Normalize room code
                roomCode = roomCode.toUpperCase();

                // Check if room exists
                if (!rooms[roomCode]) {
                    socket.emit('error', { message: 'Room not found. Please check the code and try again.' });
                    return;
                }

                const room = rooms[roomCode];

                // Check if room is full (2 players max, not counting bots)
                const humanPlayers = room.players.filter(id => id !== 'bot').length;
                if (humanPlayers >= 2) {
                    socket.emit('error', { message: 'Room is full. Please try another code.' });
                    return;
                }

                // Check if it's a bot game
                if (room.gameMode === 'bot') {
                    socket.emit('error', { message: 'Cannot join a bot game. Please create your own game.' });
                    return;
                }

                // Add player to room
                room.players.push(socket.id);

                // Join socket to the room
                socket.join(roomCode);

                // Determine player ID (p1 if not taken, p2 otherwise)
                const p1Taken = Object.values(room.playersById).some(p => p.playerId === 'p1');
                const playerId = p1Taken ? 'p2' : 'p1';

                room.playersById[socket.id] = {
                    socketId: socket.id,
                    playerId,
                    choice: null,
                    connected: true,
                    lastChoice: null
                };

                // Store room code in socket data
                socket.data.roomCode = roomCode;
                socket.data.playerId = playerId;

                // Notify client that they joined the room
                socket.emit('roomJoined', {
                    roomCode,
                    playerId,
                    gameMode: room.gameMode
                });

                // If both players are present, start the game
                if (Object.values(room.playersById).filter(p => p.playerId === 'p1' || p.playerId === 'p2').length === 2) {
                    room.gameInProgress = true;

                    // Notify all clients in the room that the game is ready
                    socketIo.to(roomCode).emit('gameReady', { ready: true });
                }

                // Emit updated game state to all players in the room
                emitGameState(roomCode);

                console.log(`Player ${socket.id} joined room ${roomCode} as ${playerId}, players: ${room.players.length}`);
            } catch (error) {
                console.error('Error joining room:', error);
                socket.emit('error', { message: 'Failed to join room. Please try again.' });
            }
        });

        // Handle player choice
        socket.on('choice', ({ choice }) => {
            try {
                const roomCode = socket.data.roomCode;

                // Check if room exists
                if (!roomCode || !rooms[roomCode]) {
                    socket.emit('error', { message: 'Room not found. Please rejoin the game.' });
                    return;
                }

                const room = rooms[roomCode];

                // Check if player is in this room
                if (!room.playersById[socket.id]) {
                    socket.emit('error', { message: 'You are not registered in this room.' });
                    return;
                }

                // Record the choice
                const player = room.playersById[socket.id];
                player.choice = choice;

                console.log(`Room ${roomCode}: Player ${player.playerId} chose ${choice}`);

                // Find the other player and emit playerChosen only to them
                const otherPlayerId = player.playerId === 'p1' ? 'p2' : 'p1';
                const otherPlayer = Object.values(room.playersById).find(p => p.playerId === otherPlayerId);

                if (otherPlayer && otherPlayer.socketId !== 'bot') {
                    // Immediately emit to the other player, not to everyone
                    io.to(otherPlayer.socketId).emit('playerChosen');
                    console.log(`Room ${roomCode}: Notified player ${otherPlayerId} (${otherPlayer.socketId}) that ${player.playerId} has chosen`);
                }

                // Emit updated game state AFTER playerChosen notification
                emitGameState(roomCode);

                // Check if both players have chosen
                if (bothPlayersChosen(roomCode)) {
                    evaluateRound(roomCode);
                } else if (room.gameMode === 'bot') {
                    // For bot games, evaluate immediately (bot will make its choice)
                    evaluateRound(roomCode);
                }

                // Update last activity timestamp
                room.lastActivity = Date.now();
            } catch (error) {
                console.error('Error processing choice:', error);
                socket.emit('error', { message: 'Failed to process your choice. Please try again.' });
            }
        });

        // Handle reset game request
        socket.on('resetGame', () => {
            try {
                const roomCode = socket.data.roomCode;

                // Check if room exists
                if (!roomCode || !rooms[roomCode]) {
                    return;
                }

                // Reset the game
                resetGame(roomCode);

                // Emit updated game state
                emitGameState(roomCode);

                console.log(`Room ${roomCode}: Game reset by ${socket.id}`);
            } catch (error) {
                console.error('Error resetting game:', error);
                socket.emit('error', { message: 'Failed to reset game. Please try again.' });
            }
        });

        // Add custom pinger/ponger for this socket
        socket.on('ping', () => {
            try {
                socket.emit('pong');
            } catch (e) {
                console.error(`Error sending pong to ${socket.id}:`, e);
            }
        });

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            try {
                console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);

                const roomCode = socket.data.roomCode;

                // Check if player was in a room
                if (roomCode && rooms[roomCode]) {
                    const room = rooms[roomCode];

                    // Remember player role
                    const playerRole = room.playersById[socket.id]?.playerId;

                    // Remove player from room
                    const playerIndex = room.players.indexOf(socket.id);
                    if (playerIndex !== -1) {
                        room.players.splice(playerIndex, 1);
                    }

                    // Remove player data
                    delete room.playersById[socket.id];

                    console.log(`Player ${socket.id} (${playerRole}) disconnected from room ${roomCode}`);

                    // If it was a bot game and the human left, clean up the room
                    if (room.gameMode === 'bot' && playerRole === 'p1') {
                        delete rooms[roomCode];
                        console.log(`Bot room ${roomCode} deleted (human player left)`);
                    }
                    // Otherwise, if no players left or game was in progress, clean up after a delay
                    else if (room.players.length === 0) {
                        setTimeout(() => {
                            // Double-check the room still exists and is still empty
                            if (rooms[roomCode] && rooms[roomCode].players.length === 0) {
                                delete rooms[roomCode];
                                console.log(`Room ${roomCode} deleted (all players left)`);
                            }
                        }, 10000); // 10 seconds delay
                    } else {
                        // Game is no longer in progress if it was
                        if (room.gameInProgress) {
                            room.gameInProgress = false;
                        }

                        // Emit updated game state to remaining players
                        emitGameState(roomCode);
                    }
                }
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
    });

    // Set up room cleanup interval (checks for inactive rooms every 5 minutes)
    setInterval(() => {
        const now = Date.now();
        Object.keys(rooms).forEach(roomCode => {
            const room = rooms[roomCode];

            // If room has been inactive for more than 30 minutes, clean it up
            if (now - room.lastActivity > 30 * 60 * 1000) {
                console.log(`Cleaning up inactive room ${roomCode} (30 minutes without activity)`);

                // Notify any remaining players
                if (io) {
                    room.players.forEach(socketId => {
                        io.to(socketId).emit('roomClosed', { message: 'This room has been closed due to inactivity.' });
                    });
                }

                // Delete the room
                delete rooms[roomCode];
            }
        });
    }, 5 * 60 * 1000); // 5 minutes
};

// Entry point for API route
export default function SocketHandler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
    }

    console.log('Socket.IO API route hit', req.method, req.url);

    // Ensure we have a server instance
    if (!res.socket || !res.socket.server) {
        console.error('No server instance available');
        res.status(500).end('Server not available');
        return;
    }

    // Check if server already has Socket.IO instance
    if (res.socket.server.io) {
        console.log('Socket.IO is already running');
        // Make sure handlers are registered
        if (!res.socket.server.io._handlersRegistered) {
            registerSocketHandlers(res.socket.server.io);
            res.socket.server.io._handlersRegistered = true;
        }
        res.end();
        return;
    }

    try {
        console.log('Initializing Socket.IO server');

        // Initialize Socket.IO server with configuration optimized for Vercel
        io = new Server(res.socket.server, {
            path: '/api/socket',
            cors: {
                origin: "*",
                methods: ["GET", "POST", "OPTIONS"],
                credentials: true
            },
            transports: ["polling", "websocket"],
            pingInterval: 25000,
            pingTimeout: 60000,
            allowEIO3: true,
            connectTimeout: 45000,
            // Optimize for serverless
            allowUpgrades: true,
            upgradeTimeout: 10000
        });

        // Store Socket.IO instance on response object
        res.socket.server.io = io;

        // Log socket.io path for debugging
        console.log(`Socket.IO server initialized with path: ${io.path()}`);

        // Register socket event handlers
        registerSocketHandlers(io);
        io._handlersRegistered = true;

        // Handle common errors
        io.engine.on("connection_error", (err) => {
            console.error('Socket.IO connection error:', err);
        });

        io.engine.on("upgrade_error", (err) => {
            console.error('Socket.IO upgrade error:', err);
        });

        io.engine.on("error", (err) => {
            console.error('Socket.IO engine error:', err);
        });

        console.log('Socket.IO initialization successful');
        res.end();
    } catch (error) {
        console.error('Socket.IO initialization error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to initialize Socket.IO', message: error.message });
    }
}