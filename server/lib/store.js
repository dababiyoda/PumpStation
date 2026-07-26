const fs = require('node:fs');
const path = require('node:path');
const { canonicalJson, sha256, newId } = require('./canonical');
const { validateMetadata } = require('./validators');

const GENESIS_HASH = '0'.repeat(64);

function emptyState() {
  return {
    stage: 'RESEARCH_SANDBOX',
    identities: {},
    challenges: {},
    opportunities: {},
    deliberations: {},
    authorizations: {},
    actions: {},
    evidence: {},
    outcomes: {},
    stagePromotions: {},
    metrics: {
      unauthorizedExternalEffects: 0,
      prohibitedCoordinationRefusals: 0,
    },
  };
}

function reduce(events) {
  const state = emptyState();
  for (const event of events) {
    const p = event.payload || {};
    switch (event.type) {
      case 'IDENTITY_CHALLENGE_CREATED': state.challenges[p.address] = p; break;
      case 'IDENTITY_VERIFIED': state.identities[p.address] = p; delete state.challenges[p.address]; break;
      case 'OPPORTUNITY_SUBMITTED': state.opportunities[event.subjectId] = p; break;
      case 'DELIBERATION_RECORDED': state.deliberations[event.subjectId] = p; break;
      case 'AUTHORIZATION_RECORDED': state.authorizations[event.subjectId] = p; break;
      case 'ACTION_PROPOSED': state.actions[p.actionId] = p; break;
      case 'EVIDENCE_RECORDED': state.evidence[p.evidenceId] = p; break;
      case 'OUTCOME_RECORDED': state.outcomes[event.subjectId] = p; break;
      case 'STAGE_PROMOTION_REQUESTED': state.stagePromotions[p.requestId] = p; break;
      case 'STAGE_PROMOTION_DECIDED': state.stagePromotions[p.requestId] = { ...state.stagePromotions[p.requestId], ...p }; if (p.decision === 'APPROVE') state.stage = p.requestedStage; break;
      case 'POLICY_REFUSAL': state.metrics.prohibitedCoordinationRefusals += 1; break;
      default: break;
    }
  }
  return state;
}

class EventStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.events = [];
    this.load();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    const raw = fs.readFileSync(this.filePath, 'utf8').trim();
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.events)) throw new Error('Invalid event store format.');
    this.events = parsed.events;
    const verification = this.verifyChain();
    if (!verification.valid) throw new Error(`Event chain invalid at index ${verification.index}: ${verification.reason}`);
  }

  persist() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({ events: this.events }, null, 2));
    fs.renameSync(temp, this.filePath);
  }

  append({ type, actor, subjectId = null, payload = {}, metadata = {} }) {
    const normalizedMetadata = validateMetadata(metadata);
    const previousHash = this.events.length ? this.events[this.events.length - 1].hash : GENESIS_HASH;
    const unsigned = {
      eventId: newId('evt'),
      sequence: this.events.length + 1,
      type,
      actor,
      subjectId,
      payload,
      metadata: normalizedMetadata,
      timestamp: new Date().toISOString(),
      previousHash,
    };
    const event = { ...unsigned, hash: sha256(canonicalJson(unsigned)) };
    this.events.push(event);
    this.persist();
    return event;
  }

  state() {
    return reduce(this.events);
  }

  verifyChain() {
    let previousHash = GENESIS_HASH;
    for (let index = 0; index < this.events.length; index += 1) {
      const event = this.events[index];
      if (event.previousHash !== previousHash) return { valid: false, index, reason: 'previous hash mismatch' };
      const { hash, ...unsigned } = event;
      const expected = sha256(canonicalJson(unsigned));
      if (hash !== expected) return { valid: false, index, reason: 'event hash mismatch' };
      previousHash = hash;
    }
    return { valid: true, count: this.events.length, head: previousHash };
  }
}

module.exports = { EventStore, emptyState, reduce, GENESIS_HASH };
