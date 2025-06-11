import React, { useState, useEffect } from 'react';

function CoinPrice({ coinId, vsCurrency }) {
  const [price, setPrice] = useState(null);

  useEffect(() => {
    async function fetchPrice() {
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data[coinId] && data[coinId][vsCurrency]) {
          setPrice(data[coinId][vsCurrency]);
        }
      } catch (err) {
        console.error('Failed to fetch price:', err);
      }
    }

    fetchPrice();
    const id = setInterval(fetchPrice, 5000);
    return () => clearInterval(id);
  }, [coinId, vsCurrency]);

  if (price === null) {
    return <div>Loading price...</div>;
  }

  return (
    <div>
      Current {coinId} price: {price} {vsCurrency.toUpperCase()}
    </div>
  );
}

function CoinPriceTracker() {
  const [coinId, setCoinId] = useState('bitcoin');
  const [vsCurrency, setVsCurrency] = useState('usd');

  return (
    <div>
      <h1>Live Coin Price Tracker</h1>
      <label>
        Coin ID:
        <input
          value={coinId}
          onChange={e => setCoinId(e.target.value.toLowerCase())}
        />
      </label>
      <label style={{ marginLeft: '1em' }}>
        Currency:
        <input
          value={vsCurrency}
          onChange={e => setVsCurrency(e.target.value.toLowerCase())}
        />
      </label>
      <div style={{ marginTop: '1em' }}>
        <CoinPrice coinId={coinId} vsCurrency={vsCurrency} />
      </div>
    </div>
  );
}

export default CoinPriceTracker;
