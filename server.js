require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const db = require('./config/db');
const { attachUser, requireUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const depositRoutes = require('./routes/deposit');
const withdrawRoutes = require('./routes/withdraw');
const tournamentRoutes = require('./routes/tournament');
const adminRoutes = require('./routes/admin');

db.ensureDb();

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'nexus-og-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
  })
);

app.use(attachUser(db));

// Site name available in all views
app.use((req, res, next) => {
  res.locals.siteName = 'Nexus OG';
  next();
});

app.get('/', (req, res) => {
  const data = db.readDb();
  const openRooms = data.rooms
    .filter(r => r.status === 'open')
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .slice(0, 4);
  res.render('home', { openRooms });
});

app.get('/dashboard', requireUser, (req, res) => {
  const data = db.readDb();
  const user = data.users.find(u => u.id === req.session.userId);
  const myDeposits = data.deposits
    .filter(d => d.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  const myRooms = data.rooms.filter(r => r.players.includes(user.id));
  res.render('dashboard', { user, myDeposits, myRooms });
});

app.use('/', authRoutes);
app.use('/', depositRoutes);
app.use('/', withdrawRoutes);
app.use('/', tournamentRoutes);
app.use('/', adminRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Nexus OG running at http://localhost:${PORT}`);
});
