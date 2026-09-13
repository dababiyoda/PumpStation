'use strict';

/**
 * Admission gate tests.
 *
 * The founder's termination trigger:
 *
 *     Reject any feature that expands authority or financial exposure without a
 *     measurable security benefit, bounded failure radius and tested recovery
 *     path.
 *
 * Most of these tests are attempts to get a dangerous feature admitted. Each one
 * is a shape a real proposal takes when someone wants the capability and has not
 * done the work: the bound that is claimed but not stated, the recovery that is
 * written but never run, the ceiling that is technically a number but infinite,
 * the permission that is enumerated but wildcarded.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { admit, admitMatrix, isConsequential } = require('../admission');

/** A minimal feature that expands nothing: the gate's least demanding case. */
function inert(overrides = {}) {
  return {
    feature_id: 'inert-feature',
    name: 'Inert',
    status: 'PROPOSED',
    purpose: 'does nothing consequential',
    authority_delta: { expands_authority: false },
    financial_exposure: { expands_exposure: false, max_at_risk_usd: 0 },
    threats_mitigated: [],
    threats_introduced: [],
    blast_radius: { bounded: true, max_loss_usd: 0, scope: 'nothing' },
    recovery: { procedure_ref: 'docs/RECOVERY.md', tested: true, test_ref: 'test/x.js' },
    agent_permissions: [],
    ...overrides,
  };
}

/** A feature that expands authority and satisfies every rule. */
function compliant(overrides = {}) {
  return inert({
    feature_id: 'compliant-feature',
    authority_delta: { expands_authority: true, grants: ['read own record'] },
    threats_mitigated: [{
      threat_id: 'T-100',
      threat: 'anonymous commands',
      control: 'signed challenge bound to one address',
      evidence_ref: 'test/siwe.test.js',
    }],
    threats_introduced: [{
      threat_id: 'T-101',
      threat: 'session fixation',
      residual_risk: 'low',
      mitigation: 'single-use nonce',
    }],
    blast_radius: { bounded: true, max_loss_usd: 0, scope: 'one session' },
    ...overrides,
  });
}

function rules(result) {
  return result.rejections.map((r) => r.rule);
}

test('an inert feature is admitted', () => {
  assert.equal(admit(inert()).admitted, true);
});

test('a compliant consequential feature is admitted', () => {
  assert.equal(admit(compliant()).admitted, true);
});

test('isConsequential tracks authority OR exposure', () => {
  assert.equal(isConsequential(inert()), false);
  assert.equal(isConsequential(compliant()), true);
  assert.equal(isConsequential(inert({
    financial_exposure: { expands_exposure: true, max_at_risk_usd: 10 },
  })), true);
});

test('R1: expanding authority while mitigating no named threat is refused', () => {
  const result = admit(compliant({ threats_mitigated: [] }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R1-measurable-benefit'));
});

test('R1: a threat with no control mechanism is not a mitigation', () => {
  const result = admit(compliant({
    threats_mitigated: [{ threat_id: 'T-100', threat: 'bad things', control: '   ' }],
  }));
  assert.ok(rules(result).includes('R1-measurable-benefit'));
});

test('R2: bounded:true with a null ceiling is refused as unbounded', () => {
  const result = admit(compliant({
    blast_radius: { bounded: true, max_loss_usd: null, scope: 'everything' },
  }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R2-bounded-blast-radius'));
});

test('R2: Infinity is not a finite bound', () => {
  const result = admit(compliant({
    blast_radius: { bounded: true, max_loss_usd: Infinity, scope: 'everything' },
  }));
  assert.ok(rules(result).includes('R2-bounded-blast-radius'));
});

test('R2: a blast radius that does not say who is affected is refused', () => {
  const result = admit(compliant({
    blast_radius: { bounded: true, max_loss_usd: 100, scope: '' },
  }));
  assert.ok(rules(result).includes('R2-bounded-blast-radius'));
});

test('R3: a written but never-exercised recovery procedure is refused', () => {
  const result = admit(compliant({
    recovery: { procedure_ref: 'docs/RECOVERY.md', tested: false },
  }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R3-tested-recovery'));
});

test('R3: claiming tested:true with no test_ref is refused', () => {
  const result = admit(compliant({
    recovery: { procedure_ref: 'docs/RECOVERY.md', tested: true },
  }));
  assert.ok(rules(result).includes('R3-tested-recovery'));
});

test('R4: a null spending ceiling is an unrestricted permission', () => {
  const result = admit(compliant({
    agent_permissions: [{
      role: 'treasury-agent',
      actions: ['treasury.transfer'],
      spending_ceiling_usd: null,
      expires: '2026-12-31',
    }],
  }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R4-no-unrestricted-permission'));
});

test('R4: a wildcard action list is refused even with a ceiling', () => {
  const result = admit(compliant({
    agent_permissions: [{
      role: 'ops',
      actions: ['*'],
      spending_ceiling_usd: 100,
      expires: '2026-12-31',
    }],
  }));
  assert.ok(rules(result).includes('R4-no-unrestricted-permission'));
});

test('R4: a partial wildcard is still a wildcard', () => {
  const result = admit(compliant({
    agent_permissions: [{
      role: 'ops',
      actions: ['treasury.*'],
      spending_ceiling_usd: 100,
      expires: '2026-12-31',
    }],
  }));
  assert.ok(rules(result).includes('R4-no-unrestricted-permission'));
});

test('R4: a permission with no expiry is refused', () => {
  const result = admit(compliant({
    agent_permissions: [{
      role: 'ops',
      actions: ['read'],
      spending_ceiling_usd: 0,
      expires: null,
    }],
  }));
  assert.ok(rules(result).includes('R4-no-unrestricted-permission'));
});

test('R4: applies even to features that expand nothing', () => {
  const result = admit(inert({
    agent_permissions: [{
      role: 'ops',
      actions: ['*'],
      spending_ceiling_usd: null,
      expires: null,
    }],
  }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R4-no-unrestricted-permission'));
});

test('R5: a role that approves its own proposals is refused', () => {
  const result = admit(compliant({
    agent_permissions: [{
      role: 'treasury-agent',
      actions: ['treasury.transfer'],
      spending_ceiling_usd: 500,
      expires: '2026-12-31',
      can_approve_own_proposals: true,
    }],
  }));
  assert.equal(result.admitted, false);
  const hit = result.rejections.find((r) => r.rule === 'R5-separation-of-duties');
  assert.match(hit.reason, /value-moving actions/);
});

test('R6: exposure larger than the stated worst case is refused', () => {
  const result = admit(compliant({
    financial_exposure: { expands_exposure: true, max_at_risk_usd: 5000 },
    blast_radius: { bounded: true, max_loss_usd: 100, scope: 'treasury' },
  }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R6-exposure-fits-blast-radius'));
});

test('R7: expanding exposure with no ceiling is refused', () => {
  const result = admit(compliant({
    financial_exposure: { expands_exposure: true, max_at_risk_usd: null },
  }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R7-bounded-exposure'));
});

test('R8: expanding authority while claiming zero new threats is refused', () => {
  const result = admit(compliant({ threats_introduced: [] }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R8-authority-names-its-own-risk'));
});

test('R9: DEPLOYED with no implementation_refs is a false completion', () => {
  const result = admit(compliant({ status: 'DEPLOYED', implementation_refs: [] }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R9-deployed-is-implemented'));
});

test('R10: an operational feature whose control has no evidence is refused', () => {
  const result = admit(compliant({
    status: 'ADMITTED',
    threats_mitigated: [{ threat_id: 'T-100', threat: 'x', control: 'y' }],
  }));
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R10-controls-are-evidenced'));
});

test('R10: a PROPOSED feature is warned, not rejected, for missing evidence', () => {
  const result = admit(compliant({
    status: 'PROPOSED',
    threats_mitigated: [{ threat_id: 'T-100', threat: 'x', control: 'y' }],
  }));
  assert.equal(result.admitted, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /no evidence_ref yet/);
});

test('R0: a feature missing the fields the gate reads is refused, not waved through', () => {
  const result = admit({ feature_id: 'empty', status: 'PROPOSED' });
  assert.equal(result.admitted, false);
  assert.ok(rules(result).includes('R0-well-formed'));
});

test('R0: an empty object does not crash the gate', () => {
  assert.equal(admit({}).admitted, false);
});

test('high residual risk is warned even when every rule passes', () => {
  const result = admit(compliant({
    threats_introduced: [{
      threat_id: 'T-101', threat: 'collusion', residual_risk: 'critical',
    }],
  }));
  assert.equal(result.admitted, true);
  assert.match(result.warnings[0], /requires founder ratification/);
});

test('there is no override field: adding one does not admit a failing feature', () => {
  const result = admit(compliant({
    approved_by_founder: true,
    force: true,
    override: true,
    threats_mitigated: [],
  }));
  assert.equal(result.admitted, false);
});


test('a failing PROPOSED feature does not block, a failing DEPLOYED one does', () => {
  const failing = compliant({ threats_mitigated: [] });
  const proposed = admitMatrix({
    organ: 'pumpstation', matrix_version: '1', features: [failing],
  });
  assert.equal(proposed.clean, true);
  assert.equal(proposed.rejected, 1);

  const deployed = admitMatrix({
    organ: 'pumpstation',
    matrix_version: '1',
    features: [{ ...failing, status: 'DEPLOYED', implementation_refs: ['a.js'] }],
  });
  assert.equal(deployed.clean, false);
  assert.equal(deployed.blocking.length, 1);
});


test('the committed matrix passes its own gate', () => {
  const matrix = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'feature-control-matrix.json'), 'utf8'),
  );
  const report = admitMatrix(matrix);
  assert.equal(report.clean, true,
    `blocking: ${JSON.stringify(report.blocking, null, 2)}`);
});

test('the committed matrix matches the contract shape', () => {
  const root = path.join(__dirname, '..', '..');
  const matrix = JSON.parse(
    fs.readFileSync(path.join(root, 'governance', 'feature-control-matrix.json'), 'utf8'),
  );
  const schema = JSON.parse(
    fs.readFileSync(path.join(root, 'contracts', 'feature-control-matrix.schema.json'), 'utf8'),
  );

  assert.equal(matrix.organ, schema.properties.organ.const);
  const required = schema.$defs.feature.required;
  const allowed = new Set(Object.keys(schema.$defs.feature.properties));
  const statuses = new Set(schema.$defs.feature.properties.status.enum);

  for (const feature of matrix.features) {
    for (const field of required) {
      assert.ok(field in feature, `${feature.feature_id} missing '${field}'`);
    }
    for (const field of Object.keys(feature)) {
      assert.ok(allowed.has(field), `${feature.feature_id} has undeclared field '${field}'`);
    }
    assert.ok(statuses.has(feature.status), `${feature.feature_id} bad status`);
  }
});

test('every implementation_ref in the matrix points at a file that exists', () => {
  const root = path.join(__dirname, '..', '..');
  const matrix = JSON.parse(
    fs.readFileSync(path.join(root, 'governance', 'feature-control-matrix.json'), 'utf8'),
  );
  for (const feature of matrix.features) {
    for (const ref of feature.implementation_refs || []) {
      assert.ok(fs.existsSync(path.join(root, ref)),
        `${feature.feature_id} cites implementation_ref '${ref}' which does not exist`);
    }
  }
});

test('every recovery procedure_ref points at a document that exists', () => {
  const root = path.join(__dirname, '..', '..');
  const matrix = JSON.parse(
    fs.readFileSync(path.join(root, 'governance', 'feature-control-matrix.json'), 'utf8'),
  );
  for (const feature of matrix.features) {
    const ref = feature.recovery.procedure_ref;
    if (!ref) continue;                       // absent is caught by R3 for consequential features
    const file = ref.split('#')[0];
    assert.ok(fs.existsSync(path.join(root, file)),
      `${feature.feature_id} cites recovery procedure '${file}' which does not exist`);
  }
});

test('every evidence_ref naming a file points at a file that exists', () => {
  const root = path.join(__dirname, '..', '..');
  const matrix = JSON.parse(
    fs.readFileSync(path.join(root, 'governance', 'feature-control-matrix.json'), 'utf8'),
  );
  for (const feature of matrix.features) {
    for (const entry of feature.threats_mitigated || []) {
      const ref = entry.evidence_ref;
      if (!ref) continue;
      // Evidence refs are "path: description" or a bare path; prose refs are
      // allowed but any token that looks like a repo path must resolve.
      // Trailing punctuation is stripped BEFORE the shape test, or every
      // "path: description" ref would be skipped and this check would pass
      // without checking anything.
      let checked = 0;
      for (const raw of ref.split(/[\s,]+/)) {
        const token = raw.replace(/[:;.]+$/, '');
        if (!/^[\w./-]+\.(js|json|md|html|css|yaml|yml)$/.test(token)) continue;
        checked += 1;
        assert.ok(fs.existsSync(path.join(root, token)),
          `${feature.feature_id} ${entry.threat_id} cites '${token}' which does not exist`);
      }
      assert.ok(checked > 0,
        `${feature.feature_id} ${entry.threat_id} evidence_ref '${ref}' names no ` +
        'checkable file path');
    }
  }
});

test('the wallet-connect entry cites the regression test for the original bug', () => {
  const matrix = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'feature-control-matrix.json'), 'utf8'),
  );
  const wallet = matrix.features.find((f) => f.feature_id === 'wallet-connect');
  const staticMessage = wallet.threats_mitigated.find((t) => t.threat_id === 'T-002');
  assert.match(staticMessage.evidence_ref, /REGRESSION/);
});
