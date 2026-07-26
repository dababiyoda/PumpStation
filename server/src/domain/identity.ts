import { randomBytes, randomUUID } from "node:crypto";
import { getAddress, verifyMessage } from "ethers";
import { DomainError } from "./errors.js";
import type { Actor } from "./model.js";

type IdentityOptions = {
  domain: string;
  origin: string;
  founderAddress?: string;
  sessionTtlSeconds?: number;
  now?: () => Date;
};

type Challenge = {
  nonce: string;
  address: string;
  chain_id: number;
  message: string;
  issued_at: string;
  expires_at: string;
  used: boolean;
};

type Session = {
  token: string;
  actor: Actor;
};

export class IdentityService {
  readonly #domain: string;
  readonly #origin: string;
  readonly #founderAddress: string | null;
  readonly #sessionTtlSeconds: number;
  readonly #now: () => Date;
  readonly #challenges = new Map<string, Challenge>();
  readonly #sessions = new Map<string, Session>();

  constructor(options: IdentityOptions) {
    this.#domain = options.domain;
    this.#origin = options.origin;
    this.#founderAddress = options.founderAddress
      ? getAddress(options.founderAddress)
      : null;
    this.#sessionTtlSeconds = options.sessionTtlSeconds ?? 3600;
    this.#now = options.now ?? (() => new Date());
  }

  createChallenge(input: { address: string; chain_id: number }): Challenge {
    const address = getAddress(input.address);
    if (!Number.isSafeInteger(input.chain_id) || input.chain_id <= 0) {
      throw new DomainError(
        400,
        "INVALID_CHAIN_ID",
        "chain_id must be a positive integer",
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const issued = this.#now();
    const expires = new Date(issued.getTime() + 5 * 60 * 1000);
    const message = [
      `${this.#domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      "Authenticate to PumpStation Labs for identity only. This signature does not authorize an investment, asset transfer, transaction, order, or custody.",
      "",
      `URI: ${this.#origin}`,
      "Version: 1",
      `Chain ID: ${input.chain_id}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issued.toISOString()}`,
      `Expiration Time: ${expires.toISOString()}`,
      `Request ID: identity_${randomUUID()}`,
    ].join("\n");
    const challenge: Challenge = {
      nonce,
      address,
      chain_id: input.chain_id,
      message,
      issued_at: issued.toISOString(),
      expires_at: expires.toISOString(),
      used: false,
    };
    this.#challenges.set(nonce, challenge);
    return structuredClone(challenge);
  }

  verifyChallenge(input: {
    address: string;
    nonce: string;
    signature: string;
  }): Session {
    const challenge = this.#challenges.get(input.nonce);
    if (!challenge || challenge.used) {
      throw new DomainError(
        401,
        "CHALLENGE_INVALID",
        "Challenge is missing, expired, or already used.",
      );
    }

    if (new Date(challenge.expires_at).getTime() <= this.#now().getTime()) {
      throw new DomainError(401, "CHALLENGE_EXPIRED", "Challenge has expired.");
    }

    const address = getAddress(input.address);
    const recovered = getAddress(
      verifyMessage(challenge.message, input.signature),
    );
    if (address !== challenge.address || recovered !== challenge.address) {
      throw new DomainError(
        401,
        "SIGNATURE_INVALID",
        "Signature does not match the challenged wallet.",
      );
    }

    challenge.used = true;
    const expires = new Date(
      this.#now().getTime() + this.#sessionTtlSeconds * 1000,
    ).toISOString();
    const capabilities = [
      "opportunity:submit",
      "deliberation:write",
      "simulation:compile",
      "stage:request",
      "firewall:screen",
    ];
    if (this.#founderAddress && address === this.#founderAddress) {
      capabilities.push("stage:decide", "firewall:review");
    }

    const actor: Actor = {
      actor_id: `wallet:${address}`,
      actor_class: "human",
      capabilities,
      expires_at: expires,
      purpose: "PumpStation Labs identity and bounded research participation",
      data_scope: ["public_research", "submitted_opportunities"],
      resource_ceiling: 100,
      revoked: false,
    };
    const session: Session = {
      token: randomBytes(32).toString("base64url"),
      actor,
    };
    this.#sessions.set(session.token, session);
    return structuredClone(session);
  }

  authenticate(token: string | undefined): Actor {
    if (!token) {
      throw new DomainError(
        401,
        "AUTHENTICATION_REQUIRED",
        "A valid identity session is required.",
      );
    }
    const session = this.#sessions.get(token);
    if (
      !session ||
      session.actor.revoked ||
      !session.actor.expires_at ||
      new Date(session.actor.expires_at).getTime() <= this.#now().getTime()
    ) {
      throw new DomainError(
        401,
        "SESSION_INVALID",
        "Session is missing, expired, or revoked.",
      );
    }
    return structuredClone(session.actor);
  }
}

export function requireCapability(actor: Actor, capability: string): void {
  if (
    actor.revoked ||
    !actor.capabilities.includes(capability) ||
    (actor.expires_at && new Date(actor.expires_at).getTime() <= Date.now())
  ) {
    throw new DomainError(
      403,
      "CAPABILITY_DENIED",
      `Actor lacks active capability: ${capability}`,
    );
  }
}
