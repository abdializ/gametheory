// In-memory game state store for Vercel serverless
// This will reset when the function cold-starts, but that's okay for our use case

const rooms = new Map();
const roomExpiryTime = 30 * 60 * 1000; // 30 minutes

// Helper to clean up old rooms
function cleanupOldRooms() {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
        if (now - room.lastActivity > roomExpiryTime) {
            rooms.delete(code);
        }
    }
}

// Generate a random 6-digit room code
function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create a new room
export function createRoom() {
    cleanupOldRooms();
    
    const code = generateRoomCode();
    const room = {
        code,
        players: [],
        gameState: 'waiting',
        currentRound: 0,
        totalRounds: 15,
        choices: {},
        gameHistory: [],
        scores: { player1: 0, player2: 0 },
        lastActivity: Date.now()
    };
    
    rooms.set(code, room);
    return room;
}

// Get room by code
export function getRoom(code) {
    cleanupOldRooms();
    const room = rooms.get(code);
    if (room) {
        room.lastActivity = Date.now();
    }
    return room;
}

// Join a room
export function joinRoom(code, playerId) {
    const room = getRoom(code);
    if (!room) return null;
    
    if (!room.players.includes(playerId)) {
        if (room.players.length < 2) {
            room.players.push(playerId);
            room.lastActivity = Date.now();
        } else {
            return null; // Room full
        }
    }
    
    // Start game when 2 players join
    if (room.players.length === 2 && room.gameState === 'waiting') {
        room.gameState = 'playing';
        room.currentRound = 1;
    }
    
    return room;
}

// Submit a choice
export function submitChoice(code, playerId, choice) {
    const room = getRoom(code);
    if (!room) return null;
    
    const playerIndex = room.players.indexOf(playerId);
    if (playerIndex === -1) return null;
    
    room.choices[`player${playerIndex + 1}`] = choice;
    room.lastActivity = Date.now();
    
    // Both players made choices, process round
    if (room.choices.player1 && room.choices.player2) {
        processRound(room);
    }
    
    return room;
}

// Process round results
function processRound(room) {
    const p1Choice = room.choices.player1;
    const p2Choice = room.choices.player2;
    
    // Calculate payoffs with enhanced mechanics
    const result = calculateEnhancedPayoffs(p1Choice, p2Choice, room.gameHistory);
    
    // Update scores
    room.scores.player1 += result.player1;
    room.scores.player2 += result.player2;
    
    // Record in history
    room.gameHistory.push({
        round: room.currentRound,
        player1: p1Choice,
        player2: p2Choice,
        payoffs: result
    });
    
    // Clear choices
    room.choices = {};
    
    // Check if game is over
    if (room.currentRound >= room.totalRounds) {
        room.gameState = 'finished';
    } else {
        room.currentRound++;
    }
    
    room.lastActivity = Date.now();
}

// Enhanced payoff calculation (same as before)
function calculateStreaks(history) {
    let cooperationStreak = 0;
    let mutualDefectionStreak = 0;
    
    for (let i = history.length - 1; i >= 0; i--) {
        const round = history[i];
        if (round.player1 === 'cooperate' && round.player2 === 'cooperate') {
            cooperationStreak++;
            mutualDefectionStreak = 0;
        } else if (round.player1 === 'defect' && round.player2 === 'defect') {
            mutualDefectionStreak++;
            cooperationStreak = 0;
        } else {
            break;
        }
    }
    
    return { cooperationStreak, mutualDefectionStreak };
}

function calculateDefectionRate(history, player) {
    if (history.length === 0) return 0;
    const defections = history.filter(r => r[player] === 'defect').length;
    return defections / history.length;
}

function checkForgiveness(history, player) {
    if (history.length < 1) return false;
    const lastRound = history[history.length - 1];
    return lastRound[player] === 'defect';
}

function calculateEnhancedPayoffs(p1Choice, p2Choice, history) {
    // Base payoffs
    let p1Score, p2Score;
    
    if (p1Choice === 'cooperate' && p2Choice === 'cooperate') {
        p1Score = p2Score = 3;
    } else if (p1Choice === 'cooperate' && p2Choice === 'defect') {
        p1Score = 0; p2Score = 5;
    } else if (p1Choice === 'defect' && p2Choice === 'cooperate') {
        p1Score = 5; p2Score = 0;
    } else {
        p1Score = p2Score = 1;
    }
    
    const { cooperationStreak, mutualDefectionStreak } = calculateStreaks(history);
    const p1DefectionRate = calculateDefectionRate(history, 'player1');
    const p2DefectionRate = calculateDefectionRate(history, 'player2');
    const p1Forgiveness = checkForgiveness(history, 'player1');
    const p2Forgiveness = checkForgiveness(history, 'player2');
    
    let p1Bonus = 0, p2Bonus = 0;
    const bonuses = [];
    
    // Cooperation streak bonus
    if (p1Choice === 'cooperate' && p2Choice === 'cooperate' && cooperationStreak >= 2) {
        const streakBonus = Math.floor(cooperationStreak / 2);
        p1Bonus += streakBonus;
        p2Bonus += streakBonus;
        bonuses.push(`[BONUS] +${streakBonus} for ${cooperationStreak} cooperation streak`);
    }
    
    // Forgiveness bonus
    if (p1Choice === 'cooperate' && p1Forgiveness) {
        p1Bonus += 2;
        bonuses.push('[FORGIVENESS] Player 1 +2 for choosing cooperation');
    }
    if (p2Choice === 'cooperate' && p2Forgiveness) {
        p2Bonus += 2;
        bonuses.push('[FORGIVENESS] Player 2 +2 for choosing cooperation');
    }
    
    // Reputation penalty
    if (p1Choice === 'defect' && p1DefectionRate > 0.6) {
        p1Score = Math.max(1, Math.floor(p1Score * 0.7));
        bonuses.push('[WARNING] Player 1 defection reward reduced due to reputation');
    }
    if (p2Choice === 'defect' && p2DefectionRate > 0.6) {
        p2Score = Math.max(1, Math.floor(p2Score * 0.7));
        bonuses.push('[WARNING] Player 2 defection reward reduced due to reputation');
    }
    
    // Mutual defection penalty
    if (p1Choice === 'defect' && p2Choice === 'defect' && mutualDefectionStreak >= 3) {
        p1Score = 0;
        p2Score = 0;
        bonuses.push('[PENALTY] Excessive mutual defection - both players get 0');
    }
    
    return {
        player1: p1Score + p1Bonus,
        player2: p2Score + p2Bonus,
        bonuses
    };
}

// Delete a room
export function deleteRoom(code) {
    rooms.delete(code);
}

// Get room count (for debugging)
export function getRoomCount() {
    cleanupOldRooms();
    return rooms.size;
}

