const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

const router = express.Router();

router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password) {
    return res.render('register', { error: 'Please fill in all fields.' });
  }
  if (password !== confirmPassword) {
    return res.render('register', { error: 'Passwords do not match.' });
  }
  if (password.length < 6) {
    return res.render('register', { error: 'Password must be at least 6 characters.' });
  }

  const data = db.readDb();
  const exists = data.users.find(
    u => u.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (exists) {
    return res.render('register', { error: 'That username is already taken.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    username: username.trim(),
    password: hashed,
    coins: 0,
    createdAt: new Date().toISOString()
  };
  data.users.push(newUser);
  await db.writeDb(data);

  req.session.userId = newUser.id;
  res.redirect('/dashboard');
});

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const data = db.readDb();
  const user = data.users.find(
    u => u.username.toLowerCase() === (username || '').trim().toLowerCase()
  );

  if (!user) {
    return res.render('login', { error: 'Invalid username or password.' });
  }
  const match = await bcrypt.compare(password || '', user.password);
  if (!match) {
    return res.render('login', { error: 'Invalid username or password.' });
  }

  req.session.userId = user.id;
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
