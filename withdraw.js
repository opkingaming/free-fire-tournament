const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

router.get('/withdraw', requireUser, (req, res) => {
  const data = db.readDb();
  const user = data.users.find(u => u.id === req.session.userId);
  const myWithdrawals = data.withdrawals
    .filter(w => w.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.render('withdraw', { error: null, success: null, user, myWithdrawals });
});

router.post('/withdraw', requireUser, async (req, res) => {
  const { coins, method, accountNumber, accountName } = req.body;
  const data = db.readDb();
  const user = data.users.find(u => u.id === req.session.userId);
  const myWithdrawals = data.withdrawals
    .filter(w => w.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const coinsNum = Number(coins);

  if (!coinsNum || coinsNum <= 0) {
    return res.render('withdraw', { error: 'Enter a valid coin amount.', success: null, user, myWithdrawals });
  }
  if (!method) {
    return res.render('withdraw', { error: 'Select a payout method.', success: null, user, myWithdrawals });
  }
  if (!accountNumber) {
    return res.render('withdraw', { error: 'Enter the account number / IBAN to receive your payout.', success: null, user, myWithdrawals });
  }
  if (coinsNum > user.coins) {
    return res.render('withdraw', { error: `You only have ${user.coins} coins available.`, success: null, user, myWithdrawals });
  }

  // Hold the coins immediately so they can't be spent or withdrawn twice
  // while the request is pending. If rejected, they're refunded.
  user.coins -= coinsNum;

  data.withdrawals.push({
    id: uuidv4(),
    userId: user.id,
    coins: coinsNum,
    method,
    accountNumber,
    accountName: accountName || '',
    status: 'pending', // pending | approved | rejected
    createdAt: new Date().toISOString(),
    decidedAt: null
  });

  await db.writeDb(data);

  const refreshed = db.readDb();
  const refreshedUser = refreshed.users.find(u => u.id === req.session.userId);
  const updatedWithdrawals = refreshed.withdrawals
    .filter(w => w.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.render('withdraw', {
    error: null,
    success: 'Withdrawal request submitted. Your coins are on hold until it is approved and paid out.',
    user: refreshedUser,
    myWithdrawals: updatedWithdrawals
  });
});

module.exports = router;
