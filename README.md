# PumpStation
A real-time, decentralized memecoin coordination platform for transparent buy-ins, democratic voting, and automated exit strategies. Built with Next.js, Tailwind, Web3.js, and Socket.IO for seamless wallet integration, live updates, and community-driven crypto movements.

## Development Setup

### Backend
1. Navigate to the `server` directory and install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in `server` with `MONGODB_URI` pointing to your MongoDB instance.
3. Start the server:
   ```bash
   npm start
   ```
   The API will run on port `3001` by default.

### Frontend
Open `client/index.html` in your browser. Use MetaMask to connect your wallet and optionally submit an email. The page posts the wallet address to `/api/connect-wallet`.
