import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DomainError } from "./errors.js";
import { sha256 } from "./hash.js";
import type { Actor, EventType, InstitutionalEvent } from "./model.js";

type EventStoreOptions = {
  logPath?: string;
  now?: () => string;
  idFactory?: () => string;
};

type AppendEventInput = {
  event_type: EventType;
  actor: Pick<Actor, "actor_id" | "actor_class">;
  correlation_id: string;
  payload: Record<string, unknown>;
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function freezeEvent(event: InstitutionalEvent): InstitutionalEvent {
  return deepFreeze(event);
}

export function verifyEventChain(events: readonly InstitutionalEvent[]): {
  valid: boolean;
  invalid_sequence: number | null;
} {
  let previous: `sha256:${string}` | null = null;

  for (const [index, event] of events.entries()) {
    const eventWithoutHash = {
      event_id: event.event_id,
      sequence: event.sequence,
      event_type: event.event_type,
      actor: event.actor,
      occurred_at: event.occurred_at,
      correlation_id: event.correlation_id,
      payload: event.payload,
      payload_hash: event.payload_hash,
      previous_event_hash: event.previous_event_hash,
    };

    const expectedPayloadHash = sha256(event.payload);
    const expectedEventHash = sha256(eventWithoutHash);
    const valid =
      event.sequence === index + 1 &&
      event.previous_event_hash === previous &&
      event.payload_hash === expectedPayloadHash &&
      event.event_hash === expectedEventHash;

    if (!valid) {
      return { valid: false, invalid_sequence: event.sequence };
    }

    previous = event.event_hash;
  }

  return { valid: true, invalid_sequence: null };
}

export class AppendOnlyEventStore {
  readonly #events: InstitutionalEvent[] = [];
  readonly #logPath: string | null;
  readonly #now: () => string;
  readonly #idFactory: () => string;

  constructor(options: EventStoreOptions = {}) {
    this.#logPath =
      options.logPath && options.logPath !== ":memory:"
        ? resolve(options.logPath)
        : null;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#idFactory = options.idFactory ?? randomUUID;

    if (this.#logPath && existsSync(this.#logPath)) {
      const lines = readFileSync(this.#logPath, "utf8")
        .split("\n")
        .filter((line) => line.trim().length > 0);
      const parsed = lines.map(
        (line) => JSON.parse(line) as InstitutionalEvent,
      );
      const verification = verifyEventChain(parsed);
      if (!verification.valid) {
        throw new DomainError(
          503,
          "EVENT_CHAIN_INVALID",
          "Institutional event chain is invalid; service is disarmed.",
          verification,
        );
      }
      this.#events.push(...parsed.map(freezeEvent));
    }
  }

  append(input: AppendEventInput): InstitutionalEvent {
    const previous = this.#events.at(-1)?.event_hash ?? null;
    const payloadHash = sha256(input.payload);
    const eventWithoutHash = {
      event_id: `evt_${this.#idFactory()}`,
      sequence: this.#events.length + 1,
      event_type: input.event_type,
      actor: {
        actor_id: input.actor.actor_id,
        actor_class: input.actor.actor_class,
      },
      occurred_at: this.#now(),
      correlation_id: input.correlation_id,
      payload: input.payload,
      payload_hash: payloadHash,
      previous_event_hash: previous,
    } satisfies Omit<InstitutionalEvent, "event_hash">;
    const event = freezeEvent({
      ...eventWithoutHash,
      event_hash: sha256(eventWithoutHash),
    });

    if (this.#logPath) {
      mkdirSync(dirname(this.#logPath), { recursive: true });
      appendFileSync(this.#logPath, `${JSON.stringify(event)}\n`, {
        encoding: "utf8",
        flag: "a",
      });
    }

    this.#events.push(event);
    return event;
  }

  list(): readonly InstitutionalEvent[] {
    return this.#events.map((event) =>
      structuredClone(event),
    ) as InstitutionalEvent[];
  }

  verify(): { valid: boolean; invalid_sequence: number | null } {
    return verifyEventChain(this.#events);
  }

  get size(): number {
    return this.#events.length;
  }
}
