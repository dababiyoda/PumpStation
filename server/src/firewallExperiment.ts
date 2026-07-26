import { AppendOnlyEventStore } from "./domain/eventStore.js";
import { sha256 } from "./domain/hash.js";
import type { Actor } from "./domain/model.js";
import {
  SemanticFirewall,
  type SemanticFirewallInput,
} from "./domain/semanticFirewall.js";

type FirewallCorpusCase = {
  case_id: string;
  category: string;
  content: string;
  purpose: SemanticFirewallInput["purpose"];
  handling_mode: SemanticFirewallInput["handling_mode"];
  source_type: SemanticFirewallInput["source"]["source_type"];
  authenticated: boolean;
  declared_trust: SemanticFirewallInput["source"]["declared_trust"];
  expected_nonclear: boolean;
};

export type FirewallExperimentFixture = {
  fixture_metadata: {
    fixture_id: string;
    classification: "test_fixture";
    created_at: string;
    warning: string;
    seed: number;
  };
  cases: FirewallCorpusCase[];
};

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

export function runFirewallExperiment(fixture: FirewallExperimentFixture) {
  const actor: Actor = {
    actor_id: "human:firewall-experiment",
    actor_class: "human",
    capabilities: ["firewall:screen", "firewall:review"],
    expires_at: "2099-01-01T00:00:00.000Z",
    purpose: "Synthetic semantic firewall evaluation",
    data_scope: ["test_fixture"],
    resource_ceiling: 0,
    revoked: false,
  };
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  const categoryResults: Record<
    string,
    { cases: number; correct: number; nonclear: number }
  > = {};
  const cases = fixture.cases.map((testCase, index) => {
    let sequence = 0;
    const store = new AppendOnlyEventStore({
      logPath: ":memory:",
      now: () => fixture.fixture_metadata.created_at,
      idFactory: () => `event-${index}-${++sequence}`,
    });
    const firewall = new SemanticFirewall(store, {
      now: () => fixture.fixture_metadata.created_at,
      idFactory: () => `firewall-${index}-${++sequence}`,
    });
    const decision = firewall.screen(
      {
        input_id: `input_${testCase.case_id}`,
        content: testCase.content,
        content_type: "text/plain",
        purpose: testCase.purpose,
        handling_mode: testCase.handling_mode,
        source: {
          source_id: `source_${testCase.case_id}`,
          source_type: testCase.source_type,
          authenticated: testCase.authenticated,
          declared_trust: testCase.declared_trust,
          origin: `fixture://${testCase.case_id}`,
        },
        context: {
          opportunity_id: null,
          channel_type: null,
        },
      },
      actor,
    );
    const predictedNonclear = decision.status !== "clear";
    const correct = predictedNonclear === testCase.expected_nonclear;
    if (testCase.expected_nonclear && predictedNonclear) truePositive += 1;
    else if (!testCase.expected_nonclear && !predictedNonclear)
      trueNegative += 1;
    else if (!testCase.expected_nonclear && predictedNonclear)
      falsePositive += 1;
    else falseNegative += 1;

    const category = categoryResults[testCase.category] ?? {
      cases: 0,
      correct: 0,
      nonclear: 0,
    };
    category.cases += 1;
    if (correct) category.correct += 1;
    if (predictedNonclear) category.nonclear += 1;
    categoryResults[testCase.category] = category;

    return {
      case_id: testCase.case_id,
      category: testCase.category,
      expected_nonclear: testCase.expected_nonclear,
      observed_status: decision.status,
      correct,
      match_rule_ids: decision.matches.map((match) => match.rule_id),
      decoded_variant_count: decision.decoded_variant_hashes.length,
      event_chain_valid: store.verify().valid,
      external_effect_permitted: false,
    };
  });

  const positives = truePositive + falseNegative;
  const negatives = trueNegative + falsePositive;
  const resultWithoutHash = {
    experiment_id: "semantic-firewall-authored-corpus-v1",
    reality_status: "test_fixture" as const,
    fixture_id: fixture.fixture_metadata.fixture_id,
    fixture_hash: sha256(fixture),
    seed: fixture.fixture_metadata.seed,
    generated_at: fixture.fixture_metadata.created_at,
    warning: fixture.fixture_metadata.warning,
    metrics: {
      case_count: fixture.cases.length,
      true_positive: truePositive,
      true_negative: trueNegative,
      false_positive: falsePositive,
      false_negative: falseNegative,
      recall: ratio(truePositive, positives),
      specificity: ratio(trueNegative, negatives),
      false_positive_rate: ratio(falsePositive, negatives),
      false_negative_rate: ratio(falseNegative, positives),
      accuracy: ratio(truePositive + trueNegative, fixture.cases.length),
    },
    category_results: categoryResults,
    cases,
    controls: {
      raw_content_not_executed: true,
      tools_disabled: true,
      evidence_admission_disabled: true,
      external_effects: false,
      human_only_quarantine_release: true,
    },
    limitations: [
      "The corpus and detector were authored in the same development phase and may encode shared assumptions.",
      "The corpus is small and cannot establish general semantic, multilingual, or prompt-injection robustness.",
      "No independent red team, model classifier, production traffic, or participant data was used.",
      "A clear result means only that authored rules did not match; it never creates instruction, evidence, tool, or authority status.",
    ],
  };
  return { ...resultWithoutHash, result_hash: sha256(resultWithoutHash) };
}
