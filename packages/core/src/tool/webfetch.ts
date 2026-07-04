// vMK: Refactored to use shared webfetch-utils (Fase 2.3 consolidation)
export * as WebFetchTool from "./webfetch"

import { ToolFailure } from "@opencode-ai/llm"
import { Duration, Effect, Layer, Schema, Stream } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { PermissionV2 } from "../permission"
import { Tool } from "./tool"
import { Tools } from "./tools"
import {
  acceptHeader,
  browserUserAgent,
  convertHTMLToMarkdown,
  extractTextFromHTML,
  isCloudflareChallenge,
  isImageAttachment,
  isTextualMime,
  mimeFromContentType,
} from "./shared/webfetch-utils" // vMK: shared utility

// Re-export for backward compat (used by test via WebFetchTool.extractTextFromHTML etc.)
export { extractTextFromHTML, convertHTMLToMarkdown }

export const name = "webfetch"
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
export const DEFAULT_TIMEOUT_SECONDS = 30
export const MAX_TIMEOUT_SECONDS = 120

export const description = `Fetch content from an HTTP or HTTPS URL and return it as text, markdown, or HTML. Markdown is the default.

Use a more targeted tool when one is available. This tool is read-only. Large text results may be replaced with a preview while the complete output is retained in managed storage.`

const Timeout = Schema.Number.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMEOUT_SECONDS))

export const Input = Schema.Struct({
  url: Schema.String.annotate({ description: "The HTTP or HTTPS URL to fetch content from" }),
  format: Schema.Literals(["text", "markdown", "html"])
    .annotate({ description: "The format to return the content in. Defaults to markdown." })
    .pipe(Schema.withDecodingDefault(Effect.succeed("markdown" as const))),
  timeout: Timeout.pipe(Schema.optional).annotate({
    description: `Optional timeout in seconds (maximum: ${MAX_TIMEOUT_SECONDS})`,
  }),
})

const Output = Schema.Struct({
  url: Schema.String,
  contentType: Schema.String,
  format: Input.fields.format,
  output: Schema.String,
})

type Format = (typeof Input.Type)["format"]

const headers = (format: Format, userAgent: string) => ({
  "User-Agent": userAgent,
  Accept: acceptHeader(format),
  "Accept-Language": "en-US,en;q=0.9",
})

const assertHttpUrl = (url: URL) => {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("URL must use http:// or https://")
}

const execute = (http: HttpClient.HttpClient, url: string, format: Format, userAgent = browserUserAgent) =>
  http.execute(HttpClientRequest.get(url).pipe(HttpClientRequest.setHeaders(headers(format, userAgent)))).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
  )

const collectBody = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.gen(function* () {
    const contentLength = response.headers["content-length"]
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      return yield* Effect.fail(new Error(`Response too large (exceeds ${MAX_RESPONSE_BYTES} byte limit)`))
    }
    const chunks: Uint8Array[] = []
    let size = 0
    yield* Stream.runForEach(response.stream, (chunk) =>
      Effect.gen(function* () {
        size += chunk.byteLength
        if (size > MAX_RESPONSE_BYTES)
          return yield* Effect.fail(new Error(`Response too large (exceeds ${MAX_RESPONSE_BYTES} byte limit)`))
        chunks.push(chunk)
        return undefined
      }),
    )
    return Buffer.concat(chunks, size)
  })

const convert = (content: string, contentType: string, format: Format) => {
  if (!contentType.includes("text/html")) return content
  if (format === "markdown") return convertHTMLToMarkdown(content)
  if (format === "text") return extractTextFromHTML(content)
  return content
}

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const http = yield* HttpClient.HttpClient
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.make({
          description,
          input: Input,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: output.output }],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* Effect.try({
                try: () => assertHttpUrl(new URL(input.url)),
                catch: (error) => error,
              })

              yield* permission.assert({
                action: name,
                resources: [input.url],
                save: ["*"],
                metadata: input,
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
              })

              const { body, contentType } = yield* Effect.gen(function* () {
                const response = yield* execute(http, input.url, input.format).pipe(
                  Effect.catchIf(isCloudflareChallenge, () => execute(http, input.url, input.format, "opencode")),
                )
                const contentType = response.headers["content-type"] || ""
                const mime = mimeFromContentType(contentType)
                if (isImageAttachment(mime))
                  return yield* Effect.fail(new Error(`Unsupported fetched image content type: ${mime}`))
                if (!isTextualMime(mime))
                  return yield* Effect.fail(new Error(`Unsupported fetched file content type: ${mime}`))
                return { body: yield* collectBody(response), contentType }
              }).pipe(
                Effect.timeoutOrElse({
                  duration: Duration.seconds(input.timeout ?? DEFAULT_TIMEOUT_SECONDS),
                  orElse: () => Effect.fail(new Error("Request timed out")),
                }),
              )
              const content = convert(new TextDecoder().decode(body), contentType, input.format)
              return {
                url: input.url,
                contentType,
                format: input.format,
                output: content,
              }
            }).pipe(Effect.mapError(() => new ToolFailure({ message: `Unable to fetch ${input.url}` }))),
        }),
      })
      .pipe(Effect.orDie)
  }),
)
