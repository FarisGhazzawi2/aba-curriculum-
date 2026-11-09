# Code Summary: HR Leave Portal Web UI

All 18 plan steps are done and ticked in `code-generation-plan.md`.

## Files Created and Modified

### UI (`ui/`)

- **New, app**:
  - `src/config.ts`: runtime `/config.json` loader and validator.
  - `src/auth/session.ts` and `src/auth/authEvents.ts`: tokens and the session-expired channel.
  - `src/api/{types,errors,client}.ts`: all 10 REST endpoints. 401/403 become `AuthError`, `{detail}` becomes `ApiError`, and DynamoDB keys are stripped.
  - `src/lib/validation.ts`.
  - `src/agent/{sse,agentClient}.ts`: direct AgentCore streaming.
  - `src/hooks/useLoader.ts`.
  - `src/components/`: AppLayout, SessionExpiredBanner, ConfigErrorScreen, ConfirmDialog, LoadingIndicator, ErrorMessage, EmptyState.
  - `src/pages/`: EmployeesPage, EmployeeForm, EmployeeDetailPage, LeaveSection, HrRequestsPage, AssistantPage, NotFoundPage.
  - `src/styles/{tokens,global}.css` and `src/theme/amplifyTheme.ts`: green `#006039` and gold `#A37E2C` tokens, serif headings, thin rules, reduced motion.
  - `public/config.example.json`.
- **New, tests**: `src/test/{setup,smoke.test,fixtures}.ts`, `src/api/client.test.ts`, `src/lib/validation.test.ts`, `src/agent/{sse,agentClient}.test.ts`, and `src/pages/*.test.tsx` (6 files).
- **Modified**: `package.json` and `package-lock.json`, `vite.config.ts` (test block), `index.html` (fonts, title), `src/main.tsx`, `src/App.tsx`, `.gitignore` (`public/config.json`), `public/favicon.svg` (an "HR" monogram), `README.md`.
- **Removed (Vite starter)**: `src/App.css`, `src/index.css`, `src/assets/{hero.png,react.svg,vite.svg}`, `public/icons.svg`.

### CDK

- `hr_leave_portal/ui_stack.py` (new): `UiStack`. It creates a private S3 bucket, CloudFront with OAC, HTTPS redirect and SPA fallback, deploys `ui/dist` plus a generated `config.json` with an invalidation, and outputs `UiUrl`.
- `hr_leave_portal/backend_stack.py`: adds the `DEFAULT_4XX` and `DEFAULT_5XX` Gateway Responses with CORS headers. Nothing else changed.
- `hr_leave_portal/agent_runtime_stack.py`: exposes `self.agent_runtime_arn`.
- `app.py`: adds `UiStack(app, "HrLeavePortalUi", ...)`. It depends on Backend and AgentRuntime only.
- `tests/unit/test_ui_stack.py` and `tests/unit/test_backend_gateway_responses.py` (new).

### Packages

- `ui/`: react-router-dom 7.18.5. Dev: vitest 5.1.0, @testing-library/react 16.3.3, user-event 14.6.8, jest-dom 7.0.1, jsdom 31.0.0.
- `.venv`: pytest 8.4.2, from `requirements-dev.txt`.

## Key Implementation Decisions

- **When a reply ends**: the reply finishes on a `messageStop` whose stop reason is not `tool_use`. A tool-use stop comes in the middle of a reply that calls a tool. The stream's `{"error": ...}` events surface as `AgentError` with Retry.
- **Region**: `region` in config.json comes from the user pool id prefix, so it always matches the pool and runtime.
- **Uploads**: the S3 deployment excludes any local `dist/config.json`. Only the stack-generated config ships.
- **Tokens**: the ID token goes to the API and the access token goes to AgentCore. Tokens are never logged.
- **Rolex look-alike**: no Rolex names, logos, imagery or fonts. The wordmark is plain text, "HR LEAVE PORTAL" (FR8.4).

## Test Results (run in this stage)

| Suite | Command | Result |
|---|---|---|
| UI unit (11 files) | `npm --prefix ui test -- <files in unit-test-instructions.md>` | 82/82 passed |
| CDK | `.venv/bin/python -m pytest tests/unit/test_ui_stack.py tests/unit/test_backend_gateway_responses.py` | 12/12 passed |
| Lint | `npm --prefix ui run lint` | 0 errors, 0 warnings |
| Build | `npm --prefix ui run build` | succeeds (Vite advisory: 879 kB JS bundle, 243 kB gzip, mostly Amplify) |
| Synth | all 5 stacks, offline | succeeds; UI depends on Backend and AgentRuntime only |

The pre-existing `tests/unit/test_hr_leave_portal_stack.py` still fails at import, unchanged (constraint C5).

## Tests Written but Not Executed Here

- None of the written tests went unrun. There is no CI in the repository, so nothing was left to CI.
- Not covered by automated tests, needing a deployed stack (Build and Test):
  - A1/OQ1: browser CORS on AgentCore.
  - A2: AgentCore accepting the access token.
  - A real Cognito sign-in.
  - A visual and axe accessibility check.

## Deviations from the Plan

- **Test command**: the UI test command in `unit-test-instructions.md` was corrected from `npm --prefix ui exec -- vitest run ...` to `npm --prefix ui test -- ...`. The first form runs from the repo root and skips `ui/vite.config.ts`, which makes 28 tests fail with `document is not defined`.
- **Synth needs a UI build**: because `app.py` builds every stack, `cdk synth` or `cdk deploy` of any stack now needs `npm run build` in `ui/` first. The UI stack fails fast with that instruction. This is documented in `ui/README.md`.
- **Reply-end rule**: the `messageStop` rule was refined (see Key Implementation Decisions).
- **npm audit**: 10 moderate findings were reported and not auto-fixed.
