import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type RecordShape = {
  decision_id: string;
  alternatives: Array<{ name: string }>;
  do_nothing_option: { name: string };
  roles: Array<{ name: string }>;
  pass_1: { disadvantages: Array<{ id: string }> };
  pass_2: {
    disadvantage_dispositions: Array<{ disadvantage_id: string }>;
  };
  dissent: Array<{ position: string; evidence_threshold: string }>;
  decision: string;
  authority_impact: string;
};

function readRecord(): RecordShape {
  return JSON.parse(
    readFileSync(
      new URL(
        "../../governance/deliberations/ps-adr-0004.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as RecordShape;
}

test("Kernel integration decision satisfies recursive collaboration protocol", () => {
  const record = readRecord();
  const requiredRoles = new Set([
    "Founder-Intent Steward",
    "Systems Architect",
    "Adversarial Reviewer",
    "Operator and Maintainer",
    "Evidence and Welfare Guardian",
  ]);
  const presentRoles = new Set(record.roles.map((role) => role.name));
  assert.match(record.decision_id, /^PS-DEL-/);
  assert.ok(record.alternatives.length >= 3);
  assert.ok(record.do_nothing_option.name.length > 0);
  for (const role of requiredRoles) assert.ok(presentRoles.has(role), role);

  const disadvantageIds = record.pass_1.disadvantages.map((item) => item.id);
  assert.equal(new Set(disadvantageIds).size, disadvantageIds.length);
  assert.ok(disadvantageIds.length > 0);
  const dispositions = new Set(
    record.pass_2.disadvantage_dispositions.map(
      (item) => item.disadvantage_id,
    ),
  );
  for (const disadvantageId of disadvantageIds) {
    assert.ok(dispositions.has(disadvantageId), disadvantageId);
  }
  assert.ok(record.dissent.length >= 2);
  for (const dissent of record.dissent) {
    assert.ok(dissent.position.length > 0);
    assert.ok(dissent.evidence_threshold.length > 0);
  }
  assert.equal(record.decision, "EXPERIMENT");
  assert.match(record.authority_impact, /None/);
});
