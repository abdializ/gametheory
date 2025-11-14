import { createRoom } from '../../../lib/game-store';

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const room = createRoom();
        return res.status(200).json({ roomCode: room.code });
    } catch (error) {
        console.error('Error creating room:', error);
        return res.status(500).json({ error: 'Failed to create room' });
    }
}

