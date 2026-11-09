# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-09
- Commit: 3e968145993fc50c7e6fd64b1919bbc1b1f6443d
- Notes: full rescan of the working tree (uncommitted changes included; apart from `ui/package.json`/lock and the `.gitignore` AI-DLC block they are line-ending only). Minimal depth. Build output, dependency folders, caches, gitignored local state and AI-DLC's own install were left out unopened.

## Scope of Analysis

```yaml
scope_version: 1
kind: full
intent: react-ui-agentcore
fingerprint: 6b84fe2efa2df32cf8396f0fa101b15fccb53cad
analyzed:
  paths:
    - ./
  components:
    - API Lambda (FastAPI)
    - BackendStack
    - NotificationStack
    - StateMachineStack
    - HR State Machine
    - AgentRuntimeStack
    - HR Agent (Strands on AgentCore)
    - Build Scripts
    - React UI Scaffold
    - CDK Unit Tests
shallow:
  paths:
    - ui/src/assets/
    - ui/public/
```
