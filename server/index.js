const express = require('express');
const path = require('node:path');
const { EventStore } = require('./lib/store');
const { PumpStationService } = require('./lib/service');
const { assessManipulationRisk } = require('./lib/policy');

const PORT = Number(process.env.PORT || 3001);
const STORE_PATH = process.env.PUMPSTATION_STORE || path.join(__dirname, 'data', 'events.json');
const app = express();
const store = new EventStore(STORE_PATH);
const service = new PumpStationService(store);

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'");
  next();
});
app.use(express.static(path.join(__dirname, '..', 'client')));

function actorFrom(req) {
  return { id: req.get('x-actor-id') || 'anonymous', role: req.get('x-actor-role') || 'member' };
}

function route(handler) {
  return async (req, res) => {
    try { res.json(await handler(req, res)); }
    catch (error) {
      const status = error.code === 'FORBIDDEN' ? 403 : ['PROHIBITED_COORDINATION', 'EXTERNAL_EFFECT_PROHIBITED', 'SIMULATION_ONLY'].includes(error.code) ? 422 : 400;
      res.status(status).json({ error: error.message, code: error.code || 'BAD_REQUEST', findings: error.findings || [] });
    }
  };
}

app.get('/health', (req, res) => res.json({ status: 'ok', mode: 'SANDBOX', unauthorizedExternalEffects: 0, chain: store.verifyChain() }));
app.get('/api/state', (req, res) => res.json({ state: store.state(), events: store.events }));
app.get('/api/events/verify', (req, res) => res.json(store.verifyChain()));
app.post('/api/policy/assess', route((req) => assessManipulationRisk(req.body)));
app.post('/api/identity/challenge', route((req) => service.createIdentityChallenge(actorFrom(req), req.body.address)));
app.post('/api/identity/verify', route(async (req) => {
  const { verifyMessage } = await import('ethers');
  const state = store.state();
  const address = String(req.body.address || '').toLowerCase();
  const challenge = state.challenges[address];
  if (!challenge) throw new Error('No active challenge exists.');
  const recovered = verifyMessage(challenge.message, req.body.signature || '');
  if (recovered.toLowerCase() !== address) throw new Error('Invalid wallet signature.');
  return service.recordVerifiedIdentity(actorFrom(req), address);
}));
app.post('/api/opportunities', route((req) => service.submitOpportunity(actorFrom(req), req.body)));
app.post('/api/opportunities/:id/deliberation', route((req) => service.recordDeliberation(actorFrom(req), req.params.id, req.body)));
app.get('/api/opportunities/:id/decision-manifest', route((req) => service.decisionManifest(req.params.id)));
app.post('/api/opportunities/:id/authorize', route((req) => service.authorize(actorFrom(req), req.params.id, req.body.decision, req.body.confirmationHash)));
app.post('/api/opportunities/:id/actions', route((req) => service.proposeAction(actorFrom(req), req.params.id, req.body)));
app.post('/api/opportunities/:id/evidence', route((req) => service.recordEvidence(actorFrom(req), req.params.id, req.body)));
app.post('/api/opportunities/:id/outcome', route((req) => service.recordOutcome(actorFrom(req), req.params.id, req.body)));
app.post('/api/stage-promotions', route((req) => service.requestStagePromotion(actorFrom(req), req.body.requestedStage, req.body.packet)));
app.post('/api/stage-promotions/:id/decision', route((req) => service.decideStagePromotion(actorFrom(req), req.params.id, req.body.decision, req.body.confirmationHash)));

if (require.main === module) {
  app.listen(PORT, () => console.log(`PumpStation sandbox listening on http://localhost:${PORT}`));
}

module.exports = { app, store, service };
