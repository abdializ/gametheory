import { joinRoom } from '../../../lib/game-store';

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { roomCode, playerId } = req.body;
    
    if (!roomCode || !playerId) {
        return res.status(400).json({ error: 'Missing roomCode or playerId' });
    }
    
    try {
        const room = joinRoom(roomCode, playerId);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found or full' });
        }
        
        return res.status(200).json({ 
            room: {
                code: room.code,
                playerNumber: room.players.indexOf(playerId) + 1,
                gameState: room.gameState,
                currentRound: room.currentRound,
                totalRounds: room.totalRounds,
                scores: room.scores,
                playerCount: room.players.length
            }
        });
    } catch (error) {
        console.error('Error joining room:', error);
        return res.status(500).json({ error: 'Failed to join room' });
    }
}

