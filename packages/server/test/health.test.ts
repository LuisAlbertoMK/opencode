import { describe, expect, it } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { HttpClient, HttpRouter } from "effect/unstable/http"
import { NodeHttpServer, NodeServices } from "@effect/platform-node"

// Minimal API with just the health group — no middleware, no DB, no auth
const HealthApi = HttpApi.make("health").add(
  HttpApiGroup.make("server.health").add(
    HttpApiEndpoint.get("health.get", "/api/health", {
      success: Schema.Struct({ healthy: Schema.Literal(true) }),
    }),
  ),
)

// Handler for the health endpoint
const HealthHandler = HttpApiBuilder.group(HealthApi, "server.health", (handlers) =>
  handlers.handle("health.get", () => Effect.succeed({ healthy: true as const })),
)

// Build the API layer and provide the handler
const apiLayer = HttpApiBuilder.layer(HealthApi).pipe(
  Layer.provide(HealthHandler),
  Layer.provideMerge(NodeServices.layer),
)

// Serve with a test server on a random port
const servedLayer = HttpRouter.serve(apiLayer, {
  disableListenLog: true,
  disableLogger: true,
}).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
)

// Helper: run an Effect with the test server layer
const runWith = <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> =>
  effect.pipe(Effect.provide(servedLayer), Effect.scoped, Effect.runPromise)

describe("Health endpoint", () => {
  it("GET /api/health returns 200 with { healthy: true }", async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const response = yield* HttpClient.get("/api/health")
        const status = response.status
        const body = yield* response.json as any
        return { status, body }
      }),
    )
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ healthy: true })
  })

  it("GET /api/health returns JSON content type", async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const response = yield* HttpClient.get("/api/health")
        return response.headers["content-type"]
      }),
    )
    expect(result).toMatch(/application\/json/)
  })
})
