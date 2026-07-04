// vMK: Shared webfetch utilities for V1/V2 consolidation.
// Pure functions used by both packages/core (V1) and packages/opencode (V2).
import { Parser } from "htmlparser2"
import TurndownService from "turndown"

// ---- Format detection ----

/**
 * Build an Accept header value based on the requested output format.
 * Both V1 and V2 webfetch tools use the same Accept header strategy.
 */
export function acceptHeader(format: "markdown" | "text" | "html"): string {
  switch (format) {
    case "markdown":
      return "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1"
    case "text":
      return "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1"
    case "html":
      return "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1"
    default:
      return "*/*"
  }
}

/**
 * Standard browser User-Agent used for HTTP fetches.
 */
export const browserUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"

// ---- Content conversion ----

/**
 * Extract plain text from HTML, skipping script/style/noscript/iframe/object/embed tags.
 */
export function extractTextFromHTML(html: string): string {
  let text = ""
  let skipDepth = 0
  const parser = new Parser({
    onopentag(name) {
      if (skipDepth > 0 || ["script", "style", "noscript", "iframe", "object", "embed"].includes(name)) {
        skipDepth++
      }
    },
    ontext(input) {
      if (skipDepth === 0) text += input
    },
    onclosetag() {
      if (skipDepth > 0) skipDepth--
    },
  })
  parser.write(html)
  parser.end()
  return text.trim()
}

/**
 * Convert HTML to Markdown using TurndownService.
 */
export function convertHTMLToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  })
  turndown.remove(["script", "style", "meta", "link"])
  return turndown.turndown(html)
}

// ---- MIME type helpers ----

/**
 * Extract the MIME type from a Content-Type header value.
 */
export function mimeFromContentType(contentType: string): string {
  return contentType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

/**
 * Check if a MIME type represents a fetchable image (excluding SVG and fastbidsheet).
 */
export function isImageAttachment(mime: string): boolean {
  return mime.startsWith("image/") && mime !== "image/svg+xml" && mime !== "image/vnd.fastbidsheet"
}

/**
 * Check if a MIME type represents textual content suitable for display.
 */
export function isTextualMime(mime: string): boolean {
  return (
    !mime ||
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime.endsWith("+json") ||
    mime === "application/xml" ||
    mime.endsWith("+xml") ||
    mime === "application/javascript" ||
    mime === "application/x-javascript"
  )
}

/**
 * Detect a Cloudflare challenge response (403 + cf-mitigated header).
 * Both V1 and V2 have duplicated versions of this check inline.
 */
export function isCloudflareChallenge(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  // V1 style: error.reason._tag === "StatusCodeError"
  if ("reason" in error) {
    const reason = (error as { reason: unknown }).reason
    if (reason && typeof reason === "object" && "_tag" in (reason as object) && (reason as { _tag: string })._tag === "StatusCodeError" && "response" in (reason as object)) {
      const response = (reason as { response: { status: number; headers: Record<string, string> } }).response
      return response.status === 403 && response.headers["cf-mitigated"] === "challenge"
    }
  }
  // V2 style: error.reason._tag === "StatusCodeError" (shallow access, no type guard)
  // Handled by the same logic above
  return false
}
