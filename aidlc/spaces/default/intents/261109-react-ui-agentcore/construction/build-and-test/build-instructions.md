# Build Instructions: HR Leave Portal Web UI

## Prerequisites

- Node.js 20+ and npm (the UI uses Vite 8, React 19 and TypeScript 6).
- Python 3.12+ with the project venv `.venv/`. The venv is managed by `uv`, so use `uv pip`; the venv has no pip.
- AWS CDK CLI (`npx aws-cdk` or a global `cdk`) for synth and deploy.
- For deploy only: AWS credentials for the target account, and the two build scripts already run (they publish the Lambda layer ARN and the agent image URI to SSM).

## Dependency Installation

```bash
npm --prefix ui ci
uv pip install --python .venv/bin/python -r requirements.txt -r requirements-dev.txt
```

## Environment and Config

- The UI reads `/config.json` at runtime. For local dev, copy `ui/public/config.example.json` to `ui/public/config.json`, which is git-ignored, and fill in the stack outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `AgentRuntimeArn` and the region.
- In AWS, the `HrLeavePortalUi` stack generates `config.json` from the backend and agent stacks. A local `config.json` is excluded from the upload.
- No secrets go in the UI or its config.

## Build Commands

```bash
npm --prefix ui run lint      # ESLint, must report 0 errors
npm --prefix ui run build     # tsc -b && vite build -> ui/dist/
```

`ui/dist/index.html` must exist before any `cdk synth` or `cdk deploy`, because `app.py` instantiates `HrLeavePortalUi`. If it is missing, the UI stack stops with a message telling you to build `ui/` first.

## Build Verification

- `npm --prefix ui run build` exits 0 and writes `ui/dist/index.html` plus its assets.
- `npx cdk synth` synthesizes all 5 stacks (Notifications, Backend, StateMachine, AgentRuntime, Ui).

## Deploy Order (reference for the deployment stages)

1. Run the existing scripts (FastAPI layer, then `scripts/build_and_push_agent.sh`).
2. `npm --prefix ui ci && npm --prefix ui run build`.
3. `npx cdk deploy --all`, or deploy the backend stacks first and then `npx cdk deploy HrLeavePortalUi`.
4. Open the `HrLeavePortalUi.UiUrl` output.

## Troubleshooting

- **`document is not defined` in Vitest**: you ran Vitest from the repo root. Use `npm --prefix ui test -- <files>` so `ui/vite.config.ts` (jsdom) is loaded.
- **`FileNotFoundError ... run npm ci && npm run build in ui/` during synth**: build the UI first.
- **Vite "chunks larger than 500 kB" note**: advisory only. The bundle is about 879 kB (243 kB gzip), mostly Amplify.
- **Sign-in works, but every API call shows "session expired"**: check the backend has been redeployed with the new Gateway Responses (FR6.1), and that the UI sends the ID token.
