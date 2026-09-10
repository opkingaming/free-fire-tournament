const express = require('express');
const db = require('../config/db');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

router.get('/tournaments', (req, res) => {
  const data = db.readDb();
  const rooms = data.rooms
    .filter(r => r.status !== 'cancelled')
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  res.render('tournaments', { rooms, error: null, success: null });
});

// Join a room: deducts entry fee, adds player to list.
// Room ID/password only reveal to players who have joined.
router.post('/tournaments/:id/join', requireUser, async (req, res) => {
  const data = db.readDb();
  const room = data.rooms.find(r => r.id === req.params.id);
  const user = data.users.find(u => u.id === req.session.userId);

  const rooms = data.rooms.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  if (!room) {
    return res.render('tournaments', { rooms, error: 'Room not found.', success: null });
  }
  if (room.status === 'closed' || room.status === 'cancelled') {
    return res.render('tournaments', { rooms, error: 'This room is no longer accepting players.', success: null });
  }
  if (room.players.includes(user.id)) {
    return res.render('tournaments', { rooms, error: 'You already joined this room.', success: null });
  }
  if (room.maxPlayers && room.players.length >= room.maxPlayers) {
    return res.render('tournaments', { rooms, error: 'This room is full.', success: null });
  }
  if (user.coins < room.entryFee) {
    return res.render('tournaments', { rooms, error: `Not enough coins. Entry fee is ${room.entryFee} coins, you have ${user.coins}.`, success: null });
  }

  user.coins -= room.entryFee;
  room.players.push(user.id);
  await db.writeDb(data);

  res.redirect('/my-rooms');
});

// A player's joined rooms, showing room ID/password
router.get('/my-rooms', requireUser, (req, res) => {
  const data = db.readDb();
  const myRooms = data.rooms
    .filter(r => r.players.includes(req.session.userId))
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  res.render('my-rooms', { myRooms });
});

module.exports = router;
