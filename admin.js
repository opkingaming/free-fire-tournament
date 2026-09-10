const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/admin/login', (req, res) => {
  res.render('admin/login', { error: null });
});

router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Wrong admin username or password.' });
});

router.post('/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/admin/login');
});

router.get('/admin', requireAdmin, (req, res) => {
  const data = db.readDb();
  const pendingDeposits = data.deposits.filter(d => d.status === 'pending').length;
  const pendingWithdrawals = data.withdrawals.filter(w => w.status === 'pending').length;
  res.render('admin/dashboard', {
    stats: {
      totalUsers: data.users.length,
      pendingDeposits,
      pendingWithdrawals,
      totalRooms: data.rooms.length,
      totalCoinsIssued: data.deposits
        .filter(d => d.status === 'approved')
        .reduce((sum, d) => sum + d.coins, 0)
    }
  });
});

// ---- Deposits ----
router.get('/admin/deposits', requireAdmin, (req, res) => {
  const data = db.readDb();
  const filter = req.query.status || 'pending';
  const deposits = data.deposits
    .filter(d => (filter === 'all' ? true : d.status === filter))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(d => {
      const user = data.users.find(u => u.id === d.userId);
      return { ...d, username: user ? user.username : 'Unknown user' };
    });
  res.render('admin/deposits', { deposits, filter });
});

router.post('/admin/deposits/:id/approve', requireAdmin, async (req, res) => {
  const data = db.readDb();
  const deposit = data.deposits.find(d => d.id === req.params.id);
  if (deposit && deposit.status === 'pending') {
    const user = data.users.find(u => u.id === deposit.userId);
    if (user) {
      user.coins += deposit.coins;
      deposit.status = 'approved';
      deposit.decidedAt = new Date().toISOString();
      await db.writeDb(data);
    }
  }
  res.redirect('/admin/deposits');
});

router.post('/admin/deposits/:id/reject', requireAdmin, async (req, res) => {
  const data = db.readDb();
  const deposit = data.deposits.find(d => d.id === req.params.id);
  if (deposit && deposit.status === 'pending') {
    deposit.status = 'rejected';
    deposit.decidedAt = new Date().toISOString();
    await db.writeDb(data);
  }
  res.redirect('/admin/deposits');
});

// ---- Rooms (custom rooms / tournaments) ----
router.get('/admin/rooms', requireAdmin, (req, res) => {
  const data = db.readDb();
  const rooms = data.rooms
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(r => ({ ...r, playerCount: r.players.length }));
  res.render('admin/rooms', { rooms, error: null });
});

router.post('/admin/rooms', requireAdmin, async (req, res) => {
  const { type, title, entryFee, maxPlayers, roomId, roomPassword, startTime } = req.body;
  const data = db.readDb();

  data.rooms.push({
    id: uuidv4(),
    type: type || '1v1',           // '1v1' | 'br'
    title: title || 'Untitled Room',
    entryFee: Number(entryFee) || 0,
    maxPlayers: Number(maxPlayers) || (type === 'br' ? 48 : 2),
    roomId: roomId || '',
    roomPassword: roomPassword || '',
    startTime: startTime || new Date().toISOString(),
    status: 'open', // open | closed | cancelled
    players: [],
    createdAt: new Date().toISOString()
  });

  await db.writeDb(data);
  res.redirect('/admin/rooms');
});

router.post('/admin/rooms/:id/update-credentials', requireAdmin, async (req, res) => {
  const { roomId, roomPassword } = req.body;
  const data = db.readDb();
  const room = data.rooms.find(r => r.id === req.params.id);
  if (room) {
    room.roomId = roomId || '';
    room.roomPassword = roomPassword || '';
    await db.writeDb(data);
  }
  res.redirect('/admin/rooms');
});

router.post('/admin/rooms/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body; // open | closed | cancelled
  const data = db.readDb();
  const room = data.rooms.find(r => r.id === req.params.id);
  if (room && ['open', 'closed', 'cancelled'].includes(status)) {
    room.status = status;
    await db.writeDb(data);
  }
  res.redirect('/admin/rooms');
});

// ---- Withdrawals ----
router.get('/admin/withdrawals', requireAdmin, (req, res) => {
  const data = db.readDb();
  const filter = req.query.status || 'pending';
  const withdrawals = data.withdrawals
    .filter(w => (filter === 'all' ? true : w.status === filter))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(w => {
      const user = data.users.find(u => u.id === w.userId);
      return { ...w, username: user ? user.username : 'Unknown user' };
    });
  res.render('admin/withdrawals', { withdrawals, filter });
});

// Approve: confirms you've sent the real money yourself outside the site.
// Coins were already deducted when the request was submitted.
router.post('/admin/withdrawals/:id/approve', requireAdmin, async (req, res) => {
  const data = db.readDb();
  const w = data.withdrawals.find(w => w.id === req.params.id);
  if (w && w.status === 'pending') {
    w.status = 'approved';
    w.decidedAt = new Date().toISOString();
    await db.writeDb(data);
  }
  res.redirect('/admin/withdrawals');
});

// Reject: refunds the held coins back to the user's balance.
router.post('/admin/withdrawals/:id/reject', requireAdmin, async (req, res) => {
  const data = db.readDb();
  const w = data.withdrawals.find(w => w.id === req.params.id);
  if (w && w.status === 'pending') {
    const user = data.users.find(u => u.id === w.userId);
    if (user) user.coins += w.coins;
    w.status = 'rejected';
    w.decidedAt = new Date().toISOString();
    await db.writeDb(data);
  }
  res.redirect('/admin/withdrawals');
});

// ---- Users (view / manually adjust coins) ----
router.get('/admin/users', requireAdmin, (req, res) => {
  const data = db.readDb();
  const users = data.users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render('admin/users', { users });
});

router.post('/admin/users/:id/adjust-coins', requireAdmin, async (req, res) => {
  const { amount } = req.body;
  const data = db.readDb();
  const user = data.users.find(u => u.id === req.params.id);
  if (user) {
    user.coins = Math.max(0, user.coins + Number(amount || 0));
    await db.writeDb(data);
  }
  res.redirect('/admin/users');
});

module.exports = router;
