import { Database } from "@opencode-ai/core/database/database"
import { inArray } from "drizzle-orm"
import { EventSequenceTable } from "@opencode-ai/core/event/sql"
import { Workspace } from "@/control-plane/workspace"
import type { WorkspaceV2 } from "@opencode-ai/core/workspace"
import { Effect } from "effect"

export const HEADER = "x-opencode-sync"
export type State = Record<string, number>

export function load(db: Database.Interface["db"], ids?: string[]) {
  return Effect.gen(function* () {
    const rows = yield* (
      ids?.length
        ? db.select().from(EventSequenceTable).where(inArray(EventSequenceTable.aggregate_id, ids)).all()
        : db.select().from(EventSequenceTable).all()
    ).pipe(Effect.orDie)

    const result: Record<string, number> = {}
    for (const row of rows) {
      result[row.aggregate_id] = row.seq
    }
    return result
  })
}

export function diff(prev: State, next: State) {
  const ids = new Set([...Object.keys(prev), ...Object.keys(next)])
  const result: Record<string, number> = {}
  for (const id of ids) {
    const seq = next[id] ?? -1
    if ((prev[id] ?? -1) !== seq) result[id] = seq
  }
  return result
}

export function parse(headers: Headers): State | undefined {
  const raw = headers.get(HEADER)
  if (!raw) return

  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return
  }

  if (!data || typeof data !== "object") return

  const result: Record<string, number> = {}
  for (const [key, val] of Object.entries(data)) {
    if (typeof key === "string" && Number.isInteger(val)) result[key] = val as number
  }
  return result
}

export function wait(workspaceID: WorkspaceV2.ID, state: State, signal?: AbortSignal) {
  return Effect.gen(function* () {
    yield* Effect.logInfo("waiting for state", { workspaceID, state })
    yield* Workspace.Service.use((workspace) => workspace.waitForSync(workspaceID, state, signal))
    yield* Effect.logInfo("state fully synced", { workspaceID, state })
  })
}
