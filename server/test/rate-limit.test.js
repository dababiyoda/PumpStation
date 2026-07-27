'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter } = require('../middleware/rate-limit');

test('allows up to the limit, then refuses', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 3, now: () => 0 });
  assert.equal(limiter.hit('a').allowed, true);
  assert.equal(limiter.hit('a').allowed, true);
  assert.equal(limiter.hit('a').allowed, true);
  assert.equal(limiter.hit('a').allowed, false);
});

test('counts each client separately', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
  assert.equal(limiter.hit('a').allowed, true);
  assert.equal(limiter.hit('b').allowed, true);
  assert.equal(limiter.hit('a').allowed, false);
});

test('the window resets', () => {
  let clock = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => clock });
  assert.equal(limiter.hit('a').allowed, true);
  assert.equal(limiter.hit('a').allowed, false);
  clock = 1001;
  assert.equal(limiter.hit('a').allowed, true);
});

test('the client map is bounded, so it is not itself a memory DoS', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 5, maxClients: 10, now: () => 0 });
  for (let i = 0; i < 500; i += 1) limiter.hit(`client-${i}`);
  assert.ok(limiter.size() <= 10, `expected <= 10 tracked clients, got ${limiter.size()}`);
});

test('remaining count is reported and never negative', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, now: () => 0 });
  assert.equal(limiter.hit('a').remaining, 1);
  assert.equal(limiter.hit('a').remaining, 0);
  assert.equal(limiter.hit('a').remaining, 0);
});

test('middleware answers 429 without calling next', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
  const headers = {};
  let nextCalls = 0;
  let statusCode = null;

  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(code) { statusCode = code; return this; },
    json() { return this; },
  };
  const req = { ip: '1.2.3.4' };

  limiter(req, res, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(statusCode, null);

  limiter(req, res, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(statusCode, 429);
  assert.equal(headers['RateLimit-Limit'], '1');
});
