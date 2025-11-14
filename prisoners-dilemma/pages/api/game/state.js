import { getRoom } from '../../../lib/game-store';

export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { roomCode, playerId } = req.query;
    
    if (!roomCode || !playerId) {
        return res.status(400).json({ error: 'Missing roomCode or playerId' });
    }
    
    try {
        const room = getRoom(roomCode);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        
        const playerIndex = room.players.indexOf(playerId);
        if (playerIndex === -1) {
            return res.status(403).json({ error: 'Not in this room' });
        }
        
        const playerNumber = playerIndex + 1;
        const opponentNumber = playerNumber === 1 ? 2 : 1;
        const opponentMadeChoice = !!room.choices[`player${opponentNumber}`];
        
        return res.status(200).json({
            gameState: room.gameState,
            currentRound: room.currentRound,
            totalRounds: room.totalRounds,
            scores: room.scores,
            playerCount: room.players.length,
            playerNumber,
            waitingForOpponent: room.choices[`player${playerNumber}`] && !opponentMadeChoice,
            bothPlayersReady: room.players.length === 2,
            gameHistory: room.gameHistory,
            lastRound: room.gameHistory[room.gameHistory.length - 1] || null
        });
    } catch (error) {
        console.error('Error getting game state:', error);
        return res.status(500).json({ error: 'Failed to get game state' });
    }
}

