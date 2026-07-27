'use strict';

/**
 * PumpStation API.
 *
 * Wallet authentication is a two-step challenge/response (server/auth/siwe.js).
 * The previous single-step version verified a signature over a fixed string and
 * is preserved unmodified at server/superseded/index.static-message.js as the
 * record of what was wrong and why this exists.
 *
 * Every middleware below is here because it closes a named threat. Nothing is
 * present for completeness.
 */

const path = require('node:path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const { WalletAuthenticator, AuthError } = require('./auth/siwe');
const { createRateLimiter } = require('./middleware/rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pumpstation';
const AUTH_DOMAIN = process.env.AUTH_DOMAIN || 'localhost:3001';
const AUTH_URI = process.env.AUTH_URI || `http://${AUTH_DOMAIN}`;
const CHAIN_ID = Number(process.env.CHAIN_ID || 1);

/**
 * Origin allowlist. The previous version called `cors()` with no arguments,
 * which reflects any origin and lets any site on the internet drive this API
 * with a user's credentials. An empty allowlist denies cross-origin requests
 * rather than falling back to permissive.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Same-origin and non-browser callers send no Origin header.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('origin not allowed'), false);
  },
  credentials: true,
}));

/**
 * Security headers, set directly to avoid adding a dependency for six lines.
 * The CSP matters most: it is the control that stops an injected script from
 * becoming a wallet drainer.
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    // No third-party origins and no inline scripts: the client carries its own
    // JS and CSS, so an injected <script> has nowhere to load from.
    "script-src 'self'; " +
    "style-src 'self'; " +
    "connect-src 'self'; " +
    "img-src 'self' data:; " +
    "object-src 'none'; " +
    "base-uri 'none'; " +
    "frame-ancestors 'none'",
  );
  next();
});

// Bounded body size: an unbounded JSON parser is a free memory-exhaustion DoS.
app.use(express.json({ limit: '16kb' }));

// __dirname-relative. The previous '../client' resolved against the process
// working directory, so the files served depended on where node was started.
app.use(express.static(path.join(__dirname, '..', 'client')));

mongoose.connect(MONGODB_URI);

const userSchema = new mongoose.Schema({
  address: { type: String, unique: true, required: true, lowercase: true, index: true },
  email: String,
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: Date,
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

const authenticator = new WalletAuthenticator({
  domain: AUTH_DOMAIN,
  uri: AUTH_URI,
  chainId: CHAIN_ID,
  verifyMessage: ethers.verifyMessage,
});

// Challenge issuance is cheap per request but allocates state, so it is limited
// more tightly than verification.
const challengeLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const verifyLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/** Conservative, and only used to decide whether to store the value at all. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Step 1 — request a single-use challenge. */
app.post('/api/auth/challenge', challengeLimiter, (req, res) => {
  try {
    const { address } = req.body || {};
    return res.json(authenticator.challenge(address));
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.code === 'capacity' ? 503 : 400)
        .json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: 'internal error' });
  }
});

/** Step 2 — return the signature over the challenge. */
app.post('/api/connect-wallet', verifyLimiter, async (req, res) => {
  const { address, nonce, signature, email } = req.body || {};

  let authenticated;
  try {
    authenticated = authenticator.verify({ address, nonce, signature });
  } catch (err) {
    if (err instanceof AuthError) {
      // Distinguishable to the client, because a user who cannot tell an
      // expired challenge from a rejected one will retry blindly. The codes
      // reveal nothing an attacker does not already know.
      return res.status(401).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: 'internal error' });
  }

  try {
    const update = { lastLoginAt: new Date() };
    if (typeof email === 'string' && EMAIL_RE.test(email)) {
      update.email = email;
    }
    const user = await User.findOneAndUpdate(
      { address: authenticated.address },
      { $set: update, $setOnInsert: { address: authenticated.address } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return res.json({
      success: true,
      user: { address: user.address, email: user.email, createdAt: user.createdAt },
    });
  } catch (err) {
    // Storage failure must not be reported as an authentication failure: the
    // two have different responses and conflating them hides outages.
    return res.status(500).json({ error: 'storage error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mongo: mongoose.connection.readyState === 1 });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (ALLOWED_ORIGINS.length === 0) {
      console.warn('ALLOWED_ORIGINS is empty: all cross-origin requests will be denied');
    }
  });
}

module.exports = { app, authenticator, User };
