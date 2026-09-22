import type {
  ManipulationMatch,
  ManipulationScreen,
  OpportunityPacket,
} from "./model.js";

type ScreeningKey = keyof OpportunityPacket["screening_answers"];

type Rule = {
  rule_id: string;
  category: string;
  screening_key?: ScreeningKey;
  patterns: RegExp[];
  evidence: string;
};

export const ANTI_MANIPULATION_RULES: readonly Rule[] = [
  {
    rule_id: "AM-001",
    category: "coordinated_purchases",
    screening_key: "coordinated_buying",
    patterns: [
      /synchroni[sz]ed?\s+buy/i,
      /countdown.{0,40}\bbuy\b/i,
      /everyone.{0,30}\bbuy\b.{0,30}\b(at|together|now)\b/i,
      /coordinat(?:e|ed|ing).{0,20}(?:buy|purchase)/i,
    ],
    evidence: "Coordinated purchasing is structurally prohibited.",
  },
  {
    rule_id: "AM-002",
    category: "intentional_price_movement",
    screening_key: "price_movement_intent",
    patterns: [
      /\bmove the price\b/i,
      /\bbid (?:it|the asset) up\b/i,
      /\bpump (?:the )?(?:price|coin|token|stock)\b/i,
      /\bcreate price momentum\b/i,
    ],
    evidence: "Intentional price engineering is structurally prohibited.",
  },
  {
    rule_id: "AM-003",
    category: "wash_trading",
    screening_key: "wash_trading",
    patterns: [
      /\bwash trad(?:e|ing)\b/i,
      /\btrade (?:with|between) (?:ourselves|our own accounts)\b/i,
      /\bself[- ]trade\b/i,
    ],
    evidence: "Wash trading is structurally prohibited.",
  },
  {
    rule_id: "AM-004",
    category: "fake_volume",
    screening_key: "fake_volume",
    patterns: [
      /\bfake volume\b/i,
      /\bmanufactur(?:e|ed|ing) volume\b/i,
      /\bvolume bot\b/i,
    ],
    evidence: "Fake or manufactured volume is structurally prohibited.",
  },
  {
    rule_id: "AM-005",
    category: "spoofing",
    screening_key: "spoofing",
    patterns: [
      /\bspoof(?:ing)? orders?\b/i,
      /\blayer(?:ing)? orders?\b/i,
      /\bcancel.{0,30}orders?.{0,30}(?:mislead|signal)\b/i,
    ],
    evidence: "Spoofing and deceptive order placement are prohibited.",
  },
  {
    rule_id: "AM-006",
    category: "deceptive_promotion",
    screening_key: "deceptive_promotion",
    patterns: [
      /\bundisclosed promotion\b/i,
      /\bpromot(?:e|ion).{0,40}without disclosure\b/i,
      /\bmislead(?:ing)? promotion\b/i,
      /\brecruit outsiders.{0,40}exit liquidity\b/i,
    ],
    evidence: "Deceptive or undisclosed promotion is prohibited.",
  },
  {
    rule_id: "AM-007",
    category: "guaranteed_returns",
    screening_key: "guaranteed_returns",
    patterns: [
      /\bguaranteed returns?\b/i,
      /\brisk[- ]free (?:return|profit|investment)\b/i,
      /\bcan(?:not|'t) lose\b/i,
      /\bguaranteed (?:profit|yield)\b/i,
    ],
    evidence: "Guaranteed-return claims are prohibited.",
  },
  {
    rule_id: "AM-008",
    category: "fabricated_partnerships",
    screening_key: "fabricated_partnerships",
    patterns: [
      /\bfake partnership\b/i,
      /\bfabricat(?:e|ed|ing) partnership\b/i,
      /\bclaim.{0,30}partner.{0,30}without (?:proof|verification)\b/i,
    ],
    evidence: "Fabricated partnerships are prohibited.",
  },
  {
    rule_id: "AM-009",
    category: "fake_accounts",
    screening_key: "fake_accounts",
    patterns: [
      /\bfake (?:community )?accounts?\b/i,
      /\bsockpuppets?\b/i,
      /\bbot accounts?.{0,20}(?:hype|promote|vote)\b/i,
    ],
    evidence: "Fake community identities are prohibited.",
  },
  {
    rule_id: "AM-010",
    category: "coordinated_exit",
    screening_key: "coordinated_exit",
    patterns: [
      /\bcoordinated exit\b/i,
      /\beveryone.{0,30}\bsell\b.{0,30}\b(at|together|then)\b/i,
      /\bdump on (?:later|new) buyers\b/i,
      /\borganizers? exit first\b/i,
    ],
    evidence: "Coordinated exits that transfer losses are prohibited.",
  },
  {
    rule_id: "AM-011",
    category: "negative_evidence_suppression",
    screening_key: "suppressed_negative_evidence",
    patterns: [
      /\bsuppress.{0,30}(?:bear|negative|dissent)\b/i,
      /\bdelete.{0,30}dissent\b/i,
      /\bhide.{0,30}(?:loss|liability|counterevidence)\b/i,
    ],
    evidence: "Suppression of negative evidence or dissent is prohibited.",
  },
  {
    rule_id: "AM-012",
    category: "affinity_pressure",
    screening_key: "affinity_pressure",
    patterns: [
      /\bcommunity loyalty\b/i,
      /\breligious duty\b/i,
      /\bbecause (?:we are|you are|you're) (?:immigrants|family|our people)\b/i,
      /\bnationality.{0,30}(?:must|should) invest\b/i,
    ],
    evidence:
      "Affinity, nationality, family, or religious pressure is prohibited.",
  },
  {
    rule_id: "AM-013",
    category: "organizer_custody",
    screening_key: "organizer_custody",
    patterns: [
      /\bsend (?:the )?funds to (?:the )?organizer\b/i,
      /\borganizer (?:controls|holds|custodies) (?:the )?funds\b/i,
      /\borganizer wallet\b/i,
    ],
    evidence:
      "Organizer custody of participant funds is prohibited in initial stages.",
  },
  {
    rule_id: "AM-014",
    category: "outside_capital_intake",
    screening_key: "outside_capital_intake",
    patterns: [
      /\baccept (?:outside|investor|participant) (?:capital|funds|deposits)\b/i,
      /\bpool(?:ed|ing) investor (?:money|capital|funds)\b/i,
    ],
    evidence:
      "Outside-capital intake is prohibited before a legally authorized stage.",
  },
  {
    rule_id: "AM-015",
    category: "owned_asset_public_promotion",
    screening_key: "public_promotion_owned_asset",
    patterns: [
      /\bpromot(?:e|ing) (?:our|an? owned) asset\b/i,
      /\baccumulate first.{0,50}promote\b/i,
      /\bpublic campaign.{0,40}(?:our position|owned asset)\b/i,
    ],
    evidence: "Public promotion tied to an owned position is prohibited.",
  },
] as const;

function flattenText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).join("\n");
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(flattenText)
      .join("\n");
  }
  return "";
}

export function classifyManipulation(
  opportunity: OpportunityPacket,
  additionalText: readonly string[] = [],
): ManipulationScreen {
  const text = `${flattenText(opportunity)}\n${additionalText.join("\n")}`;
  const matches: ManipulationMatch[] = [];

  for (const rule of ANTI_MANIPULATION_RULES) {
    const structuredMatch =
      rule.screening_key !== undefined &&
      opportunity.screening_answers[rule.screening_key];
    const pattern = rule.patterns.find((candidate) => candidate.test(text));

    if (structuredMatch || pattern) {
      matches.push({
        rule_id: rule.rule_id,
        category: rule.category,
        evidence: structuredMatch
          ? `${rule.evidence} Proposer screening answer was true.`
          : `${rule.evidence} Text matched ${pattern?.source ?? "unknown pattern"}.`,
      });
    }
  }

  if (!opportunity.proposer_holdings.disclosed) {
    matches.push({
      rule_id: "AM-016",
      category: "undisclosed_holdings",
      evidence: "Proposer holdings were not affirmatively disclosed.",
    });
  }

  if (!opportunity.proposer_compensation.disclosed) {
    matches.push({
      rule_id: "AM-017",
      category: "concealed_compensation",
      evidence: "Proposer compensation was not affirmatively disclosed.",
    });
  }

  if (opportunity.conflicts.some((conflict) => !conflict.disclosed)) {
    matches.push({
      rule_id: "AM-018",
      category: "hidden_conflicts",
      evidence: "At least one material conflict was marked undisclosed.",
    });
  }

  return {
    status: matches.length > 0 ? "blocked" : "clear",
    risk_level: matches.length > 0 ? "critical" : "none",
    matches,
    default_action:
      matches.length > 0 ? "refuse" : "continue_simulation_review",
    classifier_version: "pumpstation-anti-manipulation/1.0.0",
  };
}

export function classifyManipulationFailClosed(
  opportunity: OpportunityPacket,
  additionalText: readonly string[] = [],
  classifier: typeof classifyManipulation = classifyManipulation,
): ManipulationScreen {
  try {
    return classifier(opportunity, additionalText);
  } catch {
    return {
      status: "error",
      risk_level: "critical",
      matches: [
        {
          rule_id: "AM-FAIL-CLOSED",
          category: "classifier_failure",
          evidence:
            "Manipulation classifier failed; policy requires refusal rather than execution or progression.",
        },
      ],
      default_action: "refuse",
      classifier_version: "pumpstation-anti-manipulation/1.0.0",
    };
  }
}
