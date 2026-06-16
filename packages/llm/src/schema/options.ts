import { Schema } from "effect"
import { JsonSchema, ModelID, ProviderID } from "./ids"
import type { AnyRoute } from "../route/client"
import { isRecord } from "../utils/record"

export const mergeJsonRecords = (
  ...items: ReadonlyArray<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined => {
  // Single pass: skip undefined items, check early-return path, collect into result
  let firstDefined: Record<string, unknown> | undefined
  let allHaveValues = true
  let definedCount = 0
  const result: Record<string, unknown> = {}
  for (const item of items) {
    if (!item) continue
    definedCount++
    if (firstDefined === undefined) firstDefined = item
    if (allHaveValues && Object.values(item).some((v) => v === undefined)) allHaveValues = false
    for (const [key, value] of Object.entries(item)) {
      if (value === undefined) continue
      result[key] = isRecord(result[key]) && isRecord(value) ? mergeJsonRecords(result[key], value) : value
    }
  }
  if (definedCount === 0) return undefined
  if (definedCount === 1 && allHaveValues) return firstDefined
  return Object.keys(result).length === 0 ? undefined : result
}

const mergeStringRecords = (
  ...items: ReadonlyArray<Record<string, string> | undefined>
): Record<string, string> | undefined => {
  // Single pass: avoid filter+flatMap intermediate allocations
  let firstDefined: Record<string, string> | undefined
  let definedCount = 0
  const result: Record<string, string> = {}
  for (const item of items) {
    if (!item) continue
    definedCount++
    if (firstDefined === undefined) firstDefined = item
    for (const [key, value] of Object.entries(item)) {
      if (value === undefined) continue
      result[key] = value
    }
  }
  if (definedCount === 0) return undefined
  if (definedCount === 1) return firstDefined
  return Object.keys(result).length === 0 ? undefined : result
}

export const ProviderOptions = Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown))
export type ProviderOptions = Schema.Schema.Type<typeof ProviderOptions>

export const mergeProviderOptions = (
  ...items: ReadonlyArray<ProviderOptions | undefined>
): ProviderOptions | undefined => {
  const result: Record<string, Record<string, unknown>> = {}
  for (const item of items) {
    if (!item) continue
    for (const [provider, options] of Object.entries(item)) {
      const merged = mergeJsonRecords(result[provider], options)
      if (merged) result[provider] = merged
    }
  }
  return Object.keys(result).length === 0 ? undefined : result
}

export class HttpOptions extends Schema.Class<HttpOptions>("LLM.HttpOptions")({
  body: Schema.optional(JsonSchema),
  headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  query: Schema.optional(Schema.Record(Schema.String, Schema.String)),
}) {}

export namespace HttpOptions {
  export type Input = HttpOptions | ConstructorParameters<typeof HttpOptions>[0]

  /** Normalize HTTP option input into the canonical `HttpOptions` class. */
  export const make = (input: Input) => (input instanceof HttpOptions ? input : new HttpOptions(input))
}

export const mergeHttpOptions = (...items: ReadonlyArray<HttpOptions | undefined>): HttpOptions | undefined => {
  // Single pass extracting body/headers/query — avoids 3 intermediate .map() arrays
  const bodies: Record<string, unknown>[] = []
  const headersList: Record<string, string>[] = []
  const queries: Record<string, string>[] = []
  for (const item of items) {
    if (!item) continue
    if (item.body) bodies.push(item.body)
    if (item.headers) headersList.push(item.headers)
    if (item.query) queries.push(item.query)
  }
  const body = bodies.length > 0 ? mergeJsonRecords(...bodies) : undefined
  const headers = headersList.length > 0 ? mergeStringRecords(...headersList) : undefined
  const query = queries.length > 0 ? mergeStringRecords(...queries) : undefined
  if (!body && !headers && !query) return undefined
  return new HttpOptions({ body, headers, query })
}

export class GenerationOptions extends Schema.Class<GenerationOptions>("LLM.GenerationOptions")({
  maxTokens: Schema.optional(Schema.Number),
  temperature: Schema.optional(Schema.Number),
  topP: Schema.optional(Schema.Number),
  topK: Schema.optional(Schema.Number),
  frequencyPenalty: Schema.optional(Schema.Number),
  presencePenalty: Schema.optional(Schema.Number),
  seed: Schema.optional(Schema.Number),
  stop: Schema.optional(Schema.Array(Schema.String)),
}) {}

export namespace GenerationOptions {
  export type Input = GenerationOptions | ConstructorParameters<typeof GenerationOptions>[0]

  /** Normalize generation option input into the canonical `GenerationOptions` class. */
  export const make = (input: Input = {}) => (input instanceof GenerationOptions ? input : new GenerationOptions(input))
}

export type GenerationOptionsFields = {
  readonly maxTokens?: number
  readonly temperature?: number
  readonly topP?: number
  readonly topK?: number
  readonly frequencyPenalty?: number
  readonly presencePenalty?: number
  readonly seed?: number
  readonly stop?: ReadonlyArray<string>
}

export type GenerationOptionsInput = GenerationOptions | GenerationOptionsFields

export const mergeGenerationOptions = (...items: ReadonlyArray<GenerationOptionsInput | undefined>) => {
  let maxTokens: number | undefined
  let temperature: number | undefined
  let topP: number | undefined
  let topK: number | undefined
  let frequencyPenalty: number | undefined
  let presencePenalty: number | undefined
  let seed: number | undefined
  let stop: ReadonlyArray<string> | undefined

  // Single reverse pass: picks the LAST item that defines each key
  // Replaces 8x findLast (closure + iteration per key) with one loop
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (!item) continue
    if (maxTokens === undefined && item.maxTokens !== undefined) maxTokens = item.maxTokens
    if (temperature === undefined && item.temperature !== undefined) temperature = item.temperature
    if (topP === undefined && item.topP !== undefined) topP = item.topP
    if (topK === undefined && item.topK !== undefined) topK = item.topK
    if (frequencyPenalty === undefined && item.frequencyPenalty !== undefined) frequencyPenalty = item.frequencyPenalty
    if (presencePenalty === undefined && item.presencePenalty !== undefined) presencePenalty = item.presencePenalty
    if (seed === undefined && item.seed !== undefined) seed = item.seed
    if (stop === undefined && item.stop !== undefined) stop = item.stop
  }

  const allUndefined = maxTokens === undefined && temperature === undefined && topP === undefined && topK === undefined &&
    frequencyPenalty === undefined && presencePenalty === undefined && seed === undefined && stop === undefined
  if (allUndefined) return undefined

  return new GenerationOptions({ maxTokens, temperature, topP, topK, frequencyPenalty, presencePenalty, seed, stop })
}

export class ModelLimits extends Schema.Class<ModelLimits>("LLM.ModelLimits")({
  context: Schema.optional(Schema.Number),
  output: Schema.optional(Schema.Number),
}) {}

export namespace ModelLimits {
  export type Input = ModelLimits | ConstructorParameters<typeof ModelLimits>[0]

  /** Normalize model limit input into the canonical `ModelLimits` class. */
  export const make = (input: Input | undefined) =>
    input instanceof ModelLimits ? input : new ModelLimits(input ?? {})
}

export class Model {
  readonly id: ModelID
  readonly provider: ProviderID
  readonly route: AnyRoute

  constructor(input: Model.ConstructorInput) {
    this.id = input.id
    this.provider = input.provider
    this.route = input.route
  }

  static make(input: Model.Input) {
    return new Model({
      id: ModelID.make(input.id),
      provider: ProviderID.make(input.provider),
      route: input.route,
    })
  }

  static input(model: Model): Model.ConstructorInput {
    return {
      id: model.id,
      provider: model.provider,
      route: model.route,
    }
  }

  static update(model: Model, patch: Partial<Model.Input>) {
    if (Object.keys(patch).length === 0) return model
    return Model.make({
      ...Model.input(model),
      ...patch,
    })
  }
}

export namespace Model {
  export type ConstructorInput = {
    readonly id: ModelID
    readonly provider: ProviderID
    readonly route: AnyRoute
  }

  export type Input = Omit<ConstructorInput, "id" | "provider"> & {
    readonly id: string | ModelID
    readonly provider: string | ProviderID
  }
}

export type ModelInput = Model.Input

export const ModelSchema = Schema.declare((value): value is Model => value instanceof Model, { expected: "LLM.Model" })

export class CacheHint extends Schema.Class<CacheHint>("LLM.CacheHint")({
  type: Schema.Literals(["ephemeral", "persistent"]),
  ttlSeconds: Schema.optional(Schema.Number),
}) {}

// Auto-placement policy for prompt caching. The protocol-neutral lowering step
// reads this and injects `CacheHint`s at the configured boundaries; the
// per-protocol body builders then translate those hints into wire markers as
// usual. `"auto"` is the recommended default for agent loops — it places one
// breakpoint at the last tool definition, one at the last system part, and one
// at the latest user message. The combination of provider invalidation
// hierarchy (tools → system → messages) and Anthropic/Bedrock's 20-block
// lookback means three trailing breakpoints reliably cover the static prefix.
//
// Pass `"none"` to opt out entirely (the legacy behavior). Pass the granular
// object form to override individual choices.
export const CachePolicyObject = Schema.Struct({
  tools: Schema.optional(Schema.Boolean),
  system: Schema.optional(Schema.Boolean),
  messages: Schema.optional(
    Schema.Union([
      Schema.Literal("latest-user-message"),
      Schema.Literal("latest-assistant"),
      Schema.Struct({ tail: Schema.Number }),
    ]),
  ),
  ttlSeconds: Schema.optional(Schema.Number),
})
export type CachePolicyObject = Schema.Schema.Type<typeof CachePolicyObject>

export const CachePolicy = Schema.Union([Schema.Literal("auto"), Schema.Literal("none"), CachePolicyObject])
export type CachePolicy = Schema.Schema.Type<typeof CachePolicy>
