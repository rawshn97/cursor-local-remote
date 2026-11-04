# Cursor Local Remote: Product Requirements Document & Architecture Specification

**Project ID:** `cd5ab6d5-3327-4fe6-b896-c9cd91d054dd`  
**Owner:** `mishraroshanraj@gmail.com`  
**Repository:** `cursor-local-remote`  
**Status:** Fully Verified (13 verified requirements, 0 draft)  
**Specification Version:** 1.1.0  

---

## Executive Summary

Cursor Local Remote (CLR) is a local-network progressive web application (PWA) enabling developers to monitor, prompt, and steer Cursor CLI agent sessions directly from a smartphone, tablet, or secondary browser. CLR bridges the gap between desktop-bound autonomous coding and mobile developer workflows, providing instant QR-code local network pairing, real-time token/tool-call streaming, workspace switching, interactive web terminal access, git operations, and desktop-grade voice dictation without relying on third-party cloud intermediaries.

---

## Part I: Business Requirements Narrative & Boundaries

### 1. Problem Statement
Autonomous AI coding agents in Cursor are increasingly capable of long-running, multi-step engineering tasks (running test suites, refactoring repositories, auditing codebases). However, monitoring these tasks currently binds developers to their physical desktop or laptop screen. Existing workarounds either lack real-time visibility into tool calls and diffs, or require exposing local files to external proprietary cloud relays.

### 2. Stakeholders & User Roles
- **Remote Developer (`SH-001`):** A software engineer who initiates autonomous coding sessions on their primary workstation and requires mobile oversight while away from their desk (e.g., cooking, taking breaks, or moving around the home/office network).
  - *Core Outcomes:* Instant zero-configuration pairing, sub-150ms stream latency, reliable audio/visual completion alerts, and safe local-network access.

### 3. Deployment Boundaries & Network Topology
CLR defines strict operating boundaries between internal local-network traffic and external access:
- **Local Network Boundary (Default):** CLR runs on the host machine listening on `http://<LAN_IP>:3100` or `http://localhost:3100`. All HTTP traffic, Server-Sent Events (SSE), and terminal streams remain strictly on the local subnet. No telemetry or source code is emitted to outside services.
- **Cloudflare Zero Trust Ingress (Optional):** When external internet access is required, CLR runs behind a local Cloudflare Tunnel (`cloudflared`) routed to a user-controlled domain (e.g. `clr.rawshn.com`). The tunnel terminates at Cloudflare Access, which injects verified identity headers (`CF-Access-Client-Id`, `CF-Access-Client-Secret`, or JWT assertions) verified by CLR's security middleware.
- **Exclusions:** Multi-tenant shared cloud hosting is explicitly out of scope. CLR is a single-developer workstation server.

### 4. Supported Platform & Environment Matrix
- **Host Workstation:** macOS 14+ (Sonoma, Sequoia, Tahoe), Linux x86_64 / arm64.
- **Node.js Runtime:** Node.js 20 LTS or higher.
- **Cursor Ecosystem:** Cursor IDE 0.40+ and Cursor CLI (`cursor` / `cursor-agent` binary in PATH).
- **Client Mobile Devices:** iOS 16+ (Safari PWA), Android 12+ (Chrome, Edge PWA).

### 5. Glossary of Core Terms
- **Host Server:** The local Next.js HTTP and WebSocket server running on port 3100 of the developer's workstation.
- **Cursor Agent:** The autonomous child process spawned by the Cursor CLI that executes prompts, reads files, and invokes tools.
- **Project Workspace:** A local filesystem directory recognized by Cursor IDE, typically discovered via `~/.cursor` and `state.vscdb`.
- **Resume Semantics:** The ability to reload an existing conversation thread from disk by its `sessionId` and continue streaming turns.
- **Stream Latency:** The wall-clock duration between an agent process stdout token emission and its rendering in the client DOM (target: < 150ms).
- **Smart Punctuation:** Client-side speech processing that capitalizes sentences and converts spoken markers (e.g. "period", "comma", "question mark") into punctuation characters.

---

## Part II: System Architecture, Data Flow & Agent Lifecycle

### 1. Architecture Topology

```mermaid
flowchart TD
    subgraph Client ["Client Device (iOS Safari / Android Chrome PWA)"]
        PWA[Mobile Chat UI]
        Voice[Web Speech API Dictation]
        QRModal[Pairing & Key Storage]
        GitUI[Git Staging & Diff Panel]
        TermUI[Web PTY Terminal View]
    end

    subgraph SecurityGate ["Network & Security Boundary"]
        LAN[Local Wi-Fi Subnet :3100]
        Tunnel[Cloudflare Zero Trust Tunnel]
        Middleware[Next.js Security Middleware]
    end

    subgraph Server ["Host Machine: CLR Server (Port 3100)"]
        NextAPI[Next.js API & Route Handlers]
        ProcReg[Process Registry & Signal Manager]
        PtyMgr[Node PTY Terminal Registry]
        Store[Transcript Reader & Session Cache]
    end

    subgraph HostCursor ["Host Machine: Cursor CLI & Filesystem"]
        CLI[Cursor CLI Process / Agent]
        Secrets[~/.cursor/secrets/cursor.env]
        VSCDb[Cursor IDE state.vscdb / Sessions]
        Git[Local Git Repositories]
    end

    Client -->|Direct LAN Traffic| LAN
    Client -->|Authenticated Tunnel| Tunnel
    LAN --> Middleware
    Tunnel --> Middleware
    Middleware --> NextAPI

    NextAPI --> ProcReg
    NextAPI --> PtyMgr
    NextAPI --> Store
    NextAPI --> Git

    ProcReg -->|Spawn & Monitor with SIGINT/SIGTERM| CLI
    ProcReg -->|Read API Key| Secrets
    Store -->|Parse Transcripts| VSCDb
    PtyMgr -->|Interactive Shell PTY| CLI
```

### 2. Agent Process Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Spawning: User submits prompt (POST /api/chat)
    Spawning --> Streaming: CLI process spawned with arguments
    Streaming --> Streaming: Emitting tokens and tool calls via SSE
    Streaming --> WaitingApproval: Destructive tool requires confirmation
    WaitingApproval --> Streaming: User approves tool execution
    WaitingApproval --> Canceling: User rejects or cancels
    Streaming --> Canceling: User taps Stop / Abort button
    Canceling --> Idle: SIGINT propagated to child process
    Streaming --> Completed: CLI exits with code 0
    Streaming --> Error: CLI exits with non-zero code or error
    Completed --> Idle: Session saved to transcript store
    Error --> Idle: Error details displayed to user
```

---

## Part III: Coded Requirements

### 1. Pairing & Network Security

#### `REQ-002` (Pairing: Terminal QR Code & Mobile Modal)
- **Requirement:** The server must generate an ASCII QR code in the terminal and a modal in the web UI containing the local network URL and access token.
- **Lifecycle:** `verified` (locked)
- **Priority:** Must | **Category:** Functional, Usability
- **Code References:** `bin/cursor-remote.mjs`, `src/components/qr-modal.tsx`, `src/lib/network.ts`
- **Rationale:** Allows developers to quickly connect mobile phones without manually looking up or typing LAN IP addresses.
- **Risk:** If local IP detection fails, mobile devices cannot resolve the server address over Wi-Fi.

#### `REQ-009` (Security Middleware & Access Key Protection)
- **Requirement:** The server must enforce access key authentication via middleware and support Cloudflare Access validation.
- **Lifecycle:** `verified` (locked)
- **Priority:** Must | **Category:** Security, Constraint
- **Code References:** `src/middleware.ts`, `src/lib/cloudflare-access.ts`, `bin/cursor-remote.mjs`
- **Tests:** `tests/validation.test.mjs`
- **Rationale:** Prevents unauthorized network peers on shared Wi-Fi networks from invoking arbitrary shell commands or agent prompts.
- **Risk:** Unprotected local ports allow anyone on the same Wi-Fi network to execute code on the host machine.

#### `REQ-012` (Token Lifecycle, Timing Attack Defense & Zero Trust Ingress)
- **Requirement:** The system must enforce secure token generation, constant-time validation, and support Cloudflare Zero Trust tunnel boundaries.
- **Lifecycle:** `verified` (locked)
- **Priority:** Must | **Category:** Security, Constraint
- **Code References:** `src/middleware.ts`, `src/lib/cloudflare-access.ts`, `bin/cursor-remote.mjs`
- **Tests:** `tests/validation.test.mjs`
- **Rationale:** Establishes clear security and deployment boundaries preventing unauthorized local LAN or external access.
- **Risk:** Insecure token comparison or ambiguous network boundaries allow unauthorized command execution.

---

### 2. Agent Execution, Streaming & Voice

#### `REQ-001` (CLI Bridge & Environment Key Loader)
- **Requirement:** The CLI server must load the Cursor API key from local environment/secrets and correctly format arguments and model parameters when spawning the Cursor agent.
- **Lifecycle:** `verified` (locked)
- **Priority:** Must | **Category:** Functional
- **Code References:** `bin/dev.mjs`, `src/cursor-cli.mjs`
- **Tests:** `tests/cursor-cli.test.mjs`
- **Rationale:** Ensures local remote web UI can authenticate and spawn Cursor CLI agent sessions securely.
- **Risk:** If API key parsing or argument construction fails, remote prompt invocations fail silently or error out.

#### `REQ-011` (Non-Functional: Stream Latency, Reconnection & Concurrency SLOs)
- **Requirement:** The system must deliver real-time streaming with event latency under 150ms, auto-reconnection within 2000ms, and maintain memory below 150MB RSS.
- **Lifecycle:** `verified` (locked)
- **Priority:** Must | **Category:** Non-Functional, Performance, Reliability
- **Code References:** `src/app/api/chat/route.ts`, `src/lib/constants.ts`, `src/components/chat-container.tsx`
- **Rationale:** Guarantees a responsive real-time streaming experience on mobile devices without excessive battery or resource drain.
- **Risk:** High streaming latency or memory leaks degrade mobile responsiveness and exhaust host machine resources.

#### `REQ-013` (Process Lifecycle & Signal Management)
- **Requirement:** The system must formalize agent execution lifecycle states, propagate abort signals to child processes, and clean up finished tasks.
- **Lifecycle:** `verified` (locked)
- **Priority:** Must | **Category:** Functional, Process
- **Code References:** `src/lib/process-registry.ts`, `src/lib/cursor-cli.ts`, `src/app/api/chat/route.ts`
- **Rationale:** Formalizes agent execution lifecycle and guarantees safe process cancellation and resource cleanup.
- **Risk:** Uncontrolled child processes create orphan zombie tasks that exhaust system CPU and lock files.

#### `REQ-010` (Mobile Voice Dictation & Audio Feedback)
- **Requirement:** The mobile composer must provide desktop-grade speech-to-text dictation with live interim transcript streaming, visual audio activity feedback, cursor-position text insertion, and mobile touch ergonomics.
- **Lifecycle:** `verified` (locked)
- **Priority:** Should | **Category:** Functional, Usability
- **Component:** `composer-voice`, `mobile-ui`
- **Code References:** `src/hooks/use-speech-recognition.ts`, `src/lib/speech.ts`, `src/components/chat-input.tsx`
- **Tests:** `tests/speech.test.mjs`
- **Rationale:** Enables friction-free prompt input on mobile phones matching desktop voice dictation quality.
- **Risk:** Poor audio streaming or sudden recognition drops create frustrating transcription errors on mobile keyboards.

---

### 3. Workspace, Session & History Management

#### `REQ-003` (Multi-Workspace Discovery & Starred Repos)
- **Requirement:** The system must discover existing Cursor workspaces, provide an API to switch projects, and allow starring frequent repositories.
- **Lifecycle:** `verified` (locked)
- **Priority:** Must | **Category:** Functional
- **Code References:** `src/lib/cursor-workspaces.ts`, `src/lib/workspace-paths.server.ts`, `src/app/api/projects/route.ts`, `src/components/session-sidebar.tsx`
- **Rationale:** Enables developers to manage and execute agent workflows across multiple repositories from a single mobile dashboard.
- **Risk:** Incomplete workspace discovery leaves developer projects inaccessible from the remote UI.

#### `REQ-006` (Session Store, Resumption, & Transcript Export)
- **Requirement:** The system must load past agent sessions, allow resuming previous conversations, and export formatted transcripts.
- **Lifecycle:** `verified` (locked)
- **Priority:** Must | **Category:** Functional
- **Code References:** `src/lib/session-store.ts`, `src/lib/transcript-reader.ts`, `src/lib/export.ts`, `src/app/api/sessions/route.ts`
- **Tests:** `tests/session-export.test.mjs`
- **Rationale:** Preserves agent continuity and allows developers to review, resume, or document past agent decisions.
- **Risk:** Corrupted session JSON files could crash the reader if parsing is not defensive.

---

### 4. Developer Tools, PWA & Alerts

#### `REQ-004` (Integrated Git Control Panel)
- **Requirement:** The system must provide an integrated Git management panel allowing developers to inspect diffs, stage files, commit, and push/pull.
- **Lifecycle:** `verified` (locked)
- **Priority:** Should | **Category:** Functional
- **Code References:** `src/components/git-panel.tsx`, `src/app/api/git/route.ts`
- **Rationale:** Allows developers to review agent-generated diffs and commit or push changes immediately from mobile.
- **Risk:** Git command execution failures or conflicts could corrupt branch state if unhandled.

#### `REQ-005` (In-Browser Interactive Terminal)
- **Requirement:** The system must provide an interactive browser terminal interface tied to the active project workspace.
- **Lifecycle:** `verified` (locked)
- **Priority:** Should | **Category:** Functional
- **Code References:** `src/components/terminal-panel.tsx`, `src/lib/terminal-registry.ts`, `src/app/api/terminal/route.ts`
- **Rationale:** Provides direct shell access to run scripts, tests, or diagnostic tools from phone or tablet.
- **Risk:** Zombie terminal sessions could leak memory or system resources if not cleaned up properly.

#### `REQ-007` (Background Alerts & External Webhooks)
- **Requirement:** The system must trigger tab title flashes, audio chimes, and optional webhook push notifications when agent tasks finish.
- **Lifecycle:** `verified` (locked)
- **Priority:** Should | **Category:** Functional, Usability
- **Code References:** `src/lib/webhooks.ts`, `src/app/api/notifications/route.ts`, `src/components/chat-container.tsx`
- **Rationale:** Alerts developer when a long-running coding task finishes so they do not have to continuously stare at the screen.
- **Risk:** Missed notifications delay developer response to agent questions or errors.

#### `REQ-008` (PWA Manifest & Mobile Viewport Handling)
- **Requirement:** The application must support PWA installation and provide responsive, touch-friendly layouts for mobile screens.
- **Lifecycle:** `verified` (locked)
- **Priority:** Should | **Category:** Usability
- **Code References:** `src/app/manifest.ts`, `src/components/pwa-install.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
- **Rationale:** Delivers a clean native-feeling mobile experience for full-screen phone coding sessions.
- **Risk:** Virtual keyboard popups on mobile could obscure chat inputs without dynamic viewport handling.

---

## Part IV: Definition of Done (DoD) Matrix

| Requirement Code | Acceptance Criteria Summary | Verification Method |
|---|---|---|
| **REQ-001** | API key resolved from `~/.cursor/secrets/cursor.env`; arguments placed before prompt; auto/default models stripped. | Automated tests in `tests/cursor-cli.test.mjs` |
| **REQ-002** | ASCII QR generated in terminal with local LAN IP and auth token; modal available in web UI; graceful fallback. | CLI startup smoke test |
| **REQ-003** | Cursor workspaces discovered from `~/.cursor`; project switching without restart; star persistence. | Workspace API integration test |
| **REQ-004** | Git status and diffs displayed; staging, custom commit, and push/pull functional. | Manual UI test & API validation |
| **REQ-005** | Interactive pty/shell spawned in workspace; I/O streamed; inactive processes cleaned up. | Terminal API session test |
| **REQ-006** | Historical transcripts read; previous sessions resumed; exports to Markdown/JSON. | Automated tests in `tests/session-export.test.mjs` |
| **REQ-007** | Flashes tab title ("Done! - CLR"); plays audio chime; dispatches webhook payload. | Browser background event test |
| **REQ-008** | Compliant PWA manifest; 44px min touch targets; responsive layout with active mobile virtual keyboard. | Mobile PWA installation audit |
| **REQ-009** | Validates access token in query/header/cookie; blocks unauthorized LAN peers; supports Cloudflare Access headers. | Automated tests in `tests/validation.test.mjs` |
| **REQ-010** | 44px touch mic button; real-time interim transcript streaming; cursor-position insertion; visual recording badge. | Automated tests in `tests/speech.test.mjs` (6 passing) |
| **REQ-011** | SSE stream event latency < 150ms; client auto-reconnects within 2000ms on Wi-Fi drop; memory < 150MB RSS. | Latency & reconnect soak test |
| **REQ-012** | Cryptographic 32-char token generated; constant-time comparison enforced; Zero Trust tunnel headers verified. | Automated tests in `tests/validation.test.mjs` |
| **REQ-013** | Explicit lifecycle states; clean SIGINT/SIGTERM signal propagation; no zombie CLI child processes. | Process registry termination test |

---

## Part V: Traceability Matrix

| Story Code | Story Summary | Target Requirement(s) | Implementation Status | Test Coverage |
|---|---|---|---|---|
| **S-001** | QR code mobile pairing | `REQ-002` | `verified` | CLI startup validation |
| **S-002** | Real-time agent streaming, diffs & lifecycle | `REQ-001`, `REQ-011`, `REQ-013` | `verified` | `tests/cursor-cli.test.mjs` (5 passing) |
| **S-003** | Multi-project workspace switching | `REQ-003` | `verified` | API route integration |
| **S-004** | Mobile Git operations panel | `REQ-004` | `verified` | UI component test |
| **S-005** | Interactive web terminal | `REQ-005` | `verified` | Process registry test |
| **S-006** | Session history, resumption, & export | `REQ-006` | `verified` | `tests/session-export.test.mjs` (4 passing) |
| **S-007** | Background notifications & webhooks | `REQ-007` | `verified` | Webhook dispatch test |
| **S-008** | PWA home screen installation | `REQ-008` | `verified` | Manifest schema test |
| **S-009** | Access key security & Zero Trust ingress | `REQ-009`, `REQ-012` | `verified` | `tests/validation.test.mjs` (3 passing) |
| **S-010** | Desktop-grade mobile voice dictation | `REQ-010` | `verified` | `tests/speech.test.mjs` (6 passing) |
