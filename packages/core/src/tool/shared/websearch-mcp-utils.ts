// vMK: shared websearch MCP protocol utilities for V1/V2 consolidation
// Effect-based schemas and functions used by both packages/core (V1) and packages/opencode (V2).
import { Duration, Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import { checksum } from "../../util/encode"

// ---- MCP Endpoints ----

/** Exa MCP endpoint */
export const EXA_URL = "https://mcp.exa.ai/mcp"

/** Parallel MCP endpoint */
export const PARALLEL_URL = "https://search.parallel.ai/mcp"

// ---- Provider Selection ----

/**
 * Select a web search provider by explicit override, feature flags, then session-hash round-robin.
 *
 * @param sessionID - Session identifier for stable hash-based routing
 * @param flags - Feature flags enabling Exa or Parallel
 * @param override - Explicit provider override (takes precedence over flags and hash)
 * @returns The selected provider ("exa" or "parallel")
 */
export function selectWebSearchProvider(
  sessionID: string,
  flags?: { exa?: boolean; parallel?: boolean },
  override?: "exa" | "parallel",
): "exa" | "parallel" {
  if (override) return override
  if (flags?.parallel) return "parallel"
  if (flags?.exa) return "exa"
  return Number.parseInt(checksum(sessionID) ?? "0", 36) % 2 === 0 ? "exa" : "parallel"
}

// ---- MCP Schemas (internal) ----

const McpResult = Schema.Struct({
  result: Schema.Struct({
    content: Schema.Array(
      Schema.Struct({ type: Schema.String, text: Schema.String }),
    ),
  }),
})

const decodeMcpResult = Schema.decodeUnknownEffect(Schema.fromJsonString(McpResult))

const parsePayload = (payload: string) =>
  Effect.gen(function* () {
    const trimmed = payload.trim()
    if (!trimmed.startsWith("{")) return undefined
    const data = yield* decodeMcpResult(trimmed)
    return data.result.content.find((item) => item.text)?.text
  })

/** Parse MCP text/event-stream from either direct JSON or SSE `data:` lines */
export const parseMcpResponse = Effect.fn("WebSearchMCP.parseResponse")(function* (body: string) {
  const trimmed = body.trim()
  const direct = trimmed ? yield* parsePayload(trimmed) : undefined
  if (direct) return direct
  for (const line of body.split("\n")) {
    if (!line.startsWith("data: ")) continue
    const data = yield* parsePayload(line.substring(6))
    if (data) return data
  }
  return undefined
})

// ---- Search Args Schemas ----

/** Exa `web_search_exa` arguments */
export const ExaSearchArgs = Schema.Struct({
  query: Schema.String,
  type: Schema.String,
  numResults: Schema.Number,
  livecrawl: Schema.String,
  contextMaxCharacters: Schema.optional(Schema.Number),
})

/** Parallel `web_search` arguments */
export const ParallelSearchArgs = Schema.Struct({
  objective: Schema.String,
  search_queries: Schema.Array(Schema.String),
  session_id: Schema.optional(Schema.String),
  model_name: Schema.optional(Schema.String),
})

// ---- MCP Request Builder ----

const McpRequest = <F extends Schema.Struct.Fields>(args: Schema.Struct<F>) =>
  Schema.Struct({
    jsonrpc: Schema.Literal("2.0"),
    id: Schema.Literal(1),
    method: Schema.Literal("tools/call"),
    params: Schema.Struct({
      name: Schema.String,
      arguments: args,
    }),
  })

/**
 * Call an MCP tool with JSON-RPC over HTTP.
 * Returns the text content from the first `text` content item, or `undefined` if none found.
 */
export const callMcpTool = <F extends Schema.Struct.Fields>(
  http: HttpClient.HttpClient,
  url: string,
  tool: string,
  args: Schema.Struct<F>,
  value: Schema.Struct.Type<F>,
  options?: {
    readonly timeout?: Duration.Input
    readonly maxBytes?: number
    readonly headers?: Record<string, string>
  },
) =>
  Effect.gen(function* () {
    const request = yield* HttpClientRequest.post(url).pipe(
      HttpClientRequest.accept("application/json, text/event-stream"),
      HttpClientRequest.setHeaders(options?.headers ?? {}),
      HttpClientRequest.schemaBodyJson(McpRequest(args))({
        jsonrpc: "2.0" as const,
        id: 1 as const,
        method: "tools/call" as const,
        params: { name: tool, arguments: value },
      }),
    )
    const response = yield* HttpClient.filterStatusOk(http).execute(request).pipe(
      Effect.timeoutOrElse({
        duration: options?.timeout ?? Duration.seconds(25),
        orElse: () => Effect.fail(new Error(`${tool} request timed out`)),
      }),
    )
    const body = yield* response.text
    if (options?.maxBytes !== undefined && Buffer.byteLength(body, "utf8") > options.maxBytes) {
      return yield* Effect.fail(new Error(`${tool} response exceeded ${options.maxBytes} bytes`))
    }
    return yield* parseMcpResponse(body)
  })
