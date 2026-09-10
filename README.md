# Nexus OG

A Free Fire tournament & custom room website: players deposit rupees via JazzCash/SadaPay, upload a payment screenshot, you approve it from an admin page and coins are credited, then players spend coins to join 1v1 or Battle Royale custom rooms. Players can also request withdrawals to cash out coins back to real money, which you approve and pay out yourself.

## What's included

- Player accounts (register/login)
- Deposit page showing your JazzCash number and SadaPay IBAN, with screenshot upload
- Admin page to approve/reject deposits (approving credits coins automatically)
- Withdrawal requests: players request a cash-out, coins are held immediately, you approve once you've sent the real money (or reject to refund)
- Custom rooms: admin creates 1v1 or BR rooms with an entry fee, players join with coins, room ID/password reveal only to players who joined
- No external database — everything is stored in a single `data/db.json` file. Good for a small/medium site; you can swap in a real database later without changing much else.

## Running it locally

You need [Node.js](https://nodejs.org) installed (v18 or newer).

```bash
cd nexus-og
npm install
cp .env.example .env
```

Open `.env` and check the values — your JazzCash number and SadaPay IBAN are already filled in, but **you must change `ADMIN_PASSWORD` and `SESSION_SECRET`** before putting this online.

```bash
npm start
```

Visit `http://localhost:3000`. The admin panel is at `http://localhost:3000/admin/login`, using the `ADMIN_USERNAME` / `ADMIN_PASSWORD` from your `.env`.

## Putting it on GitHub

`.env` and `data/db.json` are already in `.gitignore` so your admin password and live user data never get committed. Push the rest as normal:

```bash
git init
git add .
git commit -m "Nexus OG"
git remote add origin <your-repo-url>
git push -u origin main
```

## Hosting it for real

This needs a Node.js host that keeps a process running (not a static host like GitHub Pages), for example Render, Railway, Fly.io, or a VPS. Whichever you pick:

1. Set the environment variables from `.env.example` in the host's dashboard (don't upload your `.env` file itself).
2. Make sure the `data/` folder is on persistent storage — some hosts wipe the filesystem on every deploy, which would erase your users, deposits, and rooms. If your host does this, you'll need to add a small real database later (ask me and I can help swap this in).
3. Uploaded screenshots go to `public/uploads/screenshots/` — same persistence note applies.

## Day-to-day use

- **New deposit**: player submits it → shows as "pending" under Admin → Deposits → you check the screenshot against your JazzCash/SadaPay activity → Approve (coins added automatically) or Reject.
- **New withdrawal**: player requests it, their coins are held right away → shows under Admin → Withdrawals → once you've sent the real money yourself, click "Mark paid". If you don't want to pay it, click "Reject & refund" and their coins go back.
- **Rooms**: Admin → Rooms → create a 1v1 or BR room with an entry fee and start time. Add the actual in-game Room ID/Password any time (even after players join) — it shows up on their "My Rooms" page automatically.
- **Manual coin adjustment**: Admin → Players lets you add or remove coins from any account directly, for refunds or corrections.

## A note on the legal side

Collecting money for entry fees / prizes and crediting it as in-game currency may fall under gambling or payment-service regulations depending on your country. Worth checking local rules before opening this up publicly — this isn't legal advice, just a heads-up.
