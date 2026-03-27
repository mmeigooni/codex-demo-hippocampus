# Codex Agent Harness Evaluation

**Alignment analysis between the OpenAI Codex open-source repository and the internal engineering practices described in "Harness Engineering: Leveraging Codex in an Agent-First World"**

Evaluated: February 2026
Sources: [github.com/openai/codex](https://github.com/openai/codex) (commit `b73c4b50a`), blog post by Ryan Lopopolo (OpenAI, Feb 11 2026)

---

## 1. Article Summary

"Harness Engineering: Leveraging Codex in an Agent-First World" describes a team of 3–7 OpenAI engineers who built a production software product with **zero manually-written code** over 5 months. The results:

- ~1,000,000 lines of code
- ~1,500 pull requests
- 3.5 PRs per engineer per day average throughput
- Internal daily users and external alpha testers

The core philosophy: **"Humans steer. Agents execute."**

The article identifies these key engineering domains:

| Domain | Description |
|--------|-------------|
| **Application legibility** | Making the app debuggable by agents (per-worktree instances, Chrome DevTools Protocol, observability stack) |
| **Repository knowledge** | Structured docs/ directory, short AGENTS.md as TOC, design docs, product specs, execution plans, quality scores |
| **Agent legibility** | Favoring "boring" composable tech, pulling all context into the repo, eliminating tacit/external knowledge |
| **Architectural enforcement** | Layered domain architecture, cross-cutting Providers interface, custom linters, "taste invariants" |
| **Merge philosophy** | Minimal blocking gates, short-lived PRs, follow-up fixes over indefinite blocking |
| **Increasing autonomy** | End-to-end feature delivery: validate → reproduce → record → implement → drive app → validate → PR → feedback → merge |
| **Entropy management** | Background agents continuously scan for drift, open targeted refactoring PRs ("garbage collection") |

---

## 2. Codex Repository - Harness Capabilities Inventory

The open-source codex repository (`codex-rs/`) is a Rust monorepo of 65+ crates implementing a complete AI agent execution framework. Key capabilities:

### Core Execution Engine
- **Turn management**: `Op::UserTurn` -> `TurnContext` -> model API call -> tool invocation -> output streaming -> persistence
- **Session orchestration**: `codex.rs` (346KB central file), `codex_thread.rs`, `thread_manager.rs`
- **Streaming**: SSE streaming against the OpenAI Responses API via `client.rs`

### Tool System
- **Registry-based** (`ToolRegistry`, `ToolRouter`, `ToolHandler` trait)
- **Built-in tools**: `shell`, `apply_patch`, `read_file`, `list_dir`, `grep_files`, `js_repl`, `view_image`, `search`, `request_user_input`, `multi_agents`, `plan`
- **JSON Schema** input validation, output truncation, timeout/cancellation
- **Extensible** via MCP dynamic tools and the skills system

### Sandboxing (Cross-Platform)
- **macOS**: Seatbelt (`sandbox-exec`) with custom `.sbpl` profiles
- **Linux**: Seccomp + Landlock via `codex-linux-sandbox` (bwrap support)
- **Windows**: Restricted token approach via `codex-windows-sandbox`
- **Policies**: `ReadOnly`, `WorkspaceWrite`, `DangerFullAccess`, `ExternalSandbox`
- **Controls**: writable paths, network access, env var isolation, fd inheritance, process group termination

### Approval & Policy Engine
- **`codex-execpolicy`**: Rule-based engine, TOML rules in `~/.codex/rules/`
- **Decisions**: `Allow`, `Prompt`, `Forbidden`, `Heuristics`
- **Modes**: `Never`, `OnFailure`, `OnRequest`, `UnlessTrusted`, `Reject`
- Integrated into every tool invocation path

### Multi-Agent Orchestration
- **`agent/control.rs`**: Agent control plane
- **Operations**: `spawn_agent`, `send_input`, `wait`, `resume_agent`, `close_agent`
- **Safety**: Configurable `max_depth` guards, nickname assignment, role-based agent types
- **Events**: `CollabAgentSpawn*`, `CollabAgentInteraction*`, `CollabWaiting*`

### Session Persistence (Rollout System)
- **Format**: `.jsonl` files under `~/.codex/sessions/YYYY/MM/DD/`
- **Operations**: `thread/resume`, `thread/fork`, `thread/rollback`, `thread/compact`
- **Metadata**: `.meta` files tracking creation time, title, source, archive status

### Client-Server Architecture (App Server)
- **Protocol**: JSON-RPC 2.0 over stdio/websocket
- **APIs**: `thread/*`, `turn/*`, `item/*`, `review/*`, `command/exec`, `skills/*`, `model/list`, `config/*`
- **Consumers**: VS Code extension, web clients, programmatic SDK

### MCP Integration
- **Client**: `mcp/`, `mcp_connection_manager.rs`, `rmcp-client/`
- **Server**: `codex-mcp-server` (Codex as MCP provider), `shell-tool-mcp` (sandboxed shell via MCP)
- **Dynamic tools**: MCP servers register tools at runtime

### Feature Flags
- **Stages**: `Beta`, `UnderDevelopment`, `Stable`
- **Examples**: `ShellTool` modes, `Collab`, `CollaborationModes`, `WebSearch`, `JsRepl`, `Apps`

### Authentication
- ChatGPT OAuth, API key (env/keyring), device code flow, token refresh

---

## 3. Alignment Analysis

### 3.1 Direct Alignment - Harness provides exactly what the article relies on

#### Core Agent Loop <- Turn Management
The article's fundamental pattern - agent receives task, writes code, runs it, iterates - maps directly to the `TurnContext` execution loop in `codex-core`. Every PR in the article's 1,500 was produced through this loop.

**Alignment: Complete**

#### "Humans Steer, Agents Execute" <- Approval & Policy Engine
The article describes humans maintaining control while agents do implementation work. The harness's `ExecPolicy` system with graduated approval modes (`Never` through `UnlessTrusted`) and TOML rule files is the mechanical implementation of this philosophy. Humans define the policy boundary; agents execute within it.

**Alignment: Complete**

#### Increasing Autonomy <- Sandbox Policies + Feature Flags
The article describes a progression from basic code writing to end-to-end feature delivery. The harness supports this through:
- `SandboxPolicy` levels that can be dialed from `ReadOnly` -> `DangerFullAccess`
- Feature flags gating capabilities like `Collab`, `ShellTool` modes, `WebSearch`
- Approval modes that can shift from `Always` prompting to `UnlessTrusted`

**Alignment: Complete - the harness is designed for exactly this graduated trust model**

#### Multi-Agent Background Tasks <- Agent Orchestration
The article describes "background Codex tasks" that scan for architectural drift and open refactoring PRs - essentially autonomous agents running in the background. The harness provides `spawn_agent`/`wait`/`close_agent` with depth guards and inter-agent communication, plus `codex-exec` for headless operation.

**Alignment: Complete**

#### Session Persistence & Iteration <- Rollout System
The article's iterative loops (reproduce -> implement -> validate -> loop until clean) require persistent state across turns. The rollout system with `.jsonl` session files, thread resume/fork/rollback, and metadata tracking provides this.

**Alignment: Complete**

#### Shell & File Operations <- Tool System
Every code change, build, test run, and application restart in the article flows through the harness's built-in tools: `shell` for command execution, `apply_patch` for code changes, `read_file`/`list_dir`/`grep_files` for codebase navigation.

**Alignment: Complete**

#### AGENTS.md as Knowledge Entry Point <- Harness Context Loading
The article describes a structured `docs/` directory with a short ~100-line `AGENTS.md` as table of contents. The harness reads `AGENTS.md` files as repo context - the repository's own `AGENTS.md` follows this exact pattern. This is a designed-in feature, not an accident.

**Alignment: Complete**

#### Safe Execution in Diverse Environments <- Cross-Platform Sandboxing
The article describes agents booting per-worktree app instances, driving browsers, querying observability stacks. The harness's Seatbelt/Seccomp/Landlock sandboxing with writable path scoping, network control, and process isolation makes this safe.

**Alignment: Complete**

#### Programmatic Client Access <- App Server + SDK
The article's throughput (3.5 PRs/engineer/day) implies programmatic orchestration - not just interactive CLI use. The harness's JSON-RPC 2.0 app server and TypeScript SDK (`@openai/codex-sdk`) enable this kind of automation layer.

**Alignment: Complete**

---

### 3.2 Partial Alignment - Harness provides primitives; the article describes systems built on top

#### Chrome DevTools Protocol UI Automation

**Article describes**: A tight loop - snapshot BEFORE -> trigger UI path -> capture runtime events -> snapshot AFTER -> apply fix -> restart -> LOOP until clean. Codex drives the browser via CDP to validate its own UI work.

**Harness provides**: The `shell` tool, MCP extensibility, and multi-turn execution loop. A `chrome-devtools` MCP skill exists in the ecosystem. But the specific orchestration pattern (screenshot comparison, event capture, automated retry loop) is custom tooling built on top of the harness primitives.

**Gap**: The harness enables CDP integration but doesn't ship a native "drive browser and validate UI" workflow. The article's team built this as application-level tooling.

#### Full Observability Stack (LogQL/PromQL/TraceQL)

**Article describes**: Victoria Logs/Metrics/Traces with Vector fan-out. Agents query telemetry data to diagnose issues, correlate events, and reason about application behavior.

**Harness provides**: `otel_init.rs` for the harness's own OpenTelemetry instrumentation. Agents can query external systems via `shell` or MCP tools. But the observability infrastructure itself (Victoria stack, Vector, query endpoints) is external to the harness.

**Gap**: The harness instruments itself but doesn't provide infrastructure for instrumenting the target application. The article's observability stack is a separate deployment that agents access through the harness's tool system.

#### End-to-End PR Lifecycle Automation

**Article describes**: Agents open PRs -> monitor CI -> respond to review feedback -> detect and fix build failures -> merge changes -> escalate only when judgment is needed.

**Harness provides**: `shell` access to `gh` CLI, `review/*` app-server endpoints, headless `codex-exec` mode. But the full autonomous PR lifecycle - watching CI status, parsing review comments, deciding when to merge vs. escalate - requires orchestration logic above the harness layer.

**Gap**: The harness provides all the necessary tools (shell, file ops, API access) but not the orchestration workflow for autonomous PR management. This is likely a script/service that invokes the harness programmatically.

---

### 3.3 Beyond Harness Scope - Engineering practices and infrastructure the harness doesn't provide

#### Layered Domain Architecture & Custom Linters

**Article describes**: Rigid architectural constraints - Types -> Config -> Repo -> Service -> Runtime -> UI dependency layers, cross-cutting Providers interface, custom linters that mechanically enforce dependency rules, file size limits, and naming conventions.

**Assessment**: These are **application-level concerns** - the linters enforce rules about the product being built, not about the agent harness. The harness is the tool that agents used to *create* these linters. The harness has no opinion about the architecture of the software agents produce.

#### "Garbage Collection" / Entropy Management

**Article describes**: Background agent tasks continuously scan for architectural drift and open refactoring PRs, functioning like a garbage collector for technical debt.

**Assessment**: This is an **operational pattern** - scheduled invocations of the harness (likely `codex-exec` or app-server API calls) with specific prompts targeting code quality. The harness provides the execution capability; the scheduling and targeting logic lives outside it.

#### Merge Philosophy (Minimal Blocking Gates)

**Article describes**: Short-lived PRs, follow-up fixes over indefinite blocking, minimal merge gates.

**Assessment**: This is a **process/culture decision**. The harness enables it by making corrections cheap (fast turn execution, low-latency agent invocations), but the policy itself is organizational, not technical.

#### Doc-Gardening Automation

**Article describes**: Automated processes detecting stale documentation, updating it, enforcing freshness.

**Assessment**: Another **operational pattern** - scheduled agent runs focused on documentation quality. Built on the harness but not a feature of it.

#### Encoding Tacit Knowledge into the Repository

**Article describes**: Anything not in the repo (Google Docs, Slack, tacit knowledge) doesn't exist to the agent. The team systematically encodes all knowledge as markdown in the repo.

**Assessment**: This is a **methodology**, not a harness feature. The harness's design (reading `AGENTS.md`, processing repo context) incentivizes this behavior, but the discipline of actually doing it is a human practice.

---

## 4. Summary Matrix

| Capability | Article Relies On | Harness Provides | Alignment |
|------------|-------------------|------------------|-----------|
| Core agent execution loop | Yes | Full turn lifecycle | Direct |
| Tool use (shell, files, patches) | Yes | 10+ built-in tools + MCP extensibility | Direct |
| Graduated autonomy | Yes | Sandbox policies + approval modes + feature flags | Direct |
| Multi-agent orchestration | Yes | spawn/wait/resume/close + depth guards | Direct |
| Session persistence & resumption | Yes | Rollout system (.jsonl + fork/resume/rollback) | Direct |
| Repository knowledge (AGENTS.md) | Yes | Context loading from AGENTS.md files | Direct |
| Cross-platform sandboxing | Yes | Seatbelt/Seccomp/Landlock/Windows tokens | Direct |
| Programmatic API access | Yes | App server (JSON-RPC) + TypeScript SDK | Direct |
| Approval/escalation flows | Yes | ExecPolicy engine + TOML rules | Direct |
| Chrome DevTools UI automation | Yes | MCP extensibility + shell (primitives only) | Partial |
| Observability stack queries | Yes | Shell access to external systems (primitives only) | Partial |
| End-to-end PR lifecycle | Yes | Shell + gh CLI + review API (primitives only) | Partial |
| Architectural linting | Yes | Not in scope (application-level) | Outside scope |
| Entropy/GC management | Yes | Not in scope (operational pattern) | Outside scope |
| Merge philosophy | Yes | Enables via throughput (cultural decision) | Outside scope |
| Doc-gardening | Yes | Not in scope (operational pattern) | Outside scope |
| Knowledge encoding discipline | Yes | Incentivized by design (human methodology) | Outside scope |

---

## 5. Conclusions

### The harness is the engine; the article describes the vehicle

The codex repository provides the **complete runtime infrastructure** for the engineering approach described in the article. Every core capability the article depends on - tool use, sandboxing, approval flows, multi-agent orchestration, session persistence, graduated autonomy - is present in the open-source codebase. The 9 areas of direct alignment cover the fundamental execution model.

### The 3 partial-alignment areas are addressable

The gaps (CDP automation, observability queries, PR lifecycle) are all cases where the harness provides sufficient primitives (shell, MCP, headless execution) but the article's team built higher-order orchestration on top. These could be implemented as:
- MCP servers (the `chrome-devtools` skill already exists in the ecosystem)
- Scripts invoking `codex-exec` or the app-server API
- Skills registered via the skills system

### The 5 out-of-scope areas are intentionally outside the harness

Architectural linting, entropy management, merge philosophy, doc-gardening, and knowledge discipline are **engineering practices**, not runtime features. The harness correctly stays unopinionated about these - it's a general-purpose agent execution framework, not a prescriptive development methodology. The article's contribution is showing what practices make the harness maximally effective.

### The design philosophy is shared

The most telling alignment is philosophical: the harness's `SandboxPolicy` levels + `ExecPolicy` approval modes + feature flags implement **exactly** the graduated trust model the article advocates. The harness was designed for the "humans steer, agents execute" paradigm before the article articulated it - because the same team built both.

### What the article adds that the harness cannot

The article's key insight is that **the repository itself is the interface to the agent**. The harness can read `AGENTS.md` and execute tools, but making a codebase *legible* to an agent - structured docs, boring composable tech, everything-in-repo, mechanical enforcement of taste - is an engineering discipline that no runtime can provide. The harness is necessary but not sufficient; the article describes the sufficient conditions.
