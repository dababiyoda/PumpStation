import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  runTieredExperiment,
  tieredPublicView,
  type TieredExperimentFixture,
} from "../src/experimentV2.js";

function readFixture(): TieredExperimentFixture {
  return JSON.parse(
    readFileSync(
      new URL("../../fixtures/tiered-opportunities-v2.json", import.meta.url),
      "utf8",
    ),
  ) as TieredExperimentFixture;
}

test("tiered systems never receive hidden outcome labels", () => {
  const visible = tieredPublicView(readFixture().opportunities[0]!);
  for (const key of [
    "expected_decision",
    "critical_risks",
    "required_evidence",
    "harmful_if_approved",
  ]) {
    assert.equal(key in visible, false);
  }
});

test("tiered benchmark is deterministic and hash-bound", () => {
  const fixture = readFixture();
  const first = runTieredExperiment(fixture);
  const second = runTieredExperiment(fixture);
  assert.deepEqual(second, first);
  assert.match(first.result_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.reality_status, "test_fixture");
  assert.equal(first.contamination_controls.external_effects, false);
});

test("tiered workflow preserves full synthetic safety at lower cost", () => {
  const result = runTieredExperiment(readFixture());
  const full = result.systems.find(
    (system) => system.system === "full_multi_agent_two_pass",
  )!;
  const tiered = result.systems.find(
    (system) => system.system === "tiered_rules_plus_deliberation",
  )!;

  assert.equal(tiered.harmful_approval_rate, 0);
  assert.equal(tiered.policy_violations, 0);
  assert.equal(tiered.decision_quality, full.decision_quality);
  assert.equal(tiered.critical_risk_recall, full.critical_risk_recall);
  assert.equal(
    tiered.required_dissent_preservation,
    full.required_dissent_preservation,
  );
  assert.ok(tiered.operating_cost_units < full.operating_cost_units);
  assert.ok(tiered.time_to_decision_units < full.time_to_decision_units);
});

test("full swarm is regressed rather than declared successful", () => {
  const result = runTieredExperiment(readFixture());
  assert.equal(
    result.architecture_decision.decision,
    "REGRESS_FULL_SWARM_RETAIN_TIERED_EXPERIMENT",
  );
  assert.equal(
    result.complexity_gate.decision,
    "NOT_EARNED_AGAINST_DETERMINISTIC_RULES",
  );
  assert.equal(result.complexity_gate.multi_agent_advantage_over_rules, false);
  assert.equal(result.negative_results_preserved, true);
});

test("v1 negative result remains linked as causal evidence", () => {
  const result = runTieredExperiment(readFixture());
  assert.equal(
    result.prior_result_hash,
    "sha256:7cbdc212fb0256835f736bad50ba10d4047f2445fdeac7dfe86bedff8175b51d",
  );
  assert.equal(result.contamination_controls.v1_negative_result_preserved, true);
});

test("fixture contains manipulation, affinity, legal, and productive cases", () => {
  const fixture = readFixture();
  const risks = new Set(
    fixture.opportunities.flatMap((opportunity) => opportunity.risk_labels),
  );
  for (const required of [
    "coordinated_buying",
    "fake_volume",
    "affinity_pressure",
    "licensing_gap",
    "environmental_liability",
  ]) {
    assert.ok(risks.has(required), required);
  }
  assert.ok(fixture.opportunities.some((opportunity) => opportunity.productive));
  assert.ok(
    fixture.opportunities.some((opportunity) => opportunity.harmful_if_approved),
  );
});
