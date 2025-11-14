import { submitChoice } from '../../../lib/game-store';

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { roomCode, playerId, choice } = req.body;

    if (!roomCode || !playerId || !choice) {
        return res.status(400).json({ error: 'Missing required fields' });
    }



    if (choice !== 'cooperate' && choice !== 'defect') {
        return res.status(400).json({ error: 'Invalid choice' });
    }

    try {
        const room = submitChoice(roomCode, playerId, choice);

        if (!room) {
            return res.status(404).json({ error: 'Room not found or you are not in this room' });
        }

        const playerIndex = room.players.indexOf(playerId);
        const playerNumber = playerIndex + 1;
        const opponentNumber = playerNumber === 1 ? 2 : 1;
        const opponentMadeChoice = !!room.choices[`player${opponentNumber}`];

        return res.status(200).json({
            success: true,
            gameState: room.gameState,
            currentRound: room.currentRound,
            scores: room.scores,
            waitingForOpponent: !opponentMadeChoice,
            gameHistory: room.gameHistory,
            lastRound: room.gameHistory[room.gameHistory.length - 1] || null
        });
    } catch (error) {
        console.error('Error submitting choice:', error);
        return res.status(500).json({ error: 'Failed to submit choice' });
    }
}

