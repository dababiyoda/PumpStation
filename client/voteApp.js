const { useState, useEffect } = React;

function VoteApp() {
  const [votes, setVotes] = useState({});
  const [wallet, setWallet] = useState('');
  const [coin, setCoin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/votes')
      .then(res => res.json())
      .then(data => setVotes(data));

    const socket = io();
    socket.on('votes', data => setVotes(data));
    return () => socket.disconnect();
  }, []);

  const submitVote = () => {
    setError('');
    fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, coin })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          setCoin('');
        }
      });
  };

  return (
    React.createElement('div', null,
      React.createElement('h1', null, 'Memecoin Votes'),
      Object.keys(votes).map(c =>
        React.createElement('div', { key: c, className: 'coin' }, `${c}: ${votes[c]}`)
      ),
      React.createElement('div', null,
        React.createElement('input', {
          placeholder: 'Wallet Address',
          value: wallet,
          onChange: e => setWallet(e.target.value)
        }),
        React.createElement('input', {
          placeholder: 'Coin Name',
          value: coin,
          onChange: e => setCoin(e.target.value)
        }),
        React.createElement('button', { onClick: submitVote }, 'Vote'),
        error && React.createElement('div', { style: { color: 'red' } }, error)
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(VoteApp));
