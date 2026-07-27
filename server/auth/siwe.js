'use strict';

/**
 * Wallet authentication: challenge, bind, verify, consume.
 *
 * What was wrong before
 * ---------------------
 * The previous implementation verified a signature over a module-level
 * constant:
 *
 *     const CONNECT_MESSAGE = 'Connect PumpStation';
 *     const recovered = ethers.verifyMessage(CONNECT_MESSAGE, signature);
 *
 * That proves the wallet signed the string "Connect PumpStation" at some point
 * in its life. It does not prove the wallet is connecting now, to this site, or
 * with the holder's knowledge. Any signature over that string — captured from a
 * log, a proxy, a browser extension, a screenshot, or any other site that
 * happened to use the same words — authenticates as that wallet forever. There
 * is no nonce, no expiry, no domain and no single-use property, so it is a
 * complete authentication bypass rather than a weakness.
 *
 * The founder's doctrine assigns wallets the job of "prove control, sign
 * actions, attribute transactions and eliminate anonymous institutional
 * commands". A static message proves none of those.
 *
 * How this works instead
 * ----------------------
 * EIP-4361 (Sign-In With Ethereum) structure, with four binding properties:
 *
 *   nonce      single-use, server-issued, consumed on first verification
 *   expiry     short TTL, so a captured signature dies quickly
 *   domain     the signature is worthless on any other origin
 *   address    the nonce is issued to one address and verifies for no other
 *
 * The server NEVER verifies a client-supplied message string. It rebuilds the
 * message from its own stored challenge and verifies against that. Accepting a
 * client's message text would reintroduce the original bug with extra steps: an
 * attacker would simply send the message their old signature matches.
 *
 * The signature-recovery function is injected rather than imported so this
 * module has no crypto dependency of its own and can be tested against both a
 * real implementation and a hostile stub.
 */

const crypto = require('node:crypto');

/** Short by design: a captured signature should expire before it is useful. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Bounded on purpose. An unbounded nonce store is a memory-exhaustion DoS that
 * an attacker triggers for free by requesting challenges in a loop.
 */
const DEFAULT_MAX_PENDING = 10000;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

function normalizeAddress(address) {
  if (typeof address !== 'string' || !ADDRESS_RE.test(address)) {
    throw new AuthError('bad_address', 'address is not a 0x-prefixed 20-byte hex string');
  }
  return address.toLowerCase();
}

/**
 * The exact bytes the wallet is asked to sign. EIP-4361 ordering.
 *
 * Every binding property appears in the signed text. A field that is checked by
 * the server but absent from the message is not bound to the signature and
 * gives no security.
 */
function buildMessage({ domain, address, statement, uri, chainId, nonce, issuedAt, expiresAt }) {
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: ${uri}`,
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join('\n');
}

/**
 * Single-use challenge store with TTL and a hard capacity bound.
 *
 * In-memory by design for this stage: a challenge that outlives a process
 * restart is a challenge that outlives an incident response. A multi-process
 * deployment needs a shared store, and that is a separate feature which must
 * pass the admission gate on its own terms — see governance/feature-control-matrix.json.
 */
class NonceStore {
  constructor({ ttlMs = DEFAULT_TTL_MS, maxPending = DEFAULT_MAX_PENDING, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.maxPending = maxPending;
    this.now = now;
    this.pending = new Map();
  }

  _sweep() {
    const t = this.now();
    for (const [nonce, record] of this.pending) {
      if (record.expiresAtMs <= t) this.pending.delete(nonce);
    }
  }

  /** Issue a challenge bound to one address. */
  issue(address) {
    this._sweep();
    if (this.pending.size >= this.maxPending) {
      throw new AuthError('capacity', 'too many pending challenges; try again shortly');
    }
    const normalized = normalizeAddress(address);
    const issuedAtMs = this.now();
    const expiresAtMs = issuedAtMs + this.ttlMs;
    const record = {
      nonce: crypto.randomBytes(16).toString('hex'),
      address: normalized,
      issuedAt: new Date(issuedAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    };
    this.pending.set(record.nonce, record);
    return record;
  }

  /**
   * Take a challenge out of the store. Removal happens before any validation so
   * a nonce cannot be retried, whatever the outcome. A nonce that survives a
   * failed attempt is a nonce an attacker can grind against.
   */
  consume(nonce) {
    const record = this.pending.get(nonce);
    if (!record) return null;
    this.pending.delete(nonce);
    if (record.expiresAtMs <= this.now()) return null;
    return record;
  }

  get size() {
    return this.pending.size;
  }
}

/**
 * Verifier bound to one origin.
 *
 * @param {object} options
 * @param {string} options.domain      this deployment's origin; signatures for
 *                                     any other domain are worthless here
 * @param {string} options.uri
 * @param {number} options.chainId
 * @param {function} options.verifyMessage  (message, signature) => address
 */
class WalletAuthenticator {
  constructor({
    domain,
    uri,
    chainId = 1,
    statement = 'Sign in to PumpStation. This proves you control this wallet. ' +
      'It does not approve any transaction, transfer or token allowance.',
    verifyMessage,
    store = new NonceStore(),
  }) {
    if (!domain) throw new AuthError('config', 'domain is required');
    if (typeof verifyMessage !== 'function') {
      throw new AuthError('config', 'verifyMessage function is required');
    }
    this.domain = domain;
    this.uri = uri || `https://${domain}`;
    this.chainId = chainId;
    this.statement = statement;
    this.verifyMessage = verifyMessage;
    this.store = store;
  }

  /** Step 1: hand out a single-use challenge for this address. */
  challenge(address) {
    const record = this.store.issue(address);
    return {
      nonce: record.nonce,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      message: buildMessage({
        domain: this.domain,
        address: record.address,
        statement: this.statement,
        uri: this.uri,
        chainId: this.chainId,
        nonce: record.nonce,
        issuedAt: record.issuedAt,
        expiresAt: record.expiresAt,
      }),
    };
  }

  /**
   * Step 2: verify a signature against a server-rebuilt message.
   *
   * @returns {{address: string}} the authenticated address
   * @throws {AuthError} on every failure path, with a distinguishing code
   */
  verify({ address, nonce, signature }) {
    if (typeof nonce !== 'string' || nonce.length === 0) {
      throw new AuthError('missing_nonce', 'nonce is required');
    }
    if (typeof signature !== 'string' || signature.length === 0) {
      throw new AuthError('missing_signature', 'signature is required');
    }
    const claimed = normalizeAddress(address);

    // Consumed first: expired, unknown and replayed nonces all land here, and
    // none of them gets a second attempt.
    const record = this.store.consume(nonce);
    if (!record) {
      throw new AuthError('unknown_or_expired_nonce',
        'challenge is unknown, already used, or expired');
    }
    if (record.address !== claimed) {
      throw new AuthError('address_mismatch',
        'challenge was issued to a different address');
    }

    // Rebuilt from stored state. The client's message text is never consulted.
    const message = buildMessage({
      domain: this.domain,
      address: record.address,
      statement: this.statement,
      uri: this.uri,
      chainId: this.chainId,
      nonce: record.nonce,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
    });

    let recovered;
    try {
      recovered = this.verifyMessage(message, signature);
    } catch (err) {
      throw new AuthError('bad_signature', 'signature could not be recovered');
    }
    if (typeof recovered !== 'string' || recovered.toLowerCase() !== record.address) {
      throw new AuthError('bad_signature', 'signature does not match the challenged address');
    }
    return { address: record.address };
  }
}

module.exports = {
  AuthError,
  NonceStore,
  WalletAuthenticator,
  buildMessage,
  normalizeAddress,
  DEFAULT_TTL_MS,
  DEFAULT_MAX_PENDING,
};
