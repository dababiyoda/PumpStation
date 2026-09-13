'use strict';

/**
 * Wallet authentication security tests.
 *
 * These use real secp256k1 keys and real signatures. Most of them are attacks:
 * each one is a way the previous implementation could be authenticated as
 * somebody else's wallet, and each must now fail with a specific error code.
 *
 * The most important test in this file is
 * `rejects a signature over the old static connect message`. That is the exact
 * bug being fixed, kept as a permanent regression guard.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { ethers } = require('ethers');

const {
  AuthError,
  NonceStore,
  WalletAuthenticator,
  buildMessage,
} = require('../auth/siwe');

const DOMAIN = 'pumpstation.example';
const OTHER_DOMAIN = 'evil.example';

function authenticator(overrides = {}) {
  return new WalletAuthenticator({
    domain: DOMAIN,
    uri: `https://${DOMAIN}`,
    chainId: 1,
    verifyMessage: ethers.verifyMessage,
    ...overrides,
  });
}

async function login(auth, wallet) {
  const challenge = auth.challenge(wallet.address);
  const signature = await wallet.signMessage(challenge.message);
  return { challenge, signature };
}

test('happy path: a fresh challenge signed by its address authenticates', async () => {
  const auth = authenticator();
  const wallet = ethers.Wallet.createRandom();
  const { challenge, signature } = await login(auth, wallet);

  const result = auth.verify({
    address: wallet.address,
    nonce: challenge.nonce,
    signature,
  });
  assert.equal(result.address, wallet.address.toLowerCase());
});

test('REGRESSION: rejects a signature over the old static connect message', async () => {
  // The previous server verified exactly this string, forever, for anyone.
  const auth = authenticator();
  const wallet = ethers.Wallet.createRandom();
  const staleSignature = await wallet.signMessage('Connect PumpStation');
  const challenge = auth.challenge(wallet.address);

  assert.throws(
    () => auth.verify({
      address: wallet.address,
      nonce: challenge.nonce,
      signature: staleSignature,
    }),
    (err) => err instanceof AuthError && err.code === 'bad_signature',
  );
});

test('a valid signature cannot be replayed: the nonce is single-use', async () => {
  const auth = authenticator();
  const wallet = ethers.Wallet.createRandom();
  const { challenge, signature } = await login(auth, wallet);

  auth.verify({ address: wallet.address, nonce: challenge.nonce, signature });

  assert.throws(
    () => auth.verify({ address: wallet.address, nonce: challenge.nonce, signature }),
    (err) => err.code === 'unknown_or_expired_nonce',
  );
});

test('an expired challenge is rejected even with a correct signature', async () => {
  let clock = 1_000_000;
  const store = new NonceStore({ ttlMs: 60_000, now: () => clock });
  const auth = authenticator({ store });
  const wallet = ethers.Wallet.createRandom();
  const challenge = auth.challenge(wallet.address);
  const signature = await wallet.signMessage(challenge.message);

  clock += 60_001;

  assert.throws(
    () => auth.verify({ address: wallet.address, nonce: challenge.nonce, signature }),
    (err) => err.code === 'unknown_or_expired_nonce',
  );
});

test('a signature harvested for another domain does not authenticate here', async () => {
  // Same wallet, same nonce value, signed for a different origin.
  const store = new NonceStore();
  const here = authenticator({ store });
  const elsewhere = authenticator({ domain: OTHER_DOMAIN, uri: `https://${OTHER_DOMAIN}`, store });
  const wallet = ethers.Wallet.createRandom();

  const challenge = here.challenge(wallet.address);
  // The victim signs what the hostile site asked for, reusing this nonce.
  const foreignMessage = buildMessage({
    domain: OTHER_DOMAIN,
    address: wallet.address.toLowerCase(),
    statement: elsewhere.statement,
    uri: elsewhere.uri,
    chainId: 1,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
  });
  const signature = await wallet.signMessage(foreignMessage);

  assert.throws(
    () => here.verify({ address: wallet.address, nonce: challenge.nonce, signature }),
    (err) => err.code === 'bad_signature',
  );
});

test('a challenge issued to one address does not verify for another', async () => {
  const auth = authenticator();
  const victim = ethers.Wallet.createRandom();
  const attacker = ethers.Wallet.createRandom();
  const challenge = auth.challenge(victim.address);
  const signature = await attacker.signMessage(challenge.message);

  assert.throws(
    () => auth.verify({ address: attacker.address, nonce: challenge.nonce, signature }),
    (err) => err.code === 'address_mismatch',
  );
});

test('another wallet signing the correct message does not authenticate', async () => {
  const auth = authenticator();
  const victim = ethers.Wallet.createRandom();
  const attacker = ethers.Wallet.createRandom();
  const challenge = auth.challenge(victim.address);
  const signature = await attacker.signMessage(challenge.message);

  assert.throws(
    // Claiming to be the victim, holding the attacker's signature.
    () => auth.verify({ address: victim.address, nonce: challenge.nonce, signature }),
    (err) => err.code === 'bad_signature',
  );
});

test('an unknown nonce is rejected', async () => {
  const auth = authenticator();
  const wallet = ethers.Wallet.createRandom();
  const { signature } = await login(auth, wallet);

  assert.throws(
    () => auth.verify({ address: wallet.address, nonce: 'deadbeef', signature }),
    (err) => err.code === 'unknown_or_expired_nonce',
  );
});

test('a failed attempt consumes the nonce, so it cannot be ground against', async () => {
  const auth = authenticator();
  const wallet = ethers.Wallet.createRandom();
  const challenge = auth.challenge(wallet.address);

  assert.throws(
    () => auth.verify({ address: wallet.address, nonce: challenge.nonce, signature: '0xnot-a-signature' }),
    (err) => err.code === 'bad_signature',
  );

  // The real signature now fails too: one challenge, one attempt.
  const signature = await wallet.signMessage(challenge.message);
  assert.throws(
    () => auth.verify({ address: wallet.address, nonce: challenge.nonce, signature }),
    (err) => err.code === 'unknown_or_expired_nonce',
  );
});

test('malformed addresses are refused before any crypto runs', () => {
  const auth = authenticator();
  for (const bad of ['', 'nope', '0x123', null, undefined, '0x' + 'z'.repeat(40)]) {
    assert.throws(() => auth.challenge(bad), (err) => err.code === 'bad_address');
  }
});

test('the nonce store is bounded, so challenge requests cannot exhaust memory', () => {
  const store = new NonceStore({ maxPending: 3 });
  const auth = authenticator({ store });
  const wallet = ethers.Wallet.createRandom();

  for (let i = 0; i < 3; i += 1) auth.challenge(wallet.address);
  assert.equal(store.size, 3);
  assert.throws(() => auth.challenge(wallet.address), (err) => err.code === 'capacity');
});

test('expired challenges are swept, freeing capacity', () => {
  let clock = 0;
  const store = new NonceStore({ ttlMs: 1000, maxPending: 2, now: () => clock });
  const auth = authenticator({ store });
  const wallet = ethers.Wallet.createRandom();

  auth.challenge(wallet.address);
  auth.challenge(wallet.address);
  clock += 1001;
  auth.challenge(wallet.address);       // sweep reclaims the two expired ones
  assert.equal(store.size, 1);
});

test('the signed message binds domain, address, nonce, chain and expiry', () => {
  const auth = authenticator();
  const wallet = ethers.Wallet.createRandom();
  const challenge = auth.challenge(wallet.address);

  for (const bound of [
    DOMAIN,
    wallet.address.toLowerCase(),
    `Nonce: ${challenge.nonce}`,
    'Chain ID: 1',
    `Expiration Time: ${challenge.expiresAt}`,
  ]) {
    assert.ok(challenge.message.includes(bound), `message must bind ${bound}`);
  }
});

test('the statement tells the signer this approves no transaction', () => {
  const auth = authenticator();
  const challenge = auth.challenge(ethers.Wallet.createRandom().address);
  assert.match(challenge.message, /does not approve any transaction, transfer or token allowance/);
});

test('a hostile verifyMessage that throws is treated as a bad signature', () => {
  const auth = authenticator({
    verifyMessage: () => { throw new Error('boom'); },
  });
  const wallet = ethers.Wallet.createRandom();
  const challenge = auth.challenge(wallet.address);
  assert.throws(
    () => auth.verify({ address: wallet.address, nonce: challenge.nonce, signature: '0xabc' }),
    (err) => err.code === 'bad_signature',
  );
});

test('a verifyMessage returning a non-address does not authenticate', () => {
  const auth = authenticator({ verifyMessage: () => null });
  const wallet = ethers.Wallet.createRandom();
  const challenge = auth.challenge(wallet.address);
  assert.throws(
    () => auth.verify({ address: wallet.address, nonce: challenge.nonce, signature: '0xabc' }),
    (err) => err.code === 'bad_signature',
  );
});
