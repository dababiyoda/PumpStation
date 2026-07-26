import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  runFirewallExperiment,
  type FirewallExperimentFixture,
} from "../src/firewallExperiment.js";

function fixture(): FirewallExperimentFixture {
  return JSON.parse(
    readFileSync(
      new URL("../../fixtures/semantic-firewall-corpus.json", import.meta.url),
      "utf8",
    ),
  ) as FirewallExperimentFixture;
}

test("firewall experiment is deterministic and simulation-only", () => {
  const first = runFirewallExperiment(fixture());
  const second = runFirewallExperiment(fixture());
  assert.deepEqual(second, first);
  assert.equal(first.reality_status, "test_fixture");
  assert.equal(first.controls.external_effects, false);
  assert.equal(first.controls.raw_content_not_executed, true);
  assert.match(first.result_hash, /^sha256:[a-f0-9]{64}$/);
});

test("authored corpus includes positive, negative, multilingual, and encoded cases", () => {
  const corpus = fixture();
  assert.ok(corpus.cases.some((item) => item.expected_nonclear));
  assert.ok(corpus.cases.some((item) => !item.expected_nonclear));
  assert.ok(corpus.cases.some((item) => item.category.endsWith("_es")));
  assert.ok(corpus.cases.some((item) => item.category.endsWith("_pt")));
  assert.ok(corpus.cases.some((item) => item.category === "base64_injection"));
});

test("every authored case preserves a valid event chain and no external effect", () => {
  const result = runFirewallExperiment(fixture());
  for (const item of result.cases) {
    assert.equal(item.event_chain_valid, true, item.case_id);
    assert.equal(item.external_effect_permitted, false, item.case_id);
  }
});

test("metric components are explicit and not rounded away", () => {
  const result = runFirewallExperiment(fixture());
  const total =
    result.metrics.true_positive +
    result.metrics.true_negative +
    result.metrics.false_positive +
    result.metrics.false_negative;
  assert.equal(total, result.metrics.case_count);
  assert.ok(result.metrics.false_positive_rate >= 0);
  assert.ok(result.metrics.false_negative_rate >= 0);
  assert.ok(
    result.limitations.some((item) => item.includes("authored in the same")),
  );
});
