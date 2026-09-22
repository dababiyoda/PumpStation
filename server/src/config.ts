export const OPERATING_MODE = "PUMPSTATION_LABS_SIMULATION_ONLY" as const;
export const CURRENT_STAGE = 0 as const;
export const UNAUTHORIZED_EXTERNAL_EFFECTS = 0 as const;

export const PUBLIC_WARNINGS = [
  "SIMULATION ONLY",
  "NO REAL MONEY",
  "NO INVESTMENT OFFER",
  "NO COORDINATED MARKET ACTION",
  "NO PUBLIC ASSET PROMOTION",
  "MODEL OUTPUT IS NOT FINANCIAL EVIDENCE",
] as const;

export const AUTHORITY_RULE =
  "Models reason. Agents propose. Policies and authorized humans decide. The UNIIMENTE Kernel determines what may become real. Reality determines what was correct.";

export const PROHIBITED_ROUTE_PREFIXES = [
  "/api/v1/execution",
  "/api/v1/orders",
  "/api/v1/trades",
  "/api/v1/transfers",
  "/api/v1/deposits",
  "/api/v1/pooled-capital",
  "/api/v1/custody",
  "/api/v1/promotion-campaigns",
] as const;

export const REQUIRED_DECISION_CHANNELS = [
  "bull_thesis",
  "bear_thesis",
  "conflicts",
  "legal_questions",
  "security",
  "community_impact",
] as const;

export const AGENT_ROLES = [
  "Opportunity Scout",
  "Evidence Researcher",
  "Fundamental Underwriter",
  "Adversarial Reviewer",
  "Community Benefit Reviewer",
  "Legal and Compliance Screener",
  "Security Reviewer",
  "Portfolio and Resource Allocator",
  "Reconciliation Agent",
  "Institutional Memory Agent",
] as const;
