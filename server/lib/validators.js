const { sha256 } = require('./canonical');
const { assertNoManipulation } = require('./policy');

const REQUIRED_REVIEW_ROLES = [
  'Founder-Intent Steward',
  'Systems Architect',
  'Adversarial Reviewer',
  'Operator and Maintainer',
  'Evidence and Welfare Guardian',
];

const REQUIRED_OPTIONS = ['baseline', 'do_nothing', 'simplest_alternative', 'strongest_competitor', 'reversible_experiment'];
const ALLOWED_ORIGINS = ['REAL_USER_ACTION', 'SYSTEM_ACTION', 'TEST_FIXTURE', 'DEMO_SEED', 'MIGRATION', 'COMPENSATING_RECORD', 'SIMULATION', 'EXTERNAL_RECEIPT'];
const ALLOWED_ENVIRONMENTS = ['DEVELOPMENT', 'TEST', 'STAGING', 'PRODUCTION'];

function requireFields(object, fields, context) {
  const missing = fields.filter((field) => object?.[field] === undefined || object?.[field] === null || object?.[field] === '');
  if (missing.length) {
    const error = new Error(`${context} is missing required fields: ${missing.join(', ')}`);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
}

function validateActor(actor) {
  requireFields(actor, ['id', 'role'], 'actor');
  return actor;
}

function validateMetadata(metadata = {}) {
  const normalized = {
    origin: metadata.origin || 'REAL_USER_ACTION',
    environment: metadata.environment || 'DEVELOPMENT',
    realityStatus: metadata.realityStatus || 'SANDBOX',
    truthStatus: metadata.truthStatus || 'CLAIMED',
  };
  if (!ALLOWED_ORIGINS.includes(normalized.origin)) throw new Error(`Invalid origin: ${normalized.origin}`);
  if (!ALLOWED_ENVIRONMENTS.includes(normalized.environment)) throw new Error(`Invalid environment: ${normalized.environment}`);
  return normalized;
}

function validateOpportunity(input) {
  requireFields(input, [
    'title', 'assetType', 'problemSolved', 'productiveValue', 'beneficiary', 'buyerOrCustomer',
    'revenueSource', 'capitalRequired', 'maximumLoss', 'holdingPeriod', 'proposerHoldings',
    'proposerCompensation', 'conflicts', 'legalQuestions', 'securityRisks', 'communityBenefit',
    'communityHarmRisks', 'killConditions', 'simulationPlan',
  ], 'opportunity');
  assertNoManipulation(input);
  if (!Array.isArray(input.conflicts) || !Array.isArray(input.killConditions)) {
    throw new Error('conflicts and killConditions must be arrays.');
  }
  return { ...input, contentHash: sha256(input) };
}

function validateDeliberation(input) {
  requireFields(input, ['roles', 'options', 'pass1', 'pass2', 'dissent'], 'deliberation');
  const roleNames = new Set(input.roles.map((role) => role.name));
  const missingRoles = REQUIRED_REVIEW_ROLES.filter((role) => !roleNames.has(role));
  if (missingRoles.length) throw new Error(`Missing mandatory review roles: ${missingRoles.join(', ')}`);

  const missingOptions = REQUIRED_OPTIONS.filter((option) => !input.options[option]);
  if (missingOptions.length) throw new Error(`Missing required alternatives: ${missingOptions.join(', ')}`);

  requireFields(input.pass1, ['intendedOutcome', 'advantages', 'disadvantages', 'comparisons', 'rejectedAlternatives'], 'pass1');
  requireFields(input.pass2, ['newWeaknesses', 'disadvantageDispositions', 'strengthenedDesign', 'residualRisks'], 'pass2');

  const disadvantages = input.pass1.disadvantages || [];
  if (!disadvantages.length) throw new Error('Pass 1 must identify at least one disadvantage.');
  const ids = disadvantages.map((item) => item.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !id)) throw new Error('Every Pass-1 disadvantage needs a unique stable ID.');

  const dispositionIds = new Set((input.pass2.disadvantageDispositions || []).map((item) => item.disadvantageId));
  const dropped = ids.filter((id) => !dispositionIds.has(id));
  if (dropped.length) throw new Error(`Pass-1 disadvantages disappeared in Pass 2: ${dropped.join(', ')}`);
  if (!Array.isArray(input.dissent)) throw new Error('Dissent must be preserved as an array, even when empty.');
  assertNoManipulation(input);
  return { ...input, contentHash: sha256(input) };
}

module.exports = {
  REQUIRED_REVIEW_ROLES,
  REQUIRED_OPTIONS,
  validateActor,
  validateMetadata,
  validateOpportunity,
  validateDeliberation,
};
