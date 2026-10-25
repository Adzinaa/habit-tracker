// The HTTP layer: parse the request, call the service, choose the status code.

import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { Repository } from "./repository.js";
import {
  COMPLETION_PREFIX,
  QUEST_PREFIX,
  completionToJson,
  parseId,
  questToJson,
} from "./serializers.js";
import { buildMe, completeQuest, currentDay } from "./service.js";
import { parseInstant, toUtcIso } from "./time.js";
import { parseNewQuest, parseTimezoneUpdate } from "./validation.js";

declare module "fastify" {
  interface FastifyRequest {
    /** The current time: the X-Now header if present, otherwise the real clock. */
    now: Date;
  }
}

export function buildApp(repository: Repository, options: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  // Accept an empty body even when Content-Type is JSON (e.g. POST /quests/:id/complete),
  // and answer malformed JSON with our own { error } shape.
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    if (body === "") return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(Object.assign(new Error("invalid JSON body"), { statusCode: 400 }));
    }
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (status === 500) request.log.error(error);
    reply.code(status).send({ error: status === 500 ? "internal server error" : error.message });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "not found" }));

  // Placeholder only: the onRequest hook below sets `now` on every request.
  app.decorateRequest("now", null as unknown as Date);
  app.addHook("onRequest", async (request, reply) => {
    const header = request.headers["x-now"];
    if (header === undefined) {
      request.now = new Date();
      return;
    }
    const instant = typeof header === "string" ? parseInstant(header) : null;
    if (!instant) return reply.code(400).send({ error: "invalid X-Now header" });
    request.now = instant;
  });

  // ---- quests -------------------------------------------------------------

  app.post("/quests", (request, reply) => {
    const parsed = parseNewQuest(request.body);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });

    const id = repository.insertQuest({ ...parsed.value, created_at: toUtcIso(request.now) });
    return reply.code(201).send(questToJson({ id, ...parsed.value, done: false }));
  });

  app.get("/quests", (request) => {
    return repository.listQuests(currentDay(repository, request.now)).map(questToJson);
  });

  app.post<{ Params: { id: string } }>("/quests/:id/complete", (request, reply) => {
    const questId = parseId(QUEST_PREFIX, request.params.id);
    const quest = questId === null ? undefined : repository.findQuest(questId);
    if (!quest) return reply.code(404).send({ error: "quest not found" });

    const { completion, isNew } = completeQuest(repository, quest, request.now);
    return reply
      .code(isNew ? 201 : 200)
      .send({ completion: completionToJson(completion), me: buildMe(repository, request.now) });
  });

  // ---- completions --------------------------------------------------------

  app.get("/completions", () => repository.listCompletions().map(completionToJson));

  app.delete<{ Params: { id: string } }>("/completions/:id", (request, reply) => {
    const completionId = parseId(COMPLETION_PREFIX, request.params.id);
    if (completionId === null || !repository.deleteCompletion(completionId)) {
      return reply.code(404).send({ error: "completion not found" });
    }
    return reply.code(204).send();
  });

  // ---- me -----------------------------------------------------------------

  app.get("/me", (request) => buildMe(repository, request.now));

  app.put("/me", (request, reply) => {
    const parsed = parseTimezoneUpdate(request.body);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });

    repository.setTimezone(parsed.value);
    return buildMe(repository, request.now);
  });

  // ---- tests --------------------------------------------------------------

  app.post("/test/reset", (_request, reply) => {
    repository.resetAll();
    return reply.code(204).send();
  });

  return app;
}
