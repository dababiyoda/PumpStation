const PROHIBITED_PATTERNS = [
  { category: 'COORDINATED_PRICE_MOVEMENT', regex: /(?:all|everyone|members|group).{0,40}(?:buy|purchase).{0,40}(?:same time|together|simultaneous|countdown)/i },
  { category: 'PROMOTION_AFTER_ACCUMULATION', regex: /(?:buy|accumulate|load up).{0,80}(?:promote|shill|post|hype|market)/i },
  { category: 'COORDINATED_EXIT', regex: /(?:everyone|members|group).{0,40}(?:sell|exit|dump).{0,40}(?:same time|together|before)/i },
  { category: 'WASH_TRADING', regex: /wash trad|self[- ]?trade|fake volume|manufactur(?:e|ed) volume/i },
  { category: 'GUARANTEED_RETURN', regex: /guaranteed (?:return|profit)|risk[- ]?free profit|cannot lose/i },
  { category: 'DECEPTIVE_PROMOTION', regex: /fake partnership|fake community|conceal(?:ed)? holdings|undisclosed promotion/i },
  { category: 'AFFINITY_PRESSURE', regex: /(?:our people|our community|immigrant community|immigrants|family).{0,50}(?:must|have to|owe it|prove loyalty).{0,50}(?:invest|buy|join)/i },
  { category: 'EXIT_LIQUIDITY', regex: /exit liquidity|later buyers|outsiders.{0,30}(?:buy|enter)/i },
  { category: 'AUTHORITY_BYPASS', regex: /bypass (?:approval|kernel|gate)|disable logging|self[- ]?approve/i },
];

const EXTERNAL_ACTION_TERMS = /\b(trade|swap|transfer|send funds|move money|place order|buy token|sell token|publish campaign|contact counterparty|deploy contract)\b/i;

function textOf(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value || {});
}

function assessManipulationRisk(value) {
  const text = textOf(value);
  const findings = PROHIBITED_PATTERNS
    .filter(({ regex }) => regex.test(text))
    .map(({ category }) => category);
  return { allowed: findings.length === 0, findings, disposition: findings.length ? 'REFUSE' : 'CLEAR' };
}

function assertNoManipulation(value) {
  const result = assessManipulationRisk(value);
  if (!result.allowed) {
    const error = new Error(`Prohibited coordination detected: ${result.findings.join(', ')}`);
    error.code = 'PROHIBITED_COORDINATION';
    error.findings = result.findings;
    throw error;
  }
  return result;
}

function assertSimulationAction(action) {
  if (!action || action.mode !== 'SIMULATION') {
    const error = new Error('Only SIMULATION actions are permitted in this phase.');
    error.code = 'SIMULATION_ONLY';
    throw error;
  }
  if (EXTERNAL_ACTION_TERMS.test(textOf(action))) {
    const error = new Error('External-effect action terms are prohibited in simulation mode.');
    error.code = 'EXTERNAL_EFFECT_PROHIBITED';
    throw error;
  }
  assertNoManipulation(action);
}

module.exports = { PROHIBITED_PATTERNS, assessManipulationRisk, assertNoManipulation, assertSimulationAction };
