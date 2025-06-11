# PumpStation

A real-time, decentralized memecoin coordination platform for transparent buy-ins, democratic voting, and automated exit strategies. Built with Next.js, Tailwind, Web3.js, and Socket.IO for seamless wallet integration, live updates, and community-driven crypto movements.

## Development

This repository now contains a simple voting demo with a Node.js backend and a small React frontend. The backend serves the frontend files so only the server needs to be started.

### Backend

The server exposes two routes and uses Socket.IO to push updates:

- `GET /api/votes` – returns current vote counts
- `POST /api/vote` – submit a vote once per wallet

From the `server` directory install dependencies and run the server:

```bash
npm install
npm start
```

Visiting `http://localhost:3001` loads the voting page which fetches the current votes and listens for live updates via Socket.IO.

### Tests

Run the API tests from the `server` directory:

```bash
npm test
```
