const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'screenshots');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, webp) are allowed.'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.get('/deposit', requireUser, (req, res) => {
  const data = db.readDb();
  const myDeposits = data.deposits
    .filter(d => d.userId === req.session.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.render('deposit', {
    error: null,
    success: null,
    myDeposits,
    payment: {
      jazzcashNumber: process.env.JAZZCASH_NUMBER,
      jazzcashName: process.env.JAZZCASH_NAME,
      sadapayIban: process.env.SADAPAY_IBAN,
      sadapayName: process.env.SADAPAY_NAME,
      coinRate: Number(process.env.COIN_RATE || 1)
    }
  });
});

router.post('/deposit', requireUser, (req, res) => {
  upload.single('screenshot')(req, res, async (err) => {
    const data = db.readDb();
    const myDeposits = data.deposits
      .filter(d => d.userId === req.session.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const paymentInfo = {
      jazzcashNumber: process.env.JAZZCASH_NUMBER,
      jazzcashName: process.env.JAZZCASH_NAME,
      sadapayIban: process.env.SADAPAY_IBAN,
      sadapayName: process.env.SADAPAY_NAME,
      coinRate: Number(process.env.COIN_RATE || 1)
    };

    if (err) {
      return res.render('deposit', { error: err.message, success: null, myDeposits, payment: paymentInfo });
    }

    const { amount, method, senderNumber } = req.body;
    const amountNum = Number(amount);

    if (!amountNum || amountNum <= 0) {
      return res.render('deposit', { error: 'Enter a valid amount.', success: null, myDeposits, payment: paymentInfo });
    }
    if (!method) {
      return res.render('deposit', { error: 'Select a payment method.', success: null, myDeposits, payment: paymentInfo });
    }
    if (!req.file) {
      return res.render('deposit', { error: 'Please upload your payment screenshot.', success: null, myDeposits, payment: paymentInfo });
    }

    const deposit = {
      id: uuidv4(),
      userId: req.session.userId,
      amount: amountNum,
      coins: Math.floor(amountNum * paymentInfo.coinRate),
      method,
      senderNumber: senderNumber || '',
      screenshot: `/uploads/screenshots/${req.file.filename}`,
      status: 'pending', // pending | approved | rejected
      createdAt: new Date().toISOString(),
      decidedAt: null
    };

    data.deposits.push(deposit);
    await db.writeDb(data);

    const refreshed = db.readDb();
    const updatedDeposits = refreshed.deposits
      .filter(d => d.userId === req.session.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render('deposit', {
      error: null,
      success: 'Your deposit request was submitted. Coins will be added once the admin verifies your payment.',
      myDeposits: updatedDeposits,
      payment: paymentInfo
    });
  });
});

module.exports = router;
