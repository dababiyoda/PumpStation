const crypto = require('node:crypto');
const { newId, sha256 } = require('./canonical');
const { assertNoManipulation, assertSimulationAction } = require('./policy');
const { validateActor, validateOpportunity, validateDeliberation } = require('./validators');

const STAGES = ['RESEARCH_SANDBOX', 'CLOSED_PRIVATE_PILOT', 'PUBLIC_RESEARCH', 'PROPRIETARY_CAPITAL', 'PRODUCTIVE_ASSET_OPERATIONS', 'REGULATED_EXTERNAL_CAPITAL'];

function requireRole(actor, roles) {
  validateActor(actor);
  if (!roles.includes(actor.role)) {
    const error = new Error(`Role ${actor.role} is not authorized. Required: ${roles.join(', ')}`);
    error.code = 'FORBIDDEN';
    throw error;
  }
}

function recordRefusal(store, actor, subjectId, error) {
  store.append({
    type: 'POLICY_REFUSAL', actor, subjectId,
    payload: { code: error.code || 'POLICY_REFUSAL', message: error.message, findings: error.findings || [] },
    metadata: { origin: 'SYSTEM_ACTION', realityStatus: 'SANDBOX', truthStatus: 'VERIFIED' },
  });
}

class PumpStationService {
  constructor(store) { this.store = store; }

  createIdentityChallenge(actor, address) {
    validateActor(actor);
    if (!/^0x[a-fA-F0-9]{40}$/.test(address || '')) throw new Error('A valid Ethereum address is required.');
    const nonce = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const message = `PumpStation identity challenge\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}\nExpires: ${expiresAt}`;
    const payload = { address: address.toLowerCase(), nonce, expiresAt, message };
    this.store.append({ type: 'IDENTITY_CHALLENGE_CREATED', actor, subjectId: address.toLowerCase(), payload });
    return payload;
  }

  recordVerifiedIdentity(actor, address) {
    const state = this.store.state();
    const challenge = state.challenges[address.toLowerCase()];
    if (!challenge) throw new Error('No active challenge exists.');
    if (Date.parse(challenge.expiresAt) <= Date.now()) throw new Error('Challenge expired.');
    const payload = { address: address.toLowerCase(), verifiedAt: new Date().toISOString(), authorityGranted: false };
    this.store.append({ type: 'IDENTITY_VERIFIED', actor, subjectId: address.toLowerCase(), payload });
    return payload;
  }

  submitOpportunity(actor, input) {
    requireRole(actor, ['founder', 'member', 'researcher']);
    try {
      const validated = validateOpportunity(input);
      const opportunityId = newId('opp');
      const payload = { ...validated, opportunityId, status: 'PROPOSED', proposer: actor.id, createdAt: new Date().toISOString() };
      this.store.append({ type: 'OPPORTUNITY_SUBMITTED', actor, subjectId: opportunityId, payload });
      return payload;
    } catch (error) {
      recordRefusal(this.store, actor, null, error);
      throw error;
    }
  }

  recordDeliberation(actor, opportunityId, input) {
    requireRole(actor, ['founder', 'member', 'reviewer']);
    const state = this.store.state();
    if (!state.opportunities[opportunityId]) throw new Error('Opportunity not found.');
    const validated = validateDeliberation(input);
    const payload = { ...validated, opportunityId, recordedBy: actor.id, recordedAt: new Date().toISOString() };
    this.store.append({ type: 'DELIBERATION_RECORDED', actor, subjectId: opportunityId, payload });
    return payload;
  }

  authorize(actor, opportunityId, decision, confirmationHash) {
    requireRole(actor, ['founder']);
    const state = this.store.state();
    const opportunity = state.opportunities[opportunityId];
    const deliberation = state.deliberations[opportunityId];
    if (!opportunity || !deliberation) throw new Error('Opportunity and deliberation are required.');
    if (!['APPROVE_SIMULATION', 'REFUSE'].includes(decision)) throw new Error('Invalid decision.');
    const manifest = { opportunityHash: opportunity.contentHash, deliberationHash: deliberation.contentHash, stage: state.stage };
    const manifestHash = sha256(manifest);
    if (confirmationHash !== manifestHash) throw new Error('Confirmation hash does not match the current decision manifest.');
    const payload = { opportunityId, decision, manifest, manifestHash, founderId: actor.id, decidedAt: new Date().toISOString() };
    this.store.append({ type: 'AUTHORIZATION_RECORDED', actor, subjectId: opportunityId, payload, metadata: { truthStatus: 'AUTHORIZED' } });
    return payload;
  }

  decisionManifest(opportunityId) {
    const state = this.store.state();
    const opportunity = state.opportunities[opportunityId];
    const deliberation = state.deliberations[opportunityId];
    if (!opportunity || !deliberation) throw new Error('Opportunity and deliberation are required.');
    const manifest = { opportunityHash: opportunity.contentHash, deliberationHash: deliberation.contentHash, stage: state.stage };
    return { manifest, manifestHash: sha256(manifest) };
  }

  proposeAction(actor, opportunityId, action) {
    requireRole(actor, ['founder', 'agent', 'member', 'reviewer']);
    const state = this.store.state();
    const authorization = state.authorizations[opportunityId];
    if (!authorization || authorization.decision !== 'APPROVE_SIMULATION') throw new Error('Founder simulation authorization is required.');
    try { assertSimulationAction(action); } catch (error) { recordRefusal(this.store, actor, opportunityId, error); throw error; }
    const payload = { ...action, actionId: newId('act'), opportunityId, status: 'PROPOSED_NOT_EXECUTED', requestedBy: actor.id };
    this.store.append({ type: 'ACTION_PROPOSED', actor, subjectId: opportunityId, payload, metadata: { origin: 'SIMULATION', realityStatus: 'SIMULATED' } });
    return payload;
  }

  recordEvidence(actor, opportunityId, evidence) {
    requireRole(actor, ['founder', 'reviewer', 'reconciler', 'member']);
    const state = this.store.state();
    if (!state.opportunities[opportunityId]) throw new Error('Opportunity not found.');
    if (!evidence.type || !evidence.source || !evidence.claim) throw new Error('Evidence type, source, and claim are required.');
    assertNoManipulation(evidence);
    const admissible = !['MODEL_OUTPUT', 'UNVERIFIED_CLAIM'].includes(evidence.type);
    const payload = { ...evidence, evidenceId: newId('evd'), opportunityId, admissible, contentHash: sha256(evidence), recordedAt: new Date().toISOString() };
    this.store.append({ type: 'EVIDENCE_RECORDED', actor, subjectId: opportunityId, payload, metadata: { truthStatus: admissible ? 'SUPPORTED' : 'CLAIMED' } });
    return payload;
  }

  recordOutcome(actor, opportunityId, outcome) {
    requireRole(actor, ['founder', 'reconciler']);
    const state = this.store.state();
    const evidence = Object.values(state.evidence).filter((item) => item.opportunityId === opportunityId && item.admissible);
    if (!evidence.length) throw new Error('At least one admissible evidence object is required.');
    if (outcome.realityStatus && outcome.realityStatus !== 'SIMULATED') throw new Error('This phase can record only SIMULATED outcomes.');
    const payload = {
      ...outcome,
      opportunityId,
      realityStatus: 'SIMULATED',
      commercialResult: false,
      reconciledBy: actor.id,
      evidenceRefs: evidence.map((item) => item.evidenceId),
      recordedAt: new Date().toISOString(),
    };
    this.store.append({ type: 'OUTCOME_RECORDED', actor, subjectId: opportunityId, payload, metadata: { origin: 'SIMULATION', realityStatus: 'SIMULATED', truthStatus: 'VERIFIED' } });
    return payload;
  }

  requestStagePromotion(actor, requestedStage, packet) {
    requireRole(actor, ['founder', 'member', 'reviewer']);
    const current = this.store.state().stage;
    const currentIndex = STAGES.indexOf(current);
    const requestedIndex = STAGES.indexOf(requestedStage);
    if (requestedIndex !== currentIndex + 1) throw new Error('Stage promotion must advance exactly one stage.');
    const requestId = newId('stage');
    const payload = { requestId, currentStage: current, requestedStage, packet, packetHash: sha256(packet), status: 'PENDING_FOUNDER_DECISION' };
    this.store.append({ type: 'STAGE_PROMOTION_REQUESTED', actor, subjectId: requestId, payload });
    return payload;
  }

  decideStagePromotion(actor, requestId, decision, confirmationHash) {
    requireRole(actor, ['founder']);
    const request = this.store.state().stagePromotions[requestId];
    if (!request) throw new Error('Stage promotion request not found.');
    if (confirmationHash !== request.packetHash) throw new Error('Stage-promotion hash mismatch.');
    if (!['APPROVE', 'REFUSE'].includes(decision)) throw new Error('Invalid stage decision.');
    if (decision === 'APPROVE' && request.requestedStage === 'PROPRIETARY_CAPITAL') {
      const packet = request.packet || {};
      if (!packet.legalReview || !packet.securityReview || !packet.founderOwnedCapitalOnly) {
        throw new Error('Proprietary capital requires legal review, security review, and founder-owned-capital-only attestation.');
      }
    }
    if (decision === 'APPROVE' && ['PRODUCTIVE_ASSET_OPERATIONS', 'REGULATED_EXTERNAL_CAPITAL'].includes(request.requestedStage)) {
      throw new Error('This implementation cannot authorize high-consequence capital stages. Kernel integration and external legal prerequisites are required.');
    }
    const payload = { requestId, requestedStage: request.requestedStage, decision, founderId: actor.id, decidedAt: new Date().toISOString() };
    this.store.append({ type: 'STAGE_PROMOTION_DECIDED', actor, subjectId: requestId, payload, metadata: { truthStatus: 'AUTHORIZED' } });
    return payload;
  }
}

module.exports = { PumpStationService, STAGES, requireRole };
