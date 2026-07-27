'use strict';

/**
 * The PumpStation admission gate.
 *
 * Founder's termination trigger, verbatim:
 *
 *     Reject any feature that expands authority or financial exposure without a
 *     measurable security benefit, bounded failure radius and tested recovery
 *     path.
 *
 * That sentence is the whole gate. Every rule below is one clause of it, or one
 * of the "secure means" guarantees it depends on. A feature is admitted only if
 * every rule passes; there is no score, no weighting and no override flag,
 * because a gate with an override is a suggestion.
 *
 * What this gate is NOT:
 *   - It does not decide whether a feature is a good idea.
 *   - It does not grant authority. Admission means "may be built", never "may act".
 *   - It cannot be satisfied by intent. Every rule reads a declared, checkable
 *     field; none reads prose.
 *
 * Dependency-free on purpose: a control that needs a supply chain to run is a
 * control with a supply-chain attack surface.
 */

/** Roles that can move value. Self-approval is refused hardest here. */
const TREASURY_ACTION = /^(treasury|transfer|withdraw|swap|mint|burn|approve|spend)/i;

/** A rejection names the rule that fired, so an author can argue with it. */
function reject(rule, reason) {
  return { rule, reason };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * R0 — Well-formed. A record missing the fields the gate reads cannot be
 * evaluated, and an unevaluable feature is rejected rather than waved through.
 */
function ruleWellFormed(feature) {
  const out = [];
  const required = [
    'feature_id', 'name', 'status', 'purpose', 'authority_delta',
    'financial_exposure', 'threats_mitigated', 'threats_introduced',
    'blast_radius', 'recovery', 'agent_permissions',
  ];
  for (const field of required) {
    if (feature[field] === undefined || feature[field] === null) {
      out.push(reject('R0-well-formed', `missing required field '${field}'`));
    }
  }
  for (const field of ['threats_mitigated', 'threats_introduced', 'agent_permissions']) {
    if (feature[field] !== undefined && !Array.isArray(feature[field])) {
      out.push(reject('R0-well-formed', `'${field}' must be an array`));
    }
  }
  return out;
}

/** True when the feature moves the authority or money line at all. */
function isConsequential(feature) {
  const authority = feature.authority_delta || {};
  const exposure = feature.financial_exposure || {};
  return Boolean(authority.expands_authority) || Boolean(exposure.expands_exposure);
}

/**
 * R1 — Measurable security benefit.
 * "...without a measurable security benefit..."
 * A consequential feature must name at least one threat AND the specific
 * mechanism that reduces it. A control is a mechanism; "audited", "best
 * practice" and "industry standard" are not mechanisms.
 */
function ruleMeasurableBenefit(feature) {
  if (!isConsequential(feature)) return [];
  const mitigated = feature.threats_mitigated || [];
  if (mitigated.length === 0) {
    return [reject('R1-measurable-benefit',
      'expands authority or financial exposure but mitigates no named threat: ' +
      'the feature costs security and buys none')];
  }
  const out = [];
  for (const entry of mitigated) {
    if (!entry.threat_id || !entry.threat) {
      out.push(reject('R1-measurable-benefit',
        'threat entry has no threat_id or threat description'));
    }
    if (!entry.control || String(entry.control).trim() === '') {
      out.push(reject('R1-measurable-benefit',
        `threat ${entry.threat_id || '<unnamed>'} names no control mechanism`));
    }
  }
  return out;
}

/**
 * R2 — Bounded failure radius.
 * "...bounded failure radius..."
 * Worst case must be a finite number. `bounded: true` with a null ceiling is a
 * claim without a bound, and is refused as if unbounded.
 */
function ruleBoundedBlastRadius(feature) {
  if (!isConsequential(feature)) return [];
  const blast = feature.blast_radius || {};
  const out = [];
  if (blast.bounded !== true) {
    out.push(reject('R2-bounded-blast-radius',
      'blast_radius.bounded is not true: worst case is unbounded or undeclared'));
  }
  if (!isFiniteNumber(blast.max_loss_usd)) {
    out.push(reject('R2-bounded-blast-radius',
      'blast_radius.max_loss_usd is not a finite number: the bound is asserted ' +
      'but not stated'));
  }
  if (!blast.scope || String(blast.scope).trim() === '') {
    out.push(reject('R2-bounded-blast-radius',
      'blast_radius.scope does not say who is affected at the worst case'));
  }
  return out;
}

/**
 * R3 — Tested recovery path.
 * "...and tested recovery path."
 * A written procedure that has never been executed is a plan, not a recovery
 * path. `tested: true` must be backed by a reference to the exercise.
 */
function ruleTestedRecovery(feature) {
  if (!isConsequential(feature)) return [];
  const recovery = feature.recovery || {};
  const out = [];
  if (!recovery.procedure_ref) {
    out.push(reject('R3-tested-recovery', 'no recovery procedure_ref'));
  }
  if (recovery.tested !== true) {
    out.push(reject('R3-tested-recovery',
      'recovery procedure has never been exercised: a plan is not a recovery path'));
  } else if (!recovery.test_ref) {
    out.push(reject('R3-tested-recovery',
      'recovery claims tested:true with no test_ref: the claim is unverifiable'));
  }
  return out;
}

/**
 * R4 — No unrestricted permission.
 * "zero unrestricted agent or human treasury permissions"
 * Applies to every feature, consequential or not. A null spending ceiling, a
 * wildcard action list, or a permission that never expires is refused. These are
 * the three shapes an unrestricted permission actually takes in practice.
 */
function ruleNoUnrestrictedPermission(feature) {
  const out = [];
  for (const permission of feature.agent_permissions || []) {
    const role = permission.role || '<unnamed role>';

    if (!isFiniteNumber(permission.spending_ceiling_usd)) {
      out.push(reject('R4-no-unrestricted-permission',
        `role '${role}' has no finite spending_ceiling_usd: unrestricted spend`));
    }
    const actions = permission.actions || [];
    if (actions.length === 0) {
      out.push(reject('R4-no-unrestricted-permission',
        `role '${role}' declares no action list`));
    }
    for (const action of actions) {
      if (action === '*' || String(action).includes('*')) {
        out.push(reject('R4-no-unrestricted-permission',
          `role '${role}' uses wildcard action '${action}': permissions must be enumerated`));
      }
    }
    if (!permission.expires) {
      out.push(reject('R4-no-unrestricted-permission',
        `role '${role}' has no expiry: a permanent grant cannot be revoked by lapsing`));
    }
  }
  return out;
}

/**
 * R5 — Separation of duties.
 * "Treasury agents cannot approve their own proposals."
 * Self-approval is refused for every role, not only treasury ones. A role that
 * approves itself is a single point of both compromise and error.
 */
function ruleSeparationOfDuties(feature) {
  const out = [];
  for (const permission of feature.agent_permissions || []) {
    if (permission.can_approve_own_proposals === true) {
      const role = permission.role || '<unnamed role>';
      const touchesValue = (permission.actions || []).some((a) => TREASURY_ACTION.test(a));
      out.push(reject('R5-separation-of-duties',
        `role '${role}' may approve its own proposals` +
        (touchesValue ? ' while holding value-moving actions' : '')));
    }
  }
  return out;
}

/**
 * R6 — Exposure must fit inside the blast radius.
 * A feature declaring more money at risk than its stated worst case has one of
 * the two numbers wrong. Refusing forces the author to say which.
 */
function ruleExposureFitsBlastRadius(feature) {
  const exposure = feature.financial_exposure || {};
  const blast = feature.blast_radius || {};
  if (!isFiniteNumber(exposure.max_at_risk_usd) || !isFiniteNumber(blast.max_loss_usd)) {
    return [];
  }
  if (exposure.max_at_risk_usd > blast.max_loss_usd) {
    return [reject('R6-exposure-fits-blast-radius',
      `max_at_risk_usd ${exposure.max_at_risk_usd} exceeds blast_radius.max_loss_usd ` +
      `${blast.max_loss_usd}: the stated worst case is smaller than the stated exposure`)];
  }
  return [];
}

/**
 * R7 — Unbounded exposure is refused outright.
 * A feature that puts money at risk with no ceiling has no bounded failure
 * radius by definition, whatever blast_radius claims.
 */
function ruleBoundedExposure(feature) {
  const exposure = feature.financial_exposure || {};
  if (exposure.expands_exposure === true && !isFiniteNumber(exposure.max_at_risk_usd)) {
    return [reject('R7-bounded-exposure',
      'expands financial exposure with a null max_at_risk_usd: unbounded exposure')];
  }
  return [];
}

/**
 * R8 — Expanding authority must name what could go wrong.
 * New authority is new attack surface; a feature claiming it added none has not
 * been threat-modelled. This rule exists to make that omission loud rather than
 * to punish honesty about small features.
 */
function ruleAuthorityNamesItsOwnRisk(feature) {
  const authority = feature.authority_delta || {};
  if (authority.expands_authority !== true) return [];
  if ((feature.threats_introduced || []).length === 0) {
    return [reject('R8-authority-names-its-own-risk',
      'expands authority but declares no introduced threat: new authority is new ' +
      'attack surface, so an empty list means the feature was not threat-modelled')];
  }
  return [];
}

/**
 * R9 — Deployed means implemented.
 * A feature may not claim DEPLOYED without naming the code that implements it.
 * This is the same false-completion check the Kernel's Single Bottleneck Metric
 * applies to intents claiming 'implemented'.
 */
function ruleDeployedIsImplemented(feature) {
  if (feature.status !== 'DEPLOYED') return [];
  if (!(feature.implementation_refs || []).length) {
    return [reject('R9-deployed-is-implemented',
      "status is DEPLOYED with no implementation_refs: completion is claimed with " +
      'nothing behind it')];
  }
  return [];
}

/**
 * R10 — Controls must be shown, not claimed.
 * A control with no evidence_ref is a plan. This is a WARNING for PROPOSED
 * features (evidence comes with the build) and a REJECTION once a feature
 * claims ADMITTED or DEPLOYED.
 */
function ruleControlsAreEvidenced(feature) {
  const claimsOperational = feature.status === 'ADMITTED' || feature.status === 'DEPLOYED';
  const out = [];
  for (const entry of feature.threats_mitigated || []) {
    if (!entry.evidence_ref) {
      const reason =
        `control for ${entry.threat_id || '<unnamed threat>'} has no evidence_ref`;
      if (claimsOperational) {
        out.push(reject('R10-controls-are-evidenced',
          `${reason}: status ${feature.status} asserts the control works`));
      }
    }
  }
  return out;
}

const RULES = [
  ruleWellFormed,
  ruleMeasurableBenefit,
  ruleBoundedBlastRadius,
  ruleTestedRecovery,
  ruleNoUnrestrictedPermission,
  ruleSeparationOfDuties,
  ruleExposureFitsBlastRadius,
  ruleBoundedExposure,
  ruleAuthorityNamesItsOwnRisk,
  ruleDeployedIsImplemented,
  ruleControlsAreEvidenced,
];

/** Warnings do not block admission but are always reported. */
function collectWarnings(feature) {
  const out = [];
  if (feature.status === 'PROPOSED') {
    for (const entry of feature.threats_mitigated || []) {
      if (!entry.evidence_ref) {
        out.push(`control for ${entry.threat_id || '<unnamed threat>'} has no ` +
          'evidence_ref yet; it must exist before this feature may be ADMITTED');
      }
    }
  }
  for (const entry of feature.threats_introduced || []) {
    if (entry.residual_risk === 'high' || entry.residual_risk === 'critical') {
      out.push(`introduces ${entry.threat_id} at residual risk ` +
        `'${entry.residual_risk}': requires founder ratification before deployment`);
    }
  }
  return out;
}

/**
 * Evaluate one feature.
 * @returns {{feature_id: string, status: string, admitted: boolean,
 *            rejections: Array<{rule: string, reason: string}>,
 *            warnings: string[]}}
 */
function admit(feature) {
  const rejections = [];
  for (const rule of RULES) {
    rejections.push(...rule(feature));
  }
  return {
    feature_id: feature.feature_id || '<unidentified>',
    status: feature.status,
    admitted: rejections.length === 0,
    rejections,
    warnings: collectWarnings(feature),
  };
}

/**
 * Evaluate a whole matrix.
 *
 * `blocking` counts only features that claim to be admitted or running. A
 * PROPOSED feature that fails is working as intended: the gate is telling the
 * author what to build before it may ship. A DEPLOYED feature that fails is an
 * incident.
 */
function admitMatrix(matrix) {
  const results = (matrix.features || []).map(admit);
  const blocking = results.filter(
    (r) => !r.admitted && (r.status === 'ADMITTED' || r.status === 'DEPLOYED'),
  );
  return {
    organ: matrix.organ,
    matrix_version: matrix.matrix_version,
    evaluated: results.length,
    admitted: results.filter((r) => r.admitted).length,
    rejected: results.filter((r) => !r.admitted).length,
    blocking,
    results,
    clean: blocking.length === 0,
  };
}

module.exports = {
  admit,
  admitMatrix,
  RULES,
  isConsequential,
};
