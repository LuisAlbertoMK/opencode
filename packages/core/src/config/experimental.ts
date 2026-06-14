export * as ConfigExperimental from "./experimental"

import { Schema } from "effect"
import { Catalog } from "../catalog"
import { Policy as PolicyV2 } from "../policy"
import { PositiveInt } from "../schema"

// Each core domain exports the policy actions it supports. Adding an action to
// this union makes it valid in authored config while keeping Policy generic.
export const PolicyAction = Schema.Union([Catalog.PolicyActions])

export class Policy extends Schema.Class<Policy>("ConfigV2.Experimental.Policy")({
  ...PolicyV2.Info.fields,
  action: PolicyAction,
}) {}

export class Experimental extends Schema.Class<Experimental>("ConfigV2.Experimental")({
  policies: Policy.pipe(Schema.Array, Schema.optional),
  tui_fps: Schema.optional(PositiveInt).annotate({
    description: "TUI rendering framerate target (default 30). Lower = less CPU/GPU.",
  }),
  tool_concurrency: Schema.optional(PositiveInt).annotate({
    description: "Max concurrent tool executions (default 2). Lower = less CPU contention.",
  }),
  lru_cache_size: Schema.optional(PositiveInt).annotate({
    description: "Max entries in file read cache (default 30). Lower = less memory.",
  }),
  lru_cache_ttl_ms: Schema.optional(PositiveInt).annotate({
    description: "TTL for cached file reads in ms (default 3000). Shorter = less stale data.",
  }),
  delta_coalesce_ms: Schema.optional(PositiveInt).annotate({
    description: "Delta coalescing interval in ms (default 100). Higher = fewer store updates.",
  }),
}) {}
