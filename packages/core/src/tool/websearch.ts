export * as WebSearchTool from "./websearch"

import { ToolFailure } from "@opencode-ai/llm"
import { Context, Effect, Layer, Schema } from "effect"
import { HttpClient } from "effect/unstable/http"
import { truthy } from "../flag/flag"
import { InstallationVersion } from "../installation/version"
import { PositiveInt } from "../schema"
import { PermissionV2 } from "../permission"
import { Tool } from "./tool"
import { Tools } from "./tools"
// vMK: shared MCP protocol + provider selection
import {
  callMcpTool,
  ExaSearchArgs,
  ParallelSearchArgs,
  selectWebSearchProvider as sharedSelectProvider,
  EXA_URL as SHARED_EXA_URL,
  PARALLEL_URL as SHARED_PARALLEL_URL,
  parseMcpResponse,
} from "./shared/websearch-mcp-utils"

export const name = "websearch"
export const NO_RESULTS = "No search results found. Please try a different query."

/** @deprecated use `EXA_URL` from `@opencode-ai/core/tool/shared/websearch-mcp-utils` */
export const EXA_URL = SHARED_EXA_URL
/** @deprecated use `PARALLEL_URL` from `@opencode-ai/core/tool/shared/websearch-mcp-utils` */
export const PARALLEL_URL = SHARED_PARALLEL_URL
export const MAX_NUM_RESULTS = 20
export const MAX_CONTEXT_CHARACTERS = 50_000
export const MAX_RESPONSE_BYTES = 256 * 1024

/**
 * Provider-independent local web search retained in V2 core for launch parity.
 * This invokes the legacy Exa/Parallel product backends itself. It is distinct
 * from provider-hosted web search tools, which remain route-owned and execute
 * at the model provider. Ownership of this compromise can be revisited later.
 */
export const description = `Search the web using the session's local web search provider. Use this for current information beyond knowledge cutoff.

This is a provider-independent local tool backed by Exa or Parallel. Provider-hosted web search tools are separate and execute at the model provider.

Optional controls support result count, live crawling ('fallback' or 'preferred'), search type ('auto', 'fast', or 'deep'), and maximum context characters.

The current year is ${new Date().getFullYear()}. Use this year when searching for recent information or current events.`

export const Input = Schema.Struct({
  query: Schema.String.annotate({ description: "Websearch query" }),
  numResults: Schema.optional(PositiveInt.check(Schema.isLessThanOrEqualTo(MAX_NUM_RESULTS))).annotate({
    description: `Number of search results to return (default: 8, maximum: ${MAX_NUM_RESULTS})`,
  }),
  livecrawl: Schema.optional(Schema.Literals(["fallback", "preferred"])).annotate({
    description:
      "Live crawl mode - 'fallback': use live crawling as backup if cached unavailable, 'preferred': prioritize live crawling (default: 'fallback')",
  }),
  type: Schema.optional(Schema.Literals(["auto", "fast", "deep"])).annotate({
    description: "Search type - 'auto': balanced search (default), 'fast': quick results, 'deep': comprehensive search",
  }),
  contextMaxCharacters: Schema.optional(PositiveInt.check(Schema.isLessThanOrEqualTo(MAX_CONTEXT_CHARACTERS))).annotate(
    {
      description: `Maximum characters for context string optimized for models (default: 10000, maximum: ${MAX_CONTEXT_CHARACTERS})`,
    },
  ),
})

export const Provider = Schema.Literals(["exa", "parallel"])
export type Provider = typeof Provider.Type

export interface Config {
  readonly provider?: Provider
  readonly enableExa: boolean
  readonly enableParallel: boolean
  readonly exaApiKey?: string
  readonly parallelApiKey?: string
}

export class ConfigService extends Context.Service<ConfigService, Config>()("@opencode/v2/WebSearchConfig") {}

/** Isolates the retained product environment contract from the generic tool implementation. */
export const defaultConfigLayer = Layer.sync(ConfigService, () =>
  ConfigService.of({
    provider:
      process.env.OPENCODE_WEBSEARCH_PROVIDER === "exa" || process.env.OPENCODE_WEBSEARCH_PROVIDER === "parallel"
        ? process.env.OPENCODE_WEBSEARCH_PROVIDER
        : undefined,
    enableExa: truthy("OPENCODE_EXPERIMENTAL") || truthy("OPENCODE_ENABLE_EXA") || truthy("OPENCODE_EXPERIMENTAL_EXA"),
    enableParallel: truthy("OPENCODE_ENABLE_PARALLEL") || truthy("OPENCODE_EXPERIMENTAL_PARALLEL"),
    exaApiKey: process.env.EXA_API_KEY,
    parallelApiKey: process.env.PARALLEL_API_KEY,
  }),
)

/** @deprecated use `selectWebSearchProvider` from `@opencode-ai/core/tool/shared/websearch-mcp-utils` */
export function selectProvider(
  sessionID: string,
  flags: Pick<Config, "enableExa" | "enableParallel"> = { enableExa: false, enableParallel: false },
  override?: Provider,
): Provider {
  return sharedSelectProvider(sessionID, { exa: flags.enableExa, parallel: flags.enableParallel }, override)
}

/** @deprecated use `parseMcpResponse` from `@opencode-ai/core/tool/shared/websearch-mcp-utils` */
export const parseResponse = parseMcpResponse

const Output = Schema.Struct({
  provider: Provider,
  text: Schema.String,
})

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const http = yield* HttpClient.HttpClient
    const config = yield* ConfigService
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.make({
          description,
          input: Input,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: output.text }],
          execute: (input, context) => {
            const provider = selectProvider(context.sessionID, config, config.provider)
            return Effect.gen(function* () {
              yield* permission.assert({
                action: name,
                resources: [input.query],
                save: ["*"],
                metadata: { ...input, provider },
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
              })

              const text =
                provider === "exa"
                  ? yield* callMcpTool(http, EXA_URL, "web_search_exa", ExaSearchArgs, {
                      query: input.query,
                      type: input.type || "auto",
                      numResults: input.numResults || 8,
                      livecrawl: input.livecrawl || "fallback",
                      contextMaxCharacters: input.contextMaxCharacters,
                    },
                    {
                      maxBytes: MAX_RESPONSE_BYTES,
                      headers: config.exaApiKey ? { "x-api-key": config.exaApiKey } : {},
                    })
                  : yield* callMcpTool(
                      http,
                      PARALLEL_URL,
                      "web_search",
                      ParallelSearchArgs,
                      {
                        objective: input.query,
                        search_queries: [input.query],
                        session_id: context.sessionID,
                        // V2 invocation context does not safely expose the model yet.
                      },
                      {
                        maxBytes: MAX_RESPONSE_BYTES,
                        headers: {
                          "User-Agent": `opencode/${InstallationVersion}`,
                          ...(config.parallelApiKey ? { Authorization: `Bearer ${config.parallelApiKey}` } : {}),
                        },
                      },
                    )
              return {
                provider,
                text: text ?? NO_RESULTS,
              }
            }).pipe(Effect.mapError(() => new ToolFailure({ message: `Unable to search the web for ${input.query}` })))
          },
        }),
      })
      .pipe(Effect.orDie)
  }),
)
