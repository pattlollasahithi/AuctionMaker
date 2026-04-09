import { useEffect, useState } from "react";
import "./App.css";
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

function App() {
  const [highestBid, setHighestBid] = useState(0);
  const [bid, setBid] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const [ended, setEnded] = useState(false);
  const [message, setMessage] = useState("");
  const [currentBids, setCurrentBids] = useState([]);
  const [previousBids, setPreviousBids] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHighest = async () => {
    try {
      const response = await fetch("http://localhost:5000/highest-bid");
      const data = await response.json();
      setHighestBid(data.highestBid || 0);
    } catch (error) {
      console.error("Failed to fetch highest bid", error);
    }
  };

  // Load previous history and start a fresh current auction on refresh
  useEffect(() => {
    const storedPrevious = JSON.parse(localStorage.getItem("previousBids")) || [];
    const storedCurrent = JSON.parse(localStorage.getItem("currentBids")) || [];

    const normalizeEntry = (entry) => {
      if (entry.date && entry.time) {
        return { amount: entry.amount, date: entry.date, time: entry.time };
      }

      const timestamp = new Date(entry.time || Date.now());
      return {
        amount: entry.amount,
        date: timestamp.toLocaleDateString(),
        time: timestamp.toLocaleTimeString(),
      };
    };

    // Filter out bids older than 1 day
    const isExpired = (entry) => {
      const entryDate = new Date(`${entry.date} ${entry.time}`);
      const now = new Date();
      const oneDayMs = 24 * 60 * 60 * 1000;
      return (now - entryDate) > oneDayMs;
    };

    const normalizedPrevious = storedPrevious.map(normalizeEntry).filter(entry => !isExpired(entry));
    const normalizedCurrent = storedCurrent.map(normalizeEntry).filter(entry => !isExpired(entry));

    const mergedPrevious = [...normalizedCurrent, ...normalizedPrevious];

    setPreviousBids(mergedPrevious);
    setCurrentBids([]);
    localStorage.setItem("previousBids", JSON.stringify(mergedPrevious));
    localStorage.setItem("currentBids", JSON.stringify([]));
    setHighestBid(0);

    const resetAuctionOnLoad = async () => {
      try {
        await fetch("http://localhost:5000/reset", { method: "POST" });
        setEnded(false);
      } catch (error) {
        console.error("Failed to reset auction on load", error);
      }
    };

    resetAuctionOnLoad();

    // WebSocket event listeners
    socket.on('newBid', (bidData) => {
      const newBid = {
        amount: bidData.amount,
        date: bidData.date,
        time: bidData.time
      };

      setCurrentBids(prev => [newBid, ...prev]);
      setHighestBid(bidData.amount);
      setMessage("New bid received!");
      setTimeout(() => setMessage(""), 3000);
    });

    return () => {
      socket.off('newBid');
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("http://localhost:5000/status");
      const data = await response.json();
      setTimeLeft(Math.floor(data.timeLeft / 1000));
      setEnded(data.ended);
      if (data.ended) {
        await fetchHighest();
      }
    } catch (error) {
      console.error("Failed to fetch auction status", error);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchHighest();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Place Bid
  const placeBid = async () => {
    const amount = Number(bid);

    if (!amount || amount <= highestBid) {
      setMessage("Please enter a valid higher bid.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("http://localhost:5000/bid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (data.success) {
        const now = new Date();
        const updatedCurrentBids = [
          {
            amount,
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
          },
          ...currentBids,
        ];

        setCurrentBids(updatedCurrentBids);
        setHighestBid(amount);
        setMessage("Bid placed successfully!");
        setBid("");

        localStorage.setItem("currentBids", JSON.stringify(updatedCurrentBids));
      } else {
        setMessage(data.message || "Failed to place bid");
      }
    } catch (error) {
      setMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="brand-panel">
        <span className="brand-tag">Live</span>
        <h1>Online Auction</h1>
        <p className="brand-copy">Place your bid before the timer ends. The highest offer wins.</p>
      </div>

      <div className="content-grid">
        <section className="card auction-card">
          <div className="card-header">
            <h2>Current Bid</h2>
            <span className={`status-badge ${ended ? "ended" : "active"}`}>
              {ended ? "Ended" : "In Progress"}
            </span>
          </div>

          <div className="bid-display">₹{highestBid}</div>
          <div className="timer-text">
            {!ended ? `${timeLeft} sec remaining` : "Auction closed"}
          </div>

          <div className="bid-controls">
            <label htmlFor="bid-input">Your bid</label>
            <input
              id="bid-input"
              type="number"
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              placeholder="Enter amount"
              disabled={ended}
            />
            <button className="primary-button" onClick={placeBid} disabled={ended || isLoading}>
              {isLoading ? "Placing Bid..." : "Place Bid"}
            </button>
          </div>

          {message && <div className="message-box">{message}</div>}
        </section>

        <aside className="card history-card">
          <div className="card-header">
            <h2>Current Auction History</h2>
            <span>{currentBids.length} entries</span>
          </div>

          <div className="history-list">
            {currentBids.length === 0 ? (
              <div className="empty-state">No bids placed yet for this auction.</div>
            ) : (
              currentBids.map((bidEntry, index) => (
                <div key={index} className="history-item">
                  <div>
                    <div className="history-amount">₹{bidEntry.amount}</div>
                    <small>{bidEntry.date} · {bidEntry.time}</small>
                  </div>
                </div>
              ))
            )}
          </div>

          {previousBids.length > 0 && (
            <>
              <div className="card-divider" />
              <div className="card-header">
                <h2>Previous Auction History</h2>
                <span>{previousBids.length} entries</span>
              </div>
              <div className="history-list">
                {previousBids.map((bidEntry, index) => (
                  <div key={`prev-${index}`} className="history-item history-item-muted">
                    <div>
                      <div className="history-amount">₹{bidEntry.amount}</div>
                      <small>{bidEntry.date} · {bidEntry.time}</small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;