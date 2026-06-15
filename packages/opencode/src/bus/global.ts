import { EventEmitter } from "events"
import { Identifier } from "@/id/id"

export type GlobalEvent = {
  directory?: string
  project?: string
  workspace?: string
  payload: any
}

class GlobalBusEmitter extends EventEmitter<{
  event: [GlobalEvent]
}> {
  constructor() {
    super()
    // Warn at 64+ active listeners — higher than default (10) because GlobalBus is
    // a process-wide hub used by SSE connections, workers, and control-plane utilities.
    // This prevents silent listener leaks while accommodating legitimate multi-subscriber patterns.
    this.setMaxListeners(64)
  }
  override emit(eventName: "event", event: GlobalEvent): boolean {
    if (event.payload && typeof event.payload === "object" && !("id" in event.payload)) {
      event.payload.id = event.payload.syncEvent?.id ?? Identifier.create("evt", "ascending")
    }
    return super.emit(eventName, event)
  }
}

export const GlobalBus = new GlobalBusEmitter()
