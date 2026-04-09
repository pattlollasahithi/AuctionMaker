const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

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

// Dynamic auction time (resets)
let auctionEndTime;

const resetAuction = () => {
  auctionEndTime = new Date().getTime() + 2 * 60 * 1000;

  // Optional: clear old bids
  db.run(`DELETE FROM bids`);
};

// Call once initially
resetAuction();

// API to reset auction (called from frontend refresh)
app.post('/reset', (req, res) => {
  resetAuction();
  res.json({ message: 'Auction reset' });
});

// Get highest bid
app.get('/highest-bid', (req, res) => {
  db.get(`SELECT MAX(amount) as highest FROM bids`, (err, row) => {
    res.json({ highestBid: row.highest || 0 });
  });
});

// Place bid
app.post('/bid', (req, res) => {
  const { amount } = req.body;

  if (!amount || isNaN(amount) || amount <= 0 || amount > 1000000) {
    return res.json({
      success: false,
      message: 'Enter valid bid (1 - 10,00,000)',
    });
  }

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
      () => {
        // Emit real-time update to all connected clients
        io.emit('newBid', {
          amount,
          time: new Date().toLocaleTimeString(),
          date: new Date().toLocaleDateString()
        });

        res.json({ success: true, message: 'Bid placed successfully' });
      }
    );
  });
});

// Get bid history
app.get('/bids', (req, res) => {
  db.all(`SELECT * FROM bids ORDER BY amount DESC`, (err, rows) => {
    res.json(rows);
  });
});

// Status
app.get('/status', (req, res) => {
  const currentTime = new Date().getTime();

  res.json({
    ended: currentTime > auctionEndTime,
    timeLeft: Math.max(0, auctionEndTime - currentTime),
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});