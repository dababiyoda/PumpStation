# PumpStation
A real-time, decentralized memecoin coordination platform for transparent buy-ins, democratic voting, and automated exit strategies. Built with Next.js, Tailwind, Web3.js, and Socket.IO for seamless wallet integration, live updates, and community-driven crypto movements.

## Development Setup

### Backend
1. Navigate to the `server` directory and install dependencies:
   ```bash
   cd server
   npm install
   ```
2. Copy `.env.example` to `.env` and adjust `MONGODB_URI` for your database.
3. Start the server in development mode:
   ```bash
   npm run dev
   ```
   The API will run on port `3001` by default.

### Frontend
1. Navigate to the `client` folder and install dependencies if needed:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   The demo page will open in your browser. Use MetaMask to connect your wallet and optionally submit an email. The page posts the wallet address and signature to `/api/connect-wallet`.

### MongoDB Setup
Ensure MongoDB is running locally or provide a cloud connection string in `.env`.

### Troubleshooting
- Enable CORS if you see network errors.
- Check MetaMask for pending signature requests when connecting the wallet.
