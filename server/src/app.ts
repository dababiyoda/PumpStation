import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { z, ZodError } from "zod";
import {
  AUTHORITY_RULE,
  CURRENT_STAGE,
  OPERATING_MODE,
  PROHIBITED_ROUTE_PREFIXES,
  PUBLIC_WARNINGS,
  UNAUTHORIZED_EXTERNAL_EFFECTS,
} from "./config.js";
import { DomainError } from "./domain/errors.js";
import { AppendOnlyEventStore } from "./domain/eventStore.js";
import { IdentityService } from "./domain/identity.js";
import { PumpStationInstitution } from "./domain/institution.js";
import {
  DeliberationInputSchema,
  FounderDecisionInputSchema,
  OpportunityPacketSchema,
  StagePromotionRequestSchema,
  type Actor,
} from "./domain/model.js";

declare global {
  namespace Express {
    interface Request {
      pumpstationActor?: Actor;
    }
  }
}

type CreateAppOptions = {
  eventLogPath?: string;
  domain?: string;
  origin?: string;
  founderAddress?: string;
  sessionTtlSeconds?: number;
  nowDate?: () => Date;
  nowIso?: () => string;
  idFactory?: () => string;
};

const ChallengeInputSchema = z
  .object({
    address: z.string().min(1),
    chain_id: z.number().int().positive(),
  })
  .strict();

const SessionInputSchema = z
  .object({
    address: z.string().min(1),
    nonce: z.string().min(8),
    signature: z.string().min(1),
  })
  .strict();

function bearerToken(request: Request): string | undefined {
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length);
}

function resolveClientDirectory(): string {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(moduleDirectory, "../../client"),
    resolve(moduleDirectory, "../../../client"),
  ];
  const clientDirectory = candidates.find((candidate) => existsSync(candidate));
  if (!clientDirectory) {
    throw new Error("PumpStation dashboard assets were not found.");
  }
  return clientDirectory;
}

export function createApp(options: CreateAppOptions = {}): {
  app: express.Express;
  institution: PumpStationInstitution;
  identity: IdentityService;
  store: AppendOnlyEventStore;
} {
  const nowIso = options.nowIso ?? (() => new Date().toISOString());
  const store = new AppendOnlyEventStore({
    logPath: options.eventLogPath ?? ":memory:",
    now: nowIso,
    ...(options.idFactory ? { idFactory: options.idFactory } : {}),
  });
  const identity = new IdentityService({
    domain: options.domain ?? "localhost:3001",
    origin: options.origin ?? "http://localhost:3001",
    ...(options.founderAddress
      ? { founderAddress: options.founderAddress }
      : {}),
    ...(options.sessionTtlSeconds !== undefined
      ? { sessionTtlSeconds: options.sessionTtlSeconds }
      : {}),
    ...(options.nowDate ? { now: options.nowDate } : {}),
  });
  const institution = new PumpStationInstitution(store, {
    now: nowIso,
    ...(options.idFactory ? { idFactory: options.idFactory } : {}),
  });
  const app = express();

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          connectSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: options.origin ?? "http://localhost:3001",
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "256kb", strict: true }));

  app.use((request, response, next) => {
    const prohibited = PROHIBITED_ROUTE_PREFIXES.find((prefix) =>
      request.path.startsWith(prefix),
    );
    if (!prohibited) return next();
    return response.status(403).json({
      error: {
        code: "EXTERNAL_EFFECT_SURFACE_PROHIBITED",
        message:
          "PumpStation Labs has no execution, trading, transfer, custody, deposit, pooled-capital, or promotion-campaign authority.",
        operating_mode: OPERATING_MODE,
        unauthorized_external_effects: UNAUTHORIZED_EXTERNAL_EFFECTS,
      },
    });
  });

  app.get("/api/v1/status", (_request, response) => {
    response.json({
      operating_mode: OPERATING_MODE,
      stage: CURRENT_STAGE,
      warnings: PUBLIC_WARNINGS,
      authority_rule: AUTHORITY_RULE,
      external_effects_permitted: false,
      unauthorized_external_effects: UNAUTHORIZED_EXTERNAL_EFFECTS,
      kernel_connection: "not_implemented",
      legal_clearance: "not_claimed",
    });
  });

  app.post("/api/v1/identity/challenges", (request, response) => {
    const input = ChallengeInputSchema.parse(request.body);
    response.status(201).json(identity.createChallenge(input));
  });

  app.post("/api/v1/identity/sessions", (request, response) => {
    const input = SessionInputSchema.parse(request.body);
    const session = identity.verifyChallenge(input);
    response.status(201).json(session);
  });

  app.all("/api/connect-wallet", (_request, response) => {
    response.status(410).json({
      error: {
        code: "LEGACY_REPLAYABLE_SIGNATURE_DISABLED",
        message:
          "The fixed-message wallet endpoint was retired. Use one-time identity challenges.",
      },
    });
  });

  const requireIdentity = (
    request: Request,
    _response: Response,
    next: NextFunction,
  ) => {
    request.pumpstationActor = identity.authenticate(bearerToken(request));
    next();
  };

  app.post("/api/v1/opportunities", requireIdentity, (request, response) => {
    const packet = OpportunityPacketSchema.parse(request.body);
    const accepted = institution.submitOpportunity(
      packet,
      request.pumpstationActor as Actor,
    );
    response.status(201).json({
      opportunity: accepted,
      reality_status: "simulation",
      external_effect_permitted: false,
    });
  });

  app.get("/api/v1/opportunities/:id", (request, response) => {
    response.json(institution.getOpportunity(request.params.id as string));
  });

  app.post(
    "/api/v1/opportunities/:id/deliberations",
    requireIdentity,
    (request, response) => {
      const input = DeliberationInputSchema.parse(request.body);
      const message = institution.addDeliberation(
        request.params.id as string,
        input,
        request.pumpstationActor as Actor,
      );
      response.status(201).json({
        message,
        chat_is_instruction_surface: false,
      });
    },
  );

  app.post(
    "/api/v1/opportunities/:id/simulated-decisions",
    requireIdentity,
    (request, response) => {
      const packet = institution.compileSimulatedDecision(
        request.params.id as string,
        request.pumpstationActor as Actor,
      );
      response.status(201).json(packet);
    },
  );

  app.post("/api/v1/stage-promotions", requireIdentity, (request, response) => {
    const input = StagePromotionRequestSchema.parse(request.body);
    const packet = institution.requestStagePromotion(
      input,
      request.pumpstationActor as Actor,
    );
    response.status(201).json(packet);
  });

  app.post(
    "/api/v1/stage-promotions/:id/founder-decision",
    requireIdentity,
    (request, response) => {
      const input = FounderDecisionInputSchema.parse(request.body);
      const packet = institution.recordFounderDecision(
        request.params.id as string,
        input,
        request.pumpstationActor as Actor,
      );
      response.status(201).json(packet);
    },
  );

  app.get("/api/v1/stage-promotions/:id", (request, response) => {
    response.json(institution.getPromotion(request.params.id as string));
  });

  app.get("/api/v1/dashboard", (_request, response) => {
    response.json(institution.getDashboard());
  });

  const clientDirectory = resolveClientDirectory();
  app.use(express.static(clientDirectory, { index: "index.html" }));

  app.use("/api", (_request, response) => {
    response.status(404).json({
      error: {
        code: "API_ROUTE_NOT_FOUND",
        message: "API route not found.",
      },
    });
  });

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      if (error instanceof ZodError) {
        return response.status(400).json({
          error: {
            code: "SCHEMA_VALIDATION_FAILED",
            message: "Request did not match the canonical schema.",
            details: error.issues,
          },
        });
      }
      if (error instanceof DomainError) {
        return response.status(error.status).json({
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      }
      return response.status(500).json({
        error: {
          code: "FAIL_CLOSED_INTERNAL_ERROR",
          message:
            "The request failed closed. No external effect was attempted.",
        },
      });
    },
  );

  return { app, institution, identity, store };
}
