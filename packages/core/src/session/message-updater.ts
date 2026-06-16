import { castDraft, produce, type WritableDraft } from "immer"
import { Effect } from "effect"
import { SessionEvent } from "./event"
import { SessionMessage } from "./message"

export type MemoryState = {
  messages: SessionMessage.Message[]
}

export interface Adapter {
  readonly getCurrentAssistant: () => Effect.Effect<SessionMessage.Assistant | undefined>
  readonly getAssistant: (messageID: SessionMessage.ID) => Effect.Effect<SessionMessage.Assistant | undefined>
  readonly getCurrentShell: (callID: string) => Effect.Effect<SessionMessage.Shell | undefined>
  readonly updateAssistant: (assistant: SessionMessage.Assistant) => Effect.Effect<void>
  readonly updateShell: (shell: SessionMessage.Shell) => Effect.Effect<void>
  readonly appendMessage: (message: SessionMessage.Message) => Effect.Effect<void>
}

export function memory(state: MemoryState): Adapter {
  // Index maps for O(1) lookups instead of O(n) findLastIndex on every stream event.
  const messageIndex = new Map<SessionMessage.ID, number>()
  const shellIndex = new Map<string, number>()
  let latestAssistantIdx = -1

  const rebuildIndex = () => {
    messageIndex.clear()
    shellIndex.clear()
    latestAssistantIdx = -1
    for (let i = 0; i < state.messages.length; i++) {
      const msg = state.messages[i]
      messageIndex.set(msg.id, i)
      if (msg.type === "shell") shellIndex.set(msg.callID, i)
      if (msg.type === "assistant") latestAssistantIdx = i
    }
  }
  rebuildIndex()

  return {
    getCurrentAssistant() {
      return Effect.sync(() => {
        if (latestAssistantIdx < 0) return
        const assistant = state.messages[latestAssistantIdx]
        return assistant?.type === "assistant" && !assistant.time.completed ? assistant : undefined
      })
    },
    getAssistant(messageID) {
      return Effect.sync(() => {
        const index = messageIndex.get(messageID)
        if (index === undefined) return
        const assistant = state.messages[index]
        return assistant?.type === "assistant" ? assistant : undefined
      })
    },
    getCurrentShell(callID) {
      return Effect.sync(() => {
        const index = shellIndex.get(callID)
        if (index === undefined) return
        const shell = state.messages[index]
        return shell?.type === "shell" ? shell : undefined
      })
    },
    updateAssistant(assistant) {
      return Effect.sync(() => {
        const index = messageIndex.get(assistant.id)
        if (index === undefined) return
        const current = state.messages[index]
        if (current?.type !== "assistant") return
        state.messages[index] = assistant
      })
    },
    updateShell(shell) {
      return Effect.sync(() => {
        const index = shellIndex.get(shell.callID)
        if (index === undefined) return
        const current = state.messages[index]
        if (current?.type !== "shell") return
        state.messages[index] = shell
      })
    },
    appendMessage(message) {
      return Effect.sync(() => {
        state.messages.push(message)
        const index = state.messages.length - 1
        messageIndex.set(message.id, index)
        if (message.type === "shell") shellIndex.set(message.callID, index)
        if (message.type === "assistant") latestAssistantIdx = index
        // Limit in-memory history to prevent unbounded growth.
        // Source of truth is the database; this is a fast projection.
        if (state.messages.length > 1000) {
          const removed = state.messages.splice(0, state.messages.length - 1000)
          rebuildIndex()
        }
      })
    },
  }
}

export function update(adapter: Adapter, event: SessionEvent.Event) {
  type DraftAssistant = WritableDraft<SessionMessage.Assistant>

  const updateOwnedAssistant = (messageID: SessionMessage.ID, recipe: (draft: DraftAssistant) => void) =>
    Effect.gen(function* () {
      const assistant = yield* adapter.getAssistant(messageID)
      if (assistant) yield* adapter.updateAssistant(produce(assistant, recipe))
    })

  return Effect.gen(function* () {
    yield* SessionEvent.All.match(event, {
      "session.next.agent.switched": (event) => {
        return adapter.appendMessage(
          new SessionMessage.AgentSwitched({
            id: event.data.messageID,
            type: "agent-switched",
            metadata: event.metadata,
            agent: event.data.agent,
            time: { created: event.data.timestamp },
          }),
        )
      },
      "session.next.model.switched": (event) => {
        return adapter.appendMessage(
          new SessionMessage.ModelSwitched({
            id: event.data.messageID,
            type: "model-switched",
            metadata: event.metadata,
            model: event.data.model,
            time: { created: event.data.timestamp },
          }),
        )
      },
      "session.next.moved": () => Effect.void,
      "session.next.prompted": (event) => {
        return adapter.appendMessage(
          new SessionMessage.User({
            id: event.data.messageID,
            type: "user",
            metadata: event.metadata,
            text: event.data.prompt.text,
            files: event.data.prompt.files,
            agents: event.data.prompt.agents,
            time: { created: event.data.timestamp },
          }),
        )
      },
      "session.next.prompt.admitted": () => Effect.void,
      "session.next.prompt.promoted": () => Effect.void,
      "session.next.interrupt.requested": () => Effect.void,
      "session.next.context.updated": (event) =>
        adapter.appendMessage(
          new SessionMessage.System({
            id: event.data.messageID,
            type: "system",
            text: event.data.text,
            time: { created: event.data.timestamp },
          }),
        ),
      "session.next.synthetic": (event) => {
        return adapter.appendMessage(
          new SessionMessage.Synthetic({
            sessionID: event.data.sessionID,
            text: event.data.text,
            id: event.data.messageID,
            type: "synthetic",
            time: { created: event.data.timestamp },
          }),
        )
      },
      "session.next.shell.started": (event) => {
        return adapter.appendMessage(
          new SessionMessage.Shell({
            id: event.data.messageID,
            type: "shell",
            metadata: event.metadata,
            callID: event.data.callID,
            command: event.data.command,
            output: "",
            time: { created: event.data.timestamp },
          }),
        )
      },
      "session.next.shell.ended": (event) => {
        return Effect.gen(function* () {
          const currentShell = yield* adapter.getCurrentShell(event.data.callID)
          if (currentShell) {
            yield* adapter.updateShell(
              produce(currentShell, (draft) => {
                draft.output = event.data.output
                draft.time.completed = event.data.timestamp
              }),
            )
          }
        })
      },
      "session.next.step.started": (event) => {
        return Effect.gen(function* () {
          const currentAssistant = yield* adapter.getCurrentAssistant()
          if (currentAssistant) {
            yield* adapter.updateAssistant(
              produce(currentAssistant, (draft) => {
                draft.time.completed = event.data.timestamp
              }),
            )
          }
          yield* adapter.appendMessage(
            new SessionMessage.Assistant({
              id: event.data.assistantMessageID,
              type: "assistant",
              agent: event.data.agent,
              model: event.data.model,
              time: { created: event.data.timestamp },
              content: [],
              snapshot: event.data.snapshot ? { start: event.data.snapshot } : undefined,
            }),
          )
        })
      },
      "session.next.step.ended": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          draft.time.completed = event.data.timestamp
          draft.finish = event.data.finish
          draft.cost = event.data.cost
          draft.tokens = event.data.tokens
          if (event.data.snapshot) draft.snapshot = { ...draft.snapshot, end: event.data.snapshot }
        })
      },
      "session.next.step.failed": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          draft.time.completed = event.data.timestamp
          draft.finish = "error"
          draft.error = event.data.error
        })
      },
      "session.next.text.started": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          draft.content.push(
            castDraft(new SessionMessage.AssistantText({ type: "text", id: event.data.textID, text: "" })),
          )
        })
      },
      "session.next.text.delta": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          for (let i = draft.content.length - 1; i >= 0; i--) {
            const item = draft.content[i]
            if (item.type === "text" && item.id === event.data.textID) { item.text += event.data.delta; break }
          }
        })
      },
      "session.next.text.ended": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          for (let i = draft.content.length - 1; i >= 0; i--) {
            const item = draft.content[i]
            if (item.type === "text" && item.id === event.data.textID) { item.text = event.data.text; break }
          }
        })
      },
      "session.next.tool.input.started": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          draft.content.push(
            castDraft(
              new SessionMessage.AssistantTool({
                type: "tool",
                id: event.data.callID,
                name: event.data.name,
                time: { created: event.data.timestamp },
                state: new SessionMessage.ToolStatePending({ status: "pending", input: "" }),
              }),
            ),
          )
        })
      },
      "session.next.tool.input.delta": () => Effect.void,
      "session.next.tool.input.ended": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          for (let i = draft.content.length - 1; i >= 0; i--) {
            const item = draft.content[i]
            if (item.type === "tool" && item.id === event.data.callID && item.state.status === "pending") {
              item.state.input = event.data.text; break
            }
          }
        })
      },
      "session.next.tool.called": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          for (let i = draft.content.length - 1; i >= 0; i--) {
            const match = draft.content[i]
            if (match.type !== "tool" || match.id !== event.data.callID) continue
            match.provider = event.data.provider
            match.time.ran = event.data.timestamp
            match.state = castDraft(
              new SessionMessage.ToolStateRunning({
                status: "running",
                input: event.data.input,
                structured: {},
                content: [],
              }),
            )
            break
          }
        })
      },
      "session.next.tool.progress": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          for (let i = draft.content.length - 1; i >= 0; i--) {
            const match = draft.content[i]
            if (match.type === "tool" && match.id === event.data.callID && match.state.status === "running") {
              match.state.structured = event.data.structured
              match.state.content = [...event.data.content]
              break
            }
          }
        })
      },
      "session.next.tool.success": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          for (let i = draft.content.length - 1; i >= 0; i--) {
            const match = draft.content[i]
            if (match.type !== "tool" || match.id !== event.data.callID || match.state.status !== "running") continue
            match.provider = {
              executed: event.data.provider.executed || match.provider?.executed === true,
              metadata: match.provider?.metadata,
              resultMetadata: event.data.provider.metadata,
            }
            match.time.completed = event.data.timestamp
            match.state = castDraft(
              new SessionMessage.ToolStateCompleted({
                status: "completed",
                input: match.state.input,
                structured: event.data.structured,
                content: [...event.data.content],
                outputPaths: event.data.outputPaths ? [...event.data.outputPaths] : [],
                result: event.data.result,
              }),
            )
            break
          }
        })
      },
      "session.next.tool.failed": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          for (let i = draft.content.length - 1; i >= 0; i--) {
            const match = draft.content[i]
            if (
              match.type !== "tool" || match.id !== event.data.callID ||
              (match.state.status !== "pending" && match.state.status !== "running")
            ) continue
            match.provider = {
              executed: event.data.provider.executed || match.provider?.executed === true,
              metadata: match.provider?.metadata,
              resultMetadata: event.data.provider.metadata,
            }
            match.time.completed = event.data.timestamp
            match.state = castDraft(
              new SessionMessage.ToolStateError({
                status: "error",
                error: event.data.error,
                input: typeof match.state.input === "string" ? {} : match.state.input,
                structured: match.state.status === "running" ? match.state.structured : {},
                content: match.state.status === "running" ? match.state.content : [],
                result: event.data.result,
              }),
            )
            break
          }
        })
      },
      "session.next.reasoning.started": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          draft.content.push(
            castDraft(
              new SessionMessage.AssistantReasoning({
                type: "reasoning",
                id: event.data.reasoningID,
                text: "",
                providerMetadata: event.data.providerMetadata,
              }),
            ),
          )
        })
      },
      "session.next.reasoning.delta": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          for (let i = draft.content.length - 1; i >= 0; i--) {
            const item = draft.content[i]
            if (item.type === "reasoning" && item.id === event.data.reasoningID) { item.text += event.data.delta; break }
          }
        })
      },
      "session.next.reasoning.ended": (event) => {
        return updateOwnedAssistant(event.data.assistantMessageID, (draft) => {
          for (let i = draft.content.length - 1; i >= 0; i--) {
            const item = draft.content[i]
            if (item.type !== "reasoning" || item.id !== event.data.reasoningID) continue
            item.text = event.data.text
            if (event.data.providerMetadata !== undefined) item.providerMetadata = event.data.providerMetadata
            break
          }
        })
      },
      "session.next.retried": () => Effect.void,
      "session.next.compaction.started": () => Effect.void,
      "session.next.compaction.delta": () => Effect.void,
      "session.next.compaction.ended": (event) => {
        return adapter.appendMessage(
          new SessionMessage.Compaction({
            id: event.data.messageID,
            type: "compaction",
            metadata: event.metadata,
            reason: event.data.reason,
            summary: event.data.text,
            recent: event.data.recent,
            time: { created: event.data.timestamp },
          }),
        )
      },
    })
  })
}

export * as SessionMessageUpdater from "./message-updater"
