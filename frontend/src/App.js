import { useEffect, useState } from "react";

function App() {
  const [bid, setBid] = useState("");
  const [highest, setHighest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ended, setEnded] = useState(false);
  const [message, setMessage] = useState("");
  const [bids, setBids] = useState([]);

  const fetchHighest = async () => {
    const res = await fetch("http://localhost:5000/highest-bid");
    const data = await res.json();
    setHighest(data.highestBid);
  };

  const fetchStatus = async () => {
    const res = await fetch("http://localhost:5000/status");
    const data = await res.json();
    setTimeLeft(Math.floor(data.timeLeft / 1000));
    setEnded(data.ended);
  };

  const fetchBids = async () => {
    const res = await fetch("http://localhost:5000/bids");
    const data = await res.json();
    setBids(data);
  };

  const placeBid = async () => {
    const res = await fetch("http://localhost:5000/bid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: Number(bid) }),
    });

    const data = await res.json();
    setMessage(data.message);
    setBid("");
    fetchHighest();
    fetchBids();
  };

  useEffect(() => {
    fetchHighest();
    fetchStatus();
    fetchBids();

    const interval = setInterval(() => {
      fetchStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "30px",
      padding: "20px"
    }}>
      
      {/* Auction Box */}
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "10px",
        boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        textAlign: "center",
        width: "300px"
      }}>
        <h1>Online Auction</h1>

        <h2 style={{ color: "green" }}>₹{highest}</h2>

        <p>
           {timeLeft} sec {ended && "(Ended)"}
        </p>

        {!ended && (
          <>
            <input
              type="number"
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              placeholder="Enter bid"
              style={{ padding: "8px", width: "100%" }}
            />
            <br /><br />
            <button
              onClick={placeBid}
              style={{
                padding: "10px",
                width: "100%",
                background: "blue",
                color: "white",
                border: "none",
                borderRadius: "5px"
              }}
            >
              Place Bid
            </button>
          </>
        )}

        <p>{message}</p>
      </div>

      {/* Bid History */}
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "10px",
        boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        width: "300px",
        maxHeight: "400px",
        overflowY: "auto"
      }}>
        <h3>Bid History</h3>

        {bids.length === 0 ? (
          <p>No bids yet</p>
        ) : (
          bids.map((b) => (
            <div key={b.id} style={{
              borderBottom: "1px solid #ddd",
              padding: "5px"
            }}>
              ₹{b.amount}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;