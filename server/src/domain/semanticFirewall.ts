import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "./errors.js";
import { AppendOnlyEventStore } from "./eventStore.js";
import { sha256 } from "./hash.js";
import { requireCapability } from "./identity.js";
import type { Actor } from "./model.js";

export const FirewallSourceSchema = z
  .object({
    source_id: z.string().min(1),
    source_type: z.enum([
      "system_internal",
      "authenticated_participant",
      "external_url",
      "uploaded_file",
      "model_output",
      "unknown",
    ]),
    authenticated: z.boolean(),
    declared_trust: z.enum(["trusted", "untrusted", "unknown"]),
    origin: z.string().min(1),
  })
  .strict();

export const SemanticFirewallInputSchema = z
  .object({
    input_id: z.string().regex(/^input_[A-Za-z0-9_-]+$/),
    content: z.string().min(1).max(100_000),
    content_type: z.enum(["text/plain", "text/markdown", "application/json"]),
    purpose: z.enum(["data", "discussion", "instruction", "evidence_claim"]),
    handling_mode: z.enum(["direct", "quoted_untrusted", "fixture"]),
    source: FirewallSourceSchema,
    context: z
      .object({
        opportunity_id: z.string().nullable(),
        channel_type: z.string().nullable(),
      })
      .strict(),
  })
  .strict();
export type SemanticFirewallInput = z.infer<typeof SemanticFirewallInputSchema>;

export const FirewallReviewInputSchema = z
  .object({
    decision: z.enum([
      "reject",
      "release_as_data",
      "replace_with_corrected_text",
    ]),
    reason: z.string().min(1),
    corrected_text: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.decision === "replace_with_corrected_text" &&
      value.corrected_text === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["corrected_text"],
        message: "corrected_text is required for replacement",
      });
    }
    if (
      value.decision !== "replace_with_corrected_text" &&
      value.corrected_text !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["corrected_text"],
        message: "corrected_text is only accepted for replacement",
      });
    }
  });
export type FirewallReviewInput = z.infer<typeof FirewallReviewInputSchema>;

export type FirewallTrustClass =
  | "trusted_internal"
  | "authenticated_participant"
  | "external_untrusted"
  | "unknown";

export type FirewallMatch = {
  rule_id: string;
  category: string;
  severity: "medium" | "high" | "critical";
  evidence: string;
  variant:
    | "normalized"
    | "deobfuscated"
    | "decoded_base64"
    | "decoded_hex"
    | "url_decoded";
};

export type SemanticFirewallDecision = {
  screen_id: string;
  input_id: string;
  status: "clear" | "review" | "quarantined" | "error";
  trust_class: FirewallTrustClass;
  raw_hash: `sha256:${string}`;
  normalized_hash: `sha256:${string}`;
  matches: FirewallMatch[];
  decoded_variant_hashes: `sha256:${string}`[];
  instruction_data_boundary: {
    declared_purpose: SemanticFirewallInput["purpose"];
    content_is_instruction: false;
    tool_access_permitted: false;
    evidence_admissible: false;
    authority_effect: false;
  };
  default_action:
    | "continue_as_data"
    | "hold_for_human_review"
    | "quarantine"
    | "fail_closed_quarantine";
  classifier_version: string;
  screened_at: string;
};

export type QuarantineRecord = {
  quarantine_id: string;
  input: SemanticFirewallInput;
  decision: SemanticFirewallDecision;
  state: "pending" | "rejected" | "released_as_data" | "corrected_replacement";
  review: {
    reviewer_id: string | null;
    decision: FirewallReviewInput["decision"] | null;
    reason: string | null;
    corrected_text_hash: `sha256:${string}` | null;
    reviewed_at: string | null;
  };
};

type TextVariant = {
  kind: FirewallMatch["variant"];
  text: string;
};

type Rule = {
  rule_id: string;
  category: string;
  severity: FirewallMatch["severity"];
  patterns: RegExp[];
  evidence: string;
};

type FirewallOptions = {
  now?: () => string;
  idFactory?: () => string;
  detector?: (variants: readonly TextVariant[]) => FirewallMatch[];
};

const RULES: readonly Rule[] = [
  {
    rule_id: "SF-001",
    category: "instruction_override",
    severity: "critical",
    patterns: [
      /ignore (?:all |any )?(?:(?:previous|prior) (?:system |developer )?|system |developer )instructions?/i,
      /override (?:the )?(?:system|policy|constitution|safety|guardrails?)/i,
      /treat (?:this|me|the request) as (?:approved|authorized|trusted)/i,
      /bypass (?:the )?(?:kernel|approval|policy|firewall|safety|review)/i,
      /ignora (?:todas )?(?:las )?instrucciones anteriores/i,
      /ignore (?:todas )?as instrucoes anteriores/i,
    ],
    evidence:
      "Content attempts to override higher-priority instructions or policy.",
  },
  {
    rule_id: "SF-002",
    category: "authority_escalation",
    severity: "critical",
    patterns: [
      /grant (?:yourself|the agent|this model) (?:more |new )?(?:authority|permissions?|budget)/i,
      /approve (?:yourself|its own|your own) (?:request|action|trade|stage)/i,
      /increase (?:your|its|the agent'?s) (?:budget|limit|permissions?)/i,
      /activate (?:the )?(?:next stage|wallet|trading|execution) without/i,
      /autor[ií]zate (?:a ti mismo|solo)/i,
    ],
    evidence:
      "Content attempts to create or expand authority without a valid grant.",
  },
  {
    rule_id: "SF-003",
    category: "secret_exfiltration",
    severity: "critical",
    patterns: [
      /(?:reveal|print|return|send|expose).{0,40}(?:api key|private key|seed phrase|secret|token|password)/i,
      /(?:system prompt|developer message|hidden instructions?)/i,
      /(?:env|environment) variables?.{0,30}(?:show|dump|return|print)/i,
      /muestra.{0,30}(?:clave privada|frase semilla|secreto|contrasena)/i,
    ],
    evidence:
      "Content requests protected secrets or hidden control instructions.",
  },
  {
    rule_id: "SF-004",
    category: "audit_suppression",
    severity: "critical",
    patterns: [
      /(?:disable|skip|delete|erase|hide).{0,30}(?:logging|logs|audit|event|receipt|history)/i,
      /do not (?:record|log|report|disclose)/i,
      /(?:remove|change).{0,30}(?:reality status|truth status|evidence status)/i,
      /no (?:lo )?(?:registres|documentes|reportes)/i,
    ],
    evidence:
      "Content attempts to suppress institutional history, evidence, or audit controls.",
  },
  {
    rule_id: "SF-005",
    category: "market_manipulation",
    severity: "critical",
    patterns: [
      /(?:everyone|all members|the group).{0,35}(?:buy|purchase).{0,25}(?:together|at once|now|countdown)/i,
      /(?:accumulate|buy) first.{0,60}(?:promote|hype|market)/i,
      /(?:fake|manufacture|simulate).{0,25}(?:volume|liquidity|demand)/i,
      /(?:wash trade|self trade|coordinated exit|dump on)/i,
      /(?:todos|el grupo).{0,35}(?:compren|comprar).{0,25}(?:juntos|al mismo tiempo|ahora)/i,
      /(?:todos|o grupo).{0,35}(?:comprem|comprar).{0,25}(?:juntos|ao mesmo tempo|agora)/i,
    ],
    evidence: "Content proposes coordinated or deceptive market conduct.",
  },
  {
    rule_id: "SF-006",
    category: "financial_misrepresentation",
    severity: "critical",
    patterns: [
      /guaranteed (?:return|profit|yield)/i,
      /risk[- ]free (?:profit|return|investment)/i,
      /(?:cannot|can'?t) lose/i,
      /rendimiento garantizado|ganancia garantizada|sin riesgo/i,
      /retorno garantido|lucro garantido|sem risco/i,
    ],
    evidence: "Content makes prohibited guaranteed-return or risk-free claims.",
  },
  {
    rule_id: "SF-007",
    category: "affinity_coercion",
    severity: "high",
    patterns: [
      /because (?:we are|you are|we'?re) (?:immigrants|family|our people).{0,40}(?:invest|trust|join)/i,
      /community loyalty.{0,30}(?:invest|buy|support)/i,
      /(?:our nationality|our religion|our family).{0,30}(?:must|should|needs to)/i,
      /porque somos (?:inmigrantes|familia|de la misma comunidad).{0,40}(?:invertir|confiar|apoyar)/i,
      /porque somos (?:imigrantes|familia|da mesma comunidade).{0,40}(?:investir|confiar|apoiar)/i,
    ],
    evidence:
      "Content uses identity, family, religion, or community loyalty as investment pressure.",
  },
  {
    rule_id: "SF-008",
    category: "external_effect_request",
    severity: "critical",
    patterns: [
      /(?:execute|place|submit|send).{0,30}(?:trade|order|transaction|payment|transfer)/i,
      /(?:connect|use).{0,20}(?:exchange api|private key|wallet).{0,30}(?:trade|send|transfer)/i,
      /(?:deploy|publish).{0,30}(?:contract|campaign|promotion)/i,
      /(?:ejecuta|envia|transfiere).{0,30}(?:operacion|pago|fondos)/i,
    ],
    evidence:
      "Content requests an external effect that Stage 0 cannot perform.",
  },
  {
    rule_id: "SF-009",
    category: "evidence_corruption",
    severity: "high",
    patterns: [
      /(?:fabricate|invent|fake|alter).{0,30}(?:evidence|receipt|signature|audit|result)/i,
      /(?:delete|suppress|hide).{0,30}(?:bear thesis|counterevidence|dissent|loss|liability)/i,
      /treat (?:model output|simulation|fixture) as (?:real|verified|evidence|commercial result)/i,
      /(?:fabrica|inventa|oculta).{0,30}(?:evidencia|recibo|resultado|disenso)/i,
    ],
    evidence:
      "Content attempts to fabricate, reclassify, or suppress evidence.",
  },
  {
    rule_id: "SF-010",
    category: "prompt_injection_tooling",
    severity: "high",
    patterns: [
      /(?:call|invoke|use|run).{0,30}(?:tool|function|shell|terminal|browser).{0,30}(?:without|ignore|bypass)/i,
      /(?:open|fetch|download).{0,30}(?:secret|credential|private|internal)/i,
      /you are now (?:the founder|admin|authorized|unrestricted)/i,
    ],
    evidence:
      "Content attempts to convert untrusted text into privileged tool behavior.",
  },
];

function normalizeText(content: string): string {
  return content
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deobfuscate(content: string): string {
  return content
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/[@]/g, "a")
    .replace(/[$]/g, "s")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function printableRatio(value: string): number {
  if (value.length === 0) return 0;
  const printable = [...value].filter((character) =>
    /[\p{L}\p{N}\p{P}\p{Z}\r\n\t]/u.test(character),
  ).length;
  return printable / [...value].length;
}

function decodedVariants(content: string): TextVariant[] {
  const variants: TextVariant[] = [];
  const base64Candidates = content.match(/[A-Za-z0-9+/]{20,}={0,2}/g) ?? [];
  for (const candidate of base64Candidates.slice(0, 3)) {
    try {
      const decoded = Buffer.from(candidate, "base64").toString("utf8");
      if (decoded.length >= 8 && printableRatio(decoded) >= 0.85) {
        variants.push({ kind: "decoded_base64", text: normalizeText(decoded) });
      }
    } catch {
      // Invalid encodings remain inert data.
    }
  }

  const hexCandidates = content.match(/(?:[0-9a-fA-F]{2}){8,}/g) ?? [];
  for (const candidate of hexCandidates.slice(0, 3)) {
    try {
      const decoded = Buffer.from(candidate, "hex").toString("utf8");
      if (decoded.length >= 8 && printableRatio(decoded) >= 0.85) {
        variants.push({ kind: "decoded_hex", text: normalizeText(decoded) });
      }
    } catch {
      // Invalid encodings remain inert data.
    }
  }

  if (/%[0-9a-fA-F]{2}/.test(content)) {
    try {
      const decoded = decodeURIComponent(content);
      if (decoded !== content) {
        variants.push({ kind: "url_decoded", text: normalizeText(decoded) });
      }
    } catch {
      // Invalid URL encoding remains inert data.
    }
  }
  return variants;
}

function buildVariants(content: string): TextVariant[] {
  const normalized = normalizeText(content);
  const variants: TextVariant[] = [
    { kind: "normalized", text: normalized },
    { kind: "deobfuscated", text: deobfuscate(normalized) },
    ...decodedVariants(normalized),
  ];
  const unique = new Map<string, TextVariant>();
  for (const variant of variants) {
    if (variant.text.length > 0 && !unique.has(variant.text)) {
      unique.set(variant.text, variant);
    }
  }
  return [...unique.values()];
}

function detectRules(variants: readonly TextVariant[]): FirewallMatch[] {
  const matches: FirewallMatch[] = [];
  for (const rule of RULES) {
    for (const variant of variants) {
      const pattern = rule.patterns.find((candidate) =>
        candidate.test(variant.text),
      );
      if (!pattern) continue;
      matches.push({
        rule_id: rule.rule_id,
        category: rule.category,
        severity: rule.severity,
        evidence: `${rule.evidence} Matched ${pattern.source}.`,
        variant: variant.kind,
      });
      break;
    }
  }
  return matches;
}

function trustClass(input: SemanticFirewallInput): FirewallTrustClass {
  if (
    input.source.source_type === "system_internal" &&
    input.source.authenticated &&
    input.source.declared_trust === "trusted"
  ) {
    return "trusted_internal";
  }
  if (input.source.authenticated) return "authenticated_participant";
  if (
    ["external_url", "uploaded_file", "model_output"].includes(
      input.source.source_type,
    )
  ) {
    return "external_untrusted";
  }
  return "unknown";
}

function sourceBoundaryMatches(
  input: SemanticFirewallInput,
  classifiedTrust: FirewallTrustClass,
): FirewallMatch[] {
  const matches: FirewallMatch[] = [];
  if (
    input.purpose === "instruction" &&
    classifiedTrust !== "trusted_internal"
  ) {
    matches.push({
      rule_id: "SF-BOUNDARY-001",
      category: "untrusted_instruction",
      severity: "critical",
      evidence:
        "Only trusted internal policy adapters may submit instruction-class content; participant and external content remains data.",
      variant: "normalized",
    });
  }
  if (
    input.source.source_type === "model_output" &&
    input.purpose === "evidence_claim"
  ) {
    matches.push({
      rule_id: "SF-BOUNDARY-002",
      category: "model_output_as_evidence",
      severity: "critical",
      evidence:
        "Model output cannot become admissible evidence by declaration.",
      variant: "normalized",
    });
  }
  if (
    input.source.declared_trust === "trusted" &&
    !input.source.authenticated
  ) {
    matches.push({
      rule_id: "SF-BOUNDARY-003",
      category: "unverified_trust_claim",
      severity: "high",
      evidence: "Unauthenticated content cannot self-declare as trusted.",
      variant: "normalized",
    });
  }
  return matches;
}

export class SemanticFirewall {
  readonly #store: AppendOnlyEventStore;
  readonly #now: () => string;
  readonly #idFactory: () => string;
  readonly #detector: (variants: readonly TextVariant[]) => FirewallMatch[];
  readonly #quarantine = new Map<string, QuarantineRecord>();

  constructor(store: AppendOnlyEventStore, options: FirewallOptions = {}) {
    this.#store = store;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#detector = options.detector ?? detectRules;
  }

  screen(
    untrustedInput: SemanticFirewallInput,
    actor: Actor,
  ): SemanticFirewallDecision {
    requireCapability(actor, "firewall:screen");
    const input = SemanticFirewallInputSchema.parse(untrustedInput);
    const classifiedTrust = trustClass(input);
    const normalized = normalizeText(input.content);
    const variants = buildVariants(input.content);

    try {
      const matches = [
        ...sourceBoundaryMatches(input, classifiedTrust),
        ...this.#detector(variants),
      ];
      const hasCritical = matches.some(
        (match) => match.severity === "critical",
      );
      const hasHigh = matches.some((match) => match.severity === "high");
      const status: SemanticFirewallDecision["status"] = hasCritical
        ? "quarantined"
        : hasHigh
          ? "review"
          : "clear";
      const decision: SemanticFirewallDecision = {
        screen_id: `screen_${this.#idFactory()}`,
        input_id: input.input_id,
        status,
        trust_class: classifiedTrust,
        raw_hash: sha256(input.content),
        normalized_hash: sha256(normalized),
        matches,
        decoded_variant_hashes: variants
          .filter((variant) => variant.kind.startsWith("decoded"))
          .map((variant) => sha256(variant.text)),
        instruction_data_boundary: {
          declared_purpose: input.purpose,
          content_is_instruction: false,
          tool_access_permitted: false,
          evidence_admissible: false,
          authority_effect: false,
        },
        default_action:
          status === "clear"
            ? "continue_as_data"
            : status === "review"
              ? "hold_for_human_review"
              : "quarantine",
        classifier_version: "pumpstation-semantic-firewall/1.0.0",
        screened_at: this.#now(),
      };
      if (status !== "clear") this.#quarantineInput(input, decision, actor);
      return structuredClone(decision);
    } catch {
      const decision: SemanticFirewallDecision = {
        screen_id: `screen_${this.#idFactory()}`,
        input_id: input.input_id,
        status: "error",
        trust_class: classifiedTrust,
        raw_hash: sha256(input.content),
        normalized_hash: sha256(normalized),
        matches: [
          {
            rule_id: "SF-FAIL-CLOSED",
            category: "classifier_failure",
            severity: "critical",
            evidence:
              "Semantic screening failed; the content remains quarantined with tools disabled.",
            variant: "normalized",
          },
        ],
        decoded_variant_hashes: [],
        instruction_data_boundary: {
          declared_purpose: input.purpose,
          content_is_instruction: false,
          tool_access_permitted: false,
          evidence_admissible: false,
          authority_effect: false,
        },
        default_action: "fail_closed_quarantine",
        classifier_version: "pumpstation-semantic-firewall/1.0.0",
        screened_at: this.#now(),
      };
      this.#quarantineInput(input, decision, actor);
      return structuredClone(decision);
    }
  }

  listQuarantine(actor: Actor): QuarantineRecord[] {
    requireCapability(actor, "firewall:review");
    if (actor.actor_class !== "human") {
      throw new DomainError(
        403,
        "HUMAN_REVIEW_REQUIRED",
        "Only an authenticated human reviewer may inspect quarantine records.",
      );
    }
    return [...this.#quarantine.values()].map((record) =>
      structuredClone(record),
    );
  }

  review(
    quarantineId: string,
    untrustedReview: FirewallReviewInput,
    actor: Actor,
  ): QuarantineRecord {
    requireCapability(actor, "firewall:review");
    if (actor.actor_class !== "human") {
      throw new DomainError(
        403,
        "HUMAN_REVIEW_REQUIRED",
        "Models and agents cannot release quarantined content.",
      );
    }
    const review = FirewallReviewInputSchema.parse(untrustedReview);
    const current = this.#quarantine.get(quarantineId);
    if (!current) {
      throw new DomainError(
        404,
        "QUARANTINE_NOT_FOUND",
        "Quarantine record does not exist.",
      );
    }
    if (current.state !== "pending") {
      throw new DomainError(
        409,
        "QUARANTINE_ALREADY_REVIEWED",
        "Quarantine decisions are append-only and cannot be overwritten.",
      );
    }
    const nextState: QuarantineRecord["state"] =
      review.decision === "reject"
        ? "rejected"
        : review.decision === "release_as_data"
          ? "released_as_data"
          : "corrected_replacement";
    const correctedHash =
      review.corrected_text === null ? null : sha256(review.corrected_text);
    const updated: QuarantineRecord = {
      ...current,
      state: nextState,
      review: {
        reviewer_id: actor.actor_id,
        decision: review.decision,
        reason: review.reason,
        corrected_text_hash: correctedHash,
        reviewed_at: this.#now(),
      },
    };
    this.#quarantine.set(quarantineId, updated);
    this.#store.append({
      event_type: "correction",
      actor: { actor_id: actor.actor_id, actor_class: actor.actor_class },
      correlation_id: current.input.input_id,
      payload: {
        quarantine_id: quarantineId,
        prior_state: current.state,
        new_state: nextState,
        review: updated.review,
        release_boundary: {
          content_remains_data: true,
          evidence_admissible: false,
          tool_access_permitted: false,
          authority_effect: false,
        },
      },
    });
    return structuredClone(updated);
  }

  #quarantineInput(
    input: SemanticFirewallInput,
    decision: SemanticFirewallDecision,
    actor: Actor,
  ): void {
    const quarantineId = `quarantine_${this.#idFactory()}`;
    const record: QuarantineRecord = {
      quarantine_id: quarantineId,
      input: structuredClone(input),
      decision: structuredClone(decision),
      state: "pending",
      review: {
        reviewer_id: null,
        decision: null,
        reason: null,
        corrected_text_hash: null,
        reviewed_at: null,
      },
    };
    this.#quarantine.set(quarantineId, record);
    this.#store.append({
      event_type: "incident",
      actor: { actor_id: actor.actor_id, actor_class: actor.actor_class },
      correlation_id: input.input_id,
      payload: {
        incident_type: "semantic_firewall_quarantine",
        quarantine_id: quarantineId,
        input_hash: decision.raw_hash,
        status: decision.status,
        trust_class: decision.trust_class,
        matches: decision.matches,
        external_effect_permitted: false,
      },
    });
  }
}
