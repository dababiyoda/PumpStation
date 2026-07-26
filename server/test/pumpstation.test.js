const test = require('node:test');
const assert = require('node:assert/strict');
const { EventStore } = require('../lib/store');
const { PumpStationService } = require('../lib/service');
const { assessManipulationRisk } = require('../lib/policy');

const founder = { id: 'founder-1', role: 'founder' };
const member = { id: 'member-1', role: 'member' };
const agent = { id: 'agent-1', role: 'agent' };

function opportunity(overrides = {}) {
  return {
    title: 'Acquire a revenue-producing local service business',
    assetType: 'SMALL_BUSINESS',
    problemSolved: 'Succession gap in a profitable local service company',
    productiveValue: 'Preserve jobs and improve operations',
    beneficiary: 'Workers, customers, and community co-owners',
    buyerOrCustomer: 'Existing service customers',
    revenueSource: 'Service revenue',
    capitalRequired: 250000,
    maximumLoss: 250000,
    holdingPeriod: '5-10 years',
    proposerHoldings: 'None',
    proposerCompensation: 'Disclosed management compensation only after legal structuring',
    conflicts: [],
    legalQuestions: ['Entity and offering structure require counsel'],
    securityRisks: ['Identity fraud', 'payment diversion'],
    communityBenefit: 'Shared productive ownership and preserved employment',
    communityHarmRisks: ['Capital loss', 'operator concentration'],
    killConditions: ['Unverifiable cash flow', 'undisclosed liabilities'],
    simulationPlan: 'Historical replay and downside stress test',
    ...overrides,
  };
}

function deliberation(overrides = {}) {
  const disadvantages = [
    { id: 'D-1', description: 'Governance can become slow.', redesign: 'Use consequence-tiered review and deadlines.' },
    { id: 'D-2', description: 'Community identity can be exploited.', redesign: 'Require disclosures, dissent, cooling-off, and independent verification.' },
  ];
  return {
    roles: [
      { name: 'Founder-Intent Steward', analysis: 'Preserves productive community ownership.', position: 'support-with-constraints' },
      { name: 'Systems Architect', analysis: 'Keeps PumpStation bounded under the Kernel.', position: 'support' },
      { name: 'Adversarial Reviewer', analysis: 'Attacks manipulation, fraud, and concentration risks.', position: 'conditional' },
      { name: 'Operator and Maintainer', analysis: 'Requires simple operations and observability.', position: 'support' },
      { name: 'Evidence and Welfare Guardian', analysis: 'Requires source-backed claims and participant protection.', position: 'conditional' },
    ],
    options: {
      baseline: 'Keep the legacy wallet demo unchanged.',
      do_nothing: 'Archive the repository and build nothing.',
      simplest_alternative: 'Build only a research and education portal.',
      strongest_competitor: 'Use a conventional human-run investment club platform.',
      reversible_experiment: 'Run a simulation-only opportunity review with no capital or promotion.',
    },
    pass1: {
      intendedOutcome: 'Build a governed community capital institution without market manipulation.',
      advantages: ['Shared diligence', 'transparent conflicts', 'reusable institutional memory'],
      disadvantages,
      comparisons: ['baseline', 'do-nothing', 'simplest alternative', 'strongest competitor', 'reversible experiment'],
      rejectedAlternatives: ['coordinated token buying', 'unlicensed outside-capital fund'],
    },
    pass2: {
      newWeaknesses: ['The protocol can become bureaucratic.', 'Header-based roles are development-only.'],
      disadvantageDispositions: [
        { disadvantageId: 'D-1', status: 'experiment', action: 'Measure review latency in sandbox.' },
        { disadvantageId: 'D-2', status: 'resolved', action: 'Enforce anti-affinity and disclosure controls.' },
      ],
      strengthenedDesign: 'Simulation-only, evidence-bound, founder-authorized institution with staged public launch.',
      residualRisks: ['Legal classification remains external.', 'Production identity is not implemented.'],
    },
    dissent: [{ position: 'Prefer a simpler education cooperative.', rationale: 'Less regulatory exposure.', evidenceThreshold: 'Agent workflow must outperform a simpler human workflow.', owner: 'Simplification Advocate', reviewTrigger: 'After first benchmark.' }],
    ...overrides,
  };
}

function setup() { const store = new EventStore(null); return { store, service: new PumpStationService(store) }; }

function authorizedOpportunity() {
  const { store, service } = setup();
  const opp = service.submitOpportunity(member, opportunity());
  service.recordDeliberation(member, opp.opportunityId, deliberation());
  const manifest = service.decisionManifest(opp.opportunityId);
  service.authorize(founder, opp.opportunityId, 'APPROVE_SIMULATION', manifest.manifestHash);
  return { store, service, opp };
}

test('refuses synchronized-buy instructions', () => {
  const { service } = setup();
  assert.throws(() => service.submitOpportunity(member, opportunity({ simulationPlan: 'Everyone buys at the same time on a countdown.' })), /Prohibited coordination/);
});

test('refuses promotion after accumulation', () => {
  assert.equal(assessManipulationRisk('We accumulate first and then promote the token.').allowed, false);
});

test('requires all five review roles', () => {
  const { service } = setup();
  const opp = service.submitOpportunity(member, opportunity());
  assert.throws(() => service.recordDeliberation(member, opp.opportunityId, deliberation({ roles: deliberation().roles.slice(0, 4) })), /Missing mandatory review roles/);
});

test('requires do-nothing and reversible alternatives', () => {
  const { service } = setup();
  const opp = service.submitOpportunity(member, opportunity());
  const input = deliberation(); delete input.options.do_nothing;
  assert.throws(() => service.recordDeliberation(member, opp.opportunityId, input), /Missing required alternatives/);
});

test('refuses silently dropped disadvantages', () => {
  const { service } = setup();
  const opp = service.submitOpportunity(member, opportunity());
  const input = deliberation(); input.pass2.disadvantageDispositions = input.pass2.disadvantageDispositions.slice(0, 1);
  assert.throws(() => service.recordDeliberation(member, opp.opportunityId, input), /disappeared/);
});

test('only founder can authorize and hash must match', () => {
  const { service } = setup();
  const opp = service.submitOpportunity(member, opportunity());
  service.recordDeliberation(member, opp.opportunityId, deliberation());
  assert.throws(() => service.authorize(member, opp.opportunityId, 'APPROVE_SIMULATION', 'bad'), /not authorized/);
  assert.throws(() => service.authorize(founder, opp.opportunityId, 'APPROVE_SIMULATION', 'bad'), /does not match/);
});

test('simulation authorization cannot create external actions', () => {
  const { service, opp } = authorizedOpportunity();
  assert.throws(() => service.proposeAction(agent, opp.opportunityId, { mode: 'SIMULATION', type: 'trade', instruction: 'Buy token' }), /External-effect/);
});

test('model output is not admissible evidence', () => {
  const { service, opp } = authorizedOpportunity();
  const evidence = service.recordEvidence(member, opp.opportunityId, { type: 'MODEL_OUTPUT', source: 'agent', claim: 'The asset is good.' });
  assert.equal(evidence.admissible, false);
  assert.throws(() => service.recordOutcome(founder, opp.opportunityId, { summary: 'closed' }), /admissible evidence/);
});

test('records only simulated outcomes and keeps chain valid', () => {
  const { store, service, opp } = authorizedOpportunity();
  service.recordEvidence(member, opp.opportunityId, { type: 'REPRODUCIBLE_SIMULATION', source: 'test-harness', claim: 'Replay completed with recorded inputs.' });
  const outcome = service.recordOutcome(founder, opp.opportunityId, { summary: 'Simulation closed', realityStatus: 'SIMULATED' });
  assert.equal(outcome.commercialResult, false);
  assert.equal(store.verifyChain().valid, true);
});

test('stage promotion cannot skip stages or self-authorize', () => {
  const { service } = setup();
  assert.throws(() => service.requestStagePromotion(member, 'PUBLIC_RESEARCH', {}), /exactly one stage/);
  const request = service.requestStagePromotion(member, 'CLOSED_PRIVATE_PILOT', { securityReview: true });
  assert.throws(() => service.decideStagePromotion(agent, request.requestId, 'APPROVE', request.packetHash), /not authorized/);
});
