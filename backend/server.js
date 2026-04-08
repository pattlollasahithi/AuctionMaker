const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Create DB
const db = new sqlite3.Database('./auction.db');

// Create table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount INTEGER,
      time TEXT
    )
  `);
});

// Auction end time (2 minutes)
const auctionEndTime = new Date().getTime() + 2 * 60 * 1000;

// API: Get highest bid
app.get('/highest-bid', (req, res) => {
  db.get(`SELECT MAX(amount) as highest FROM bids`, (err, row) => {
    if (err) return res.status(500).send(err);
    res.json({ highestBid: row.highest || 0 });
  });
});

// API: Place bid
app.post('/bid', (req, res) => {
  const { amount } = req.body;

  const currentTime = new Date().getTime();

  if (currentTime > auctionEndTime) {
    return res.json({ success: false, message: 'Auction ended' });
  }

  db.get(`SELECT MAX(amount) as highest FROM bids`, (err, row) => {
    const highest = row.highest || 0;

    if (amount <= highest) {
      return res.json({
        success: false,
        message: 'Bid must be higher than current highest',
      });
    }

    db.run(
      `INSERT INTO bids (amount, time) VALUES (?, ?)`,
      [amount, new Date().toISOString()],
      err => {
        if (err) return res.status(500).send(err);

        res.json({ success: true, message: 'Bid placed successfully' });
      }
    );
  });
});

//  NEW API: Get all bids (latest first)
app.get('/bids', (req, res) => {
  db.all(
    `SELECT * FROM bids ORDER BY amount DESC`,
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
});

// API: Auction status
app.get('/status', (req, res) => {
  const currentTime = new Date().getTime();

  res.json({
    ended: currentTime > auctionEndTime,
    timeLeft: Math.max(0, auctionEndTime - currentTime),
  });
});

app.listen(5000, () => {
  console.log('Server running on port 5000');
});