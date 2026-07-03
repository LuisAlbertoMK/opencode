# 25+ Subagent/Multi-Agent Architecture Approaches — Comparison

> **Research Date**: 2026-06-23
> **Scope**: Architectures for LLM-based multi-agent systems, focused on resource efficiency + quality
> **Sources**: 40+ academic papers, framework docs, production reports (2024-2026)

---

## Classification Framework

| Category | Patterns |
|----------|----------|
| **Orchestration** | How agents are coordinated |
| **Memory** | How agents share/retain state |
| **Communication** | How agents exchange information |
| **Quality** | How output is verified/enhanced |

---

## 1. Orchestration Patterns

### 1.1 OpenAI Swarm
- **Type**: Lightweight orchestration
- **Description**: Minimalist multi-agent coordination via function/tool routing. Agents as "routines" + handoffs.
- **Footprint**: Very low (~500 lines Python core)
- **Token cost**: Low — deterministic routing, no negotiation overhead
- **Pros**: Simple, no framework lock-in, easy to extend
- **Cons**: No persistence, no built-in state management
- **Best for**: Simple delegation, tool routing

### 1.2 LangGraph
- **Type**: Graph-based orchestration
- **Description**: Directed graph of nodes/edges. Explicit state transitions. Checkpointing, human-in-the-loop.
- **Footprint**: Medium (LangChain dep tree)
- **Token cost**: 15-38% overhead vs raw (claimed 9% — actual measurements show higher)
- **Pros**: Deterministic, production-grade state, observability
- **Cons**: Steep learning curve, heavy dependency chain
- **Best for**: Complex production workflows with audit needs

### 1.3 CrewAI
- **Type**: Role-based orchestration
- **Description**: Define agents by role/goal/backstory. Framework handles routing via sequential/hierarchical/parallel.
- **Footprint**: Medium (heavy abstraction layer)
- **Token cost**: 18-48%+ overhead (lower end only for simplest tasks; agents "think about thinking")
- **Pros**: Fast prototyping, declarative, great DX
- **Cons**: Latency overhead, debugging opacity, non-deterministic
- **Best for**: Rapid prototyping, creative workflows

### 1.4 AutoGen (Microsoft) / AG2
- **Type**: Conversation-based orchestration
- **Description**: Agents communicate via message passing. GroupChat manager as bus.
- **Footprint**: Medium-High
- **Token cost**: 8-28% latency overhead, 20-50% cost increase (negotiation tokens)
- **Pros**: Natural for chat, code execution, dynamic collaboration
- **Cons**: Non-deterministic routing, context stuffing, expensive
- **Best for**: Research, coding swarms, open-ended problems

### 1.5 MetaGPT
- **Type**: Role-based (software engineering)
- **Description**: Specialized roles (PM, Architect, Engineer, QA) with SOPs. Shared message pool.
- **Footprint**: Medium
- **Token cost**: High (multiple roles process full context)
- **Pros**: Structured output, follows real SDLC
- **Cons**: Overkill for non-software tasks, rigid roles
- **Best for**: Software engineering automation, code generation

### 1.6 BabyAGI
- **Type**: Task-driven autonomous
- **Description**: Objective → task list → execute → reprioritize → repeat. Vector DB for task storage.
- **Footprint**: Low (~300 lines core)
- **Token cost**: Medium (repeated planning)
- **Pros**: Simple, autonomous, good for exploration
- **Cons**: Can loop/noop, no quality gates
- **Best for**: Open-ended research, exploration

### 1.7 Plan-and-Execute
- **Type**: Two-stage (plan then execute)
- **Description**: Planner decomposes task → Executor runs subtasks sequentially/parallel. Plan can be revised.
- **Footprint**: Low
- **Token cost**: Low-Medium (one planning pass)
- **Pros**: Predictable, good for structured tasks
- **Cons**: Rigid if plan is wrong, no backtracking
- **Best for**: Well-understood tasks with clear steps

### 1.8 Hierarchical Task Decomposition
- **Type**: Manager + Workers
- **Description**: Manager agent decomposes, delegates to specialized workers, synthesizes results.
- **Footprint**: Low-Medium
- **Token cost**: Medium (manager processes all)
- **Pros**: Clean separation, specialized workers, scales well
- **Cons**: Manager is bottleneck, single point of failure
- **Best for**: Multi-domain tasks, research synthesis

### 1.9 Mixture of Agents (MoA)
- **Type**: Ensemble/voting
- **Description**: Multiple agents propose → aggregator synthesizes best response. Layers of proposers + aggregators.
- **Footprint**: High (multiple LLM calls per turn)
- **Token cost**: Very high (N proposals + synthesis)
- **Pros**: Highest quality, diverse perspectives
- **Cons**: Expensive, slow, N calls per output
- **Best for**: High-stakes quality, research papers

### 1.10 Router/Orchestrator
- **Type**: Central dispatch
- **Description**: Router classifies input → dispatches to specialized handler agent. No conversation state in router.
- **Footprint**: Very low
- **Token cost**: Very low (single classification call)
- **Pros**: Minimal overhead, fast, clear isolation
- **Cons**: No cross-agent conversation, limited flexibility
- **Best for**: Customer support, intent classification

### 1.11 Delegation Pattern (Subagent-first)
- **Type**: Supervisor + tools-as-agents
- **Description**: Main agent calls subagents as tools. Subagents are ephemeral, stateless, context-isolated.
- **Footprint**: Very low (no framework needed)
- **Token cost**: Low (only returns summary to main)
- **Pros**: Context isolation, clean, minimal overhead
- **Cons**: Subagents can't converse directly
- **Best for**: Context isolation, parallel research

### 1.12 Pipe/Filter Architecture
- **Type**: Sequential processing pipeline
- **Description**: Each stage is an agent/transformer. Output of one = input of next.
- **Footprint**: Very low
- **Token cost**: Low (linear, no overhead)
- **Pros**: Simple, predictable, testable per stage
- **Cons**: No feedback loops, linear only
- **Best for**: ETL, document processing, translation

### 1.13 Event-Driven Agent Workflows
- **Type**: Pub-Sub / async
- **Description**: Agents react to events via message bus. Loose coupling, async execution.
- **Footprint**: Medium (message bus infrastructure)
- **Token cost**: Medium (event serialization overhead)
- **Pros**: Highly scalable, decoupled, flexible
- **Cons**: Complex debugging, eventual consistency
- **Best for**: Large-scale systems, multi-service coordination

---

## 2. Memory Patterns

### 2.1 Shared Context Pool (Blackboard)
- **Description**: Central shared workspace. Agents read/write. Publish-subscribe pattern.
- **Footprint**: Low-Medium
- **Token cost**: Variable (shared context size)
- **Best for**: Open-ended problem solving, collaborative design

### 2.2 Tuple Space / Linda Model
- **Description**: Generative communication via tuples. Agents read/write/withdraw from tuple space.
- **Footprint**: Low
- **Token cost**: Low (structured tuples)
- **Best for**: Coordination without central control

### 2.3 Engram Persistent Memory
- **Description**: Cross-session memory with FTS5 search, topic keys, upsert. Sessions survive compaction.
- **Footprint**: Very low (SQLite-backed)
- **Token cost**: Very low (search, not reprocess)
- **Best for**: Persistent agent memory, session continuity

### 2.4 Hermes Agent / Skill-Forge
- **Description**: Skills extracted from experience → SQLite → top-3 injected pre-turn. Self-curation.
- **Footprint**: Low (SQLite + scoring)
- **Token cost**: Low (only injects matched skills)
- **Best for**: Self-improving agents, pattern learning

---

## 3. Communication Patterns

### 3.1 MCP (Model Context Protocol) — Anthropic
- **Description**: Standardized protocol for agent↔tool communication. JSON-RPC 2.0 over stdio/SSE.
- **Footprint**: Low (protocol, not framework)
- **Pros**: Interoperable, standardized, growing ecosystem
- **Cons**: Client must implement spec
- **Best for**: Tool integration, cross-platform agents

### 3.2 A2A (Agent-to-Agent) — Google
- **Description**: Protocol for direct agent↔agent communication. Task-oriented.
- **Footprint**: Medium (HTTP-based)
- **Pros**: Standardized inter-agent communication
- **Cons**: Early stage, limited adoption
- **Best for**: Cross-platform agent collaboration

### 3.3 Latent Communication (Continuous Representations)
- **Description**: Exchange embeddings/hidden states/KV-caches instead of text. Bypasses token generation.
- **Footprint**: Low (embeddings vs full text)
- **Token cost**: Near-zero (no text gen for messages)
- **Pros**: High speed, low cost, information-preserving
- **Cons**: Non-interpretable, cross-model alignment needed
- **Best for**: High-throughput agent swarms, research

### 3.4 ACON (Agent Context Optimization)
- **Description**: Compression guideline in natural language. Failure-driven iteration. 26-54% token reduction.
- **Footprint**: Low (compression guidelines)
- **Token cost**: Low (26-54% reduction)
- **Pros**: Gradient-free, closed-source compatible, distillable
- **Cons**: +15-30s latency on A100 for compression
- **Best for**: Long-running agents with context pressure

---

## 4. Quality Patterns

### 4.1 Reflection Agents (Self-Critique)
- **Description**: Agent generates → reviews own output → refines. Multiple passes.
- **Footprint**: Low
- **Token cost**: 2-3x (generate + review + refine)
- **Pros**: Catches errors, improves quality
- **Cons**: Expensive, can over-edit
- **Best for**: Code generation, writing, translation

### 4.2 Multi-Agent Debate
- **Description**: Agents debate positions, refine through argument. Multiple rounds.
- **Footprint**: Medium
- **Token cost**: High (N agents × M rounds)
- **Pros**: Reduces hallucination, diverse viewpoints
- **Cons**: Very expensive, can converge on wrong answer
- **Best for**: Factual accuracy, complex reasoning

### 4.3 AgentSlimming
- **Description**: Prunes redundant agents, quantizes expensive agents to cheaper models. 78.9% cost reduction.
- **Footprint**: N/A (optimization framework)
- **Token cost**: Up to 78.9% reduction
- **Pros**: Automated optimization, pareto-optimal
- **Cons**: Requires probe dataset, offline optimization
- **Best for**: Production agent workflows with budget constraints

### 4.4 Ensemble / Voting
- **Description**: N agents → vote → aggregate. Different models/prompts.
- **Footprint**: High (N independent runs)
- **Token cost**: N × single agent
- **Pros**: Robust, uncertainty quantification
- **Cons**: Expensive, redundant
- **Best for**: Classification, factual QA

---

## 5. Ultra-Lightweight Frameworks

### 5.1 LightAgent
- **Description**: 1000 lines Python, no deps (no LangChain/LlamaIndex). mem0 + ToT + tools.
- **Footprint**: ~1000 lines core
- **Token cost**: Minimal overhead
- **Best for**: Resource-constrained, embedded devices

### 5.2 SmolClaw (C11)
- **Description**: 280KB binary, 672KB RAM peak. Multi-channel, MCP, FTS5 memory.
- **Footprint**: **280KB** static binary
- **Token cost**: Minimal
- **Best for**: Toaster-grade hardware, extreme constraints

### 5.3 PicoAgents
- **Description**: Ultra-lightweight, Shannon entropy routing, only 2 deps. GraphRAG.
- **Footprint**: Minimal (2 deps)
- **Token cost**: Low (entropy-gated execution)
- **Best for**: Personal assistants, minimal resource

### 5.4 Tiny Agents
- **Description**: 0.5B-3B models only, shared weights + LoRA. KV cache pooling.
- **Footprint**: ~16GB vRAM minimum (all agents)
- **Token cost**: Low (small models)
- **Best for**: Local-only, GPU-available scenarios

---

## 6. Comparison Matrix

| Pattern | RAM | CPU | Tokens | Quality | Complexity | Best For |
|---------|-----|-----|--------|---------|------------|----------|
| **Delegation (subagent-first)** | ★★★★★ | ★★★★★ | ★★★★★ | ★★★ | ★★★★★ | Context isolation, parallel research |
| **Router/Orchestrator** | ★★★★★ | ★★★★★ | ★★★★★ | ★★★ | ★★★★★ | Simple classification + dispatch |
| **Pipe/Filter** | ★★★★★ | ★★★★★ | ★★★★ | ★★★★ | ★★★★★ | ETL, document processing |
| **Reflection** | ★★★★★ | ★★★★ | ★★★ | ★★★★★ | ★★★★★ | Code gen, writing quality |
| **Plan-and-Execute** | ★★★★ | ★★★★ | ★★★★ | ★★★★ | ★★★★ | Structured tasks |
| **Hierarchical** | ★★★★ | ★★★ | ★★★ | ★★★★ | ★★★★ | Multi-domain research |
| **LangGraph** | ★★★ | ★★★ | ★★★★ | ★★★★★ | ★★ | Production workflows |
| **CrewAI** | ★★★ | ★★ | ★★ | ★★★★ | ★★★★ | Prototyping |
| **AutoGen** | ★★ | ★★ | ★★ | ★★★★ | ★★★ | Coding research |
| **MoA** | ★ | ★ | ★ | ★★★★★ | ★ | Highest quality tasks |
| **LightAgent** | ★★★★★ | ★★★★★ | ★★★★ | ★★★★ | ★★★★★ | Resource-constrained |
| **SmolClaw** | ★★★★★ | ★★★★★ | ★★★★ | ★★★ | ★★★★★ | Toaster-grade hardware |
| **AgentSlimming** | N/A | N/A | ★★★★★ | ★★★★ | ★★ | Production cost optimization |

★ = Best (5) to Worst (1)

---

## 7. Recommendation: Layered Architecture

For **optimal resource efficiency + quality**, combine:

```
Layer 1: Delegation (subagent-first) → core orchestration
Layer 2: Pipe/Filter → sequential processing where applicable
Layer 3: Reflection → quality verification on critical outputs
Layer 4: Router → classification for task routing
Layer 5: AgentSlimming principles → periodic cost optimization
Layer 6: Engram memory → persistent context across sessions
```

**Avoid**: Full framework lock-in (LangGraph/CrewAI/AutoGen) unless production needs justify overhead.
**Prefer**: Built-in subagent capabilities + lightweight coordination + targeted quality checks.

---

## 8. Key Papers

| Paper | Year | Key Result |
|-------|------|------------|
| AgentSlimming (ACL 2026) | 2026 | 78.9% cost reduction via pruning |
| ACON (ICML 2026) | 2026 | 26-54% agent context reduction |
| Beyond Self-Talk (FCS 2026) | 2026 | Communication-centric MAS survey |
| Orchestration Patterns Survey (2026) | 2026 | 6-dim evaluation framework |
| Latent Communication (arXiv 2606.05711) | 2026 | Continuous representation exchange |
| LightAgent (arXiv 2509.09292) | 2025 | 1000-line agent framework |
