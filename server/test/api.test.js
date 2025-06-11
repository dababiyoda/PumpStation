import { test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';

let app, server;

before(() => {
  const created = createApp();
  app = created.app;
  server = created.httpServer;
  server.listen(0);
});

after(done => {
  server.close(done);
});

test('GET /api/votes returns empty object initially', async () => {
  const res = await request(app).get('/api/votes');
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, {});
});

test('POST /api/vote registers vote and prevents double voting', async () => {
  let res = await request(app)
    .post('/api/vote')
    .send({ wallet: '0xabc', coin: 'DOGE' })
    .set('Content-Type', 'application/json');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.votes.DOGE, 1);

  res = await request(app)
    .post('/api/vote')
    .send({ wallet: '0xabc', coin: 'DOGE' })
    .set('Content-Type', 'application/json');
  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body.error.includes('already voted'));
});
