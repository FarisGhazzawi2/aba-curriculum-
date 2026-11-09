# Code Generation Plan: HR Leave Portal Web UI

## Summary

- Builds: a React SPA (Cognito sign-in, employees, leave, HR requests, streaming hrAgent chat) with a premium green and gold theme, a CloudFront + S3 CDK stack to host it, and CORS on API Gateway error responses
- Touches: `ui/` (src, config, tests), `hr_leave_portal/ui_stack.py` (new), `hr_leave_portal/backend_stack.py`, `hr_leave_portal/agent_runtime_stack.py`, `app.py`, `tests/unit/test_ui_stack.py` (new)
- Tests: about 15 Vitest unit tests (UI logic and components) plus 2 CDK assertion test files (UI stack, backend Gateway Responses)

## Scope and Inputs

- Requirements: `aidlc/spaces/default/intents/261109-react-ui-agentcore/inception/requirements-analysis/requirements.md` (FR1–FR8, NFR1–NFR10)
- Codebase knowledge: `aidlc/spaces/default/codekb/hr-leave-portal/` (api-documentation.md is the API and agent contract)
- Express scope: zero Units, no design stages. This plan is the design.

## Key Technical Decisions

- **Stack**: keep React 19, TypeScript, Vite and the existing ESLint config. Add `react-router-dom` (routing) and, as dev dependencies, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` and `jsdom`. No UI component library: the theme is custom CSS tokens (FR8.3).
- **Config (FR7.3, FR7.4)**: at startup, `src/config.ts` fetches `/config.json` (`{apiUrl, region, userPoolId, userPoolClientId, agentRuntimeArn}`), validates it, then calls `Amplify.configure`. For local dev, a git-ignored `public/config.json` can be copied from `public/config.example.json`.
- **Auth (FR1)**: `@aws-amplify/ui-react` `Authenticator` with `hideSignUp`, themed with a custom Amplify `ThemeProvider` theme mapped to our tokens. `fetchAuthSession()` supplies `idToken` (sent to the API as `Authorization: <idToken>`) and `accessToken` (sent to AgentCore as `Authorization: Bearer <accessToken>`).
- **API client (FR2–FR4, FR1.5)**: a typed `src/api/client.ts` wrapper around `fetch`. On 401/403 it throws `AuthError`, which shows the "session expired" banner and a re-sign-in action. It maps FastAPI `{detail}` errors to messages and strips `PK/SK/GSI1PK/GSI1SK` (FR2.7).
- **Agent client (FR5)**: `src/agent/agentClient.ts` posts to `https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encodeURIComponent(arn)}/invocations?qualifier=DEFAULT` with headers `Authorization: Bearer`, `Content-Type: application/json`, `Accept: text/event-stream` and `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` (a 36-character `crypto.randomUUID()`, at least 33). The body is `{prompt, actorId: sub}`. It reads `response.body` with a `TextDecoder` and a pure `parseSseChunk` function that pulls `event.contentBlockDelta.delta.text` from each `data:` line. Cancellation uses `AbortController`.
- **A1 check first**: Step 2 asks the person to confirm the direct browser call to AgentCore works (CORS) on the deployed stack. The code does not depend on that answer until deploy. If it is blocked, the fallback is the proxy option, which goes back to the person (requirements OQ1).
- **CDK UI stack (FR7)**: `hr_leave_portal/ui_stack.py` `UiStack(api, user_pool, user_pool_client, agent_runtime_arn)`:
  - a private S3 bucket (`BlockPublicAccess.BLOCK_ALL`, `enforce_ssl`, S3-managed encryption, `RemovalPolicy.DESTROY` + `auto_delete_objects`, matching the project's dev posture);
  - `cloudfront.Distribution` with `S3BucketOrigin.with_origin_access_control`, `REDIRECT_TO_HTTPS`, `default_root_object="index.html"`, and error responses 403/404 → `/index.html` 200;
  - `s3deploy.BucketDeployment` of `ui/dist` plus `Source.json_data("config.json", {...})` from stack references, with `distribution` and `distribution_paths=["/index.html", "/config.json"]`;
  - `CfnOutput` `UiUrl`.
  If `ui/dist` is missing at synth, the stack fails with a clear message saying to run `npm run build` in `ui/` first.
- **Agent ARN wiring (FR7.6)**: `AgentRuntimeStack` exposes `self.agent_runtime_arn` (the existing runtime's ARN attribute). `app.py` passes backend and agent objects into `UiStack`. The dependency runs one way only: UI → Backend and UI → AgentRuntime.
- **Gateway Responses (FR6.1)**: in `backend_stack.py`, `self.api.add_gateway_response` for `DEFAULT_4XX` and `DEFAULT_5XX` with `Access-Control-Allow-Origin: '*'` and `Access-Control-Allow-Headers: 'Content-Type,Authorization'`. Origins stay `*`, per Q6.
- **Design (FR8)**: `src/styles/tokens.css` defines `--color-primary: #006039`, `--color-primary-dark: #00432a`, `--color-gold: #a37e2c`, `--color-bg: #ffffff`, `--color-surface: #f8f6f1`, `--color-text: #1b1b1b`, a serif heading font (Playfair Display via Google Fonts, with a Georgia fallback) and a sans body font (Inter, with a system-ui fallback). It also sets spacing, thin borders, 2 px corners, 300 ms transitions and a `prefers-reduced-motion` override. The header is a full-width green bar with a text wordmark "HR LEAVE PORTAL" in letter-spaced uppercase. No Rolex names, logos, imagery or assets (FR8.4).

## Implementation Steps

- [x] **Step 1: Project structure and dependencies** (FR7.4, NFR8). In `ui/`, run `npm install react-router-dom` and `npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`. Add scripts `test` (`vitest run`) and `test:watch`. Remove the starter content (`App.css`, the counter demo in `App.tsx`, the starter assets in use). Add `public/config.example.json`, and add `ui/public/config.json` to `ui/.gitignore`.
- [x] **Step 2: Test runner readiness**. Add a `test` block to `vite.config.ts` (environment `jsdom`, `setupFiles: ./src/test/setup.ts` importing `@testing-library/jest-dom/vitest`). Verify that `npx vitest run src/test/smoke.test.ts` runs a smoke test that renders text. Verify that the Python runner `python -m pytest tests/unit/test_ui_stack.py` is available (pytest is in `requirements-dev.txt`).
- [x] **Step 3: Design system** (FR8.1–FR8.3, FR8.5, NFR6). Add `src/styles/tokens.css` and `src/styles/global.css` (typography, layout, buttons, forms, tables in overflow containers, focus rings, reduced motion), plus `src/theme/amplifyTheme.ts` for the themed Authenticator. Add the Google Fonts link in `index.html` with a real fallback stack, and set the document title to "HR Leave Portal".
- [x] **Step 4: Runtime config and auth shell** (FR1.1–FR1.5, FR7.4, NFR2, NFR3). Add `src/config.ts` (fetch and validate `/config.json`; on failure show a `ConfigError` screen) and `src/auth/session.ts` (`getIdToken`, `getAccessToken`, `getUserSub` via `fetchAuthSession`). `main.tsx` loads config, configures Amplify, and renders `<Authenticator hideSignUp>` wrapping the app with the themed provider. Add a sign-out button in the header and a `SessionExpiredBanner` driven by an `AuthError` event. Tokens are never logged.
- [x] **Step 5: API client and data types** (FR2.7, FR1.3, FR1.5). Add `src/api/types.ts` (Employee, Leave, TimeOffRequest, HrRequest, using the mixed casing as is) and `src/api/client.ts` (base URL join, ID-token header, JSON handling, `AuthError` on 401/403, `ApiError` with the `{detail}` message, network-error message, key-attribute stripping) with functions for all 10 endpoints in api-documentation.md. Error handling covers every boundary (construction guardrail).
- [x] **Step 6: Data layer tests** (test-after). `src/api/client.test.ts` with fetch mocked: ID token sent as the Authorization header; 401 → `AuthError`; 404 detail → `ApiError("Employee not found")`; key attributes stripped; hire-date query built only with both dates.
- [x] **Step 7: Validation and business logic** (FR2.2, FR2.4, FR3.2, FR4.1, FR4.2, FR4.3). `src/lib/validation.ts` with pure functions: `validateEmployee`, `validateDateRange` (end ≥ start), `validateHireFilter` (both or none, from ≤ to), `validatePrompt` (non-empty), `executionReference(arn)` (short reference from the ARN tail).
- [x] **Step 8: Business logic tests**. `src/lib/validation.test.ts`: valid employee; missing name; end before start rejected; same-day range accepted; filter with one date rejected; reference derived from the ARN.
- [x] **Step 9: Agent client** (FR5.1–FR5.6, NFR5). Add `src/agent/sse.ts` (`parseSseChunk(buffer) → {texts, done, rest}`: handles split lines, `data:` prefix, non-text events, malformed JSON skipped, and `messageStop` → done) and `src/agent/agentClient.ts` (`buildInvocationUrl(region, arn)`, `newSessionId()` of at least 33 chars, `streamAgentReply({prompt, sessionId, onText, signal})` with access-token bearer and `actorId = sub`, raising `AgentError` on non-2xx or a missing body).
- [x] **Step 10: Agent client tests**. `src/agent/sse.test.ts` and `src/agent/agentClient.test.ts`: text deltas extracted in order; an event split across chunks is reassembled; tool and metadata events are ignored; malformed lines are skipped; the URL is encoded with `qualifier=DEFAULT`; the session id is ≥ 33 chars; headers include the bearer token and the session id; non-2xx → `AgentError`.
- [x] **Step 11: Frontend screens** (FR2.1–FR2.7, FR3.1–FR3.4, FR4.1–FR4.4, FR5.1–FR5.7, FR8). Add `react-router-dom` routes inside `AppLayout` (green header, uppercase letter-spaced nav: Employees, HR Requests, Assistant, plus a sign-out control):
  - `/employees` `EmployeesPage`: table, hire-date filter, "New employee";
  - `/employees/new` and `/employees/:id/edit` `EmployeeForm`;
  - `/employees/:id` `EmployeeDetailPage`: details, delete with a `ConfirmDialog` naming the employee, and a leave section with a month filter, an add-leave form and an inline edit of end date and note (start date read-only, no delete);
  - `/requests` `HrRequestsPage`: a time-off form and a question form, each with an employee `<select>` loaded from the list, and a confirmation "Submitted. HR will receive this request by email." plus a reference, with no status shown;
  - `/assistant` `AssistantPage`: a notice that the assistant can change records and send email to HR, a message list with streaming text, input disabled while streaming, Stop, New conversation, and an inline error with Retry that keeps the message;
  - shared `LoadingIndicator`, `ErrorMessage`, `EmptyState`.
  Interactive elements get `data-testid`. Forms have labels, keyboard support and text errors (NFR6).
- [x] **Step 12: Frontend tests**. `src/pages/*.test.tsx` with the API and agent modules mocked:
  - `EmployeesPage` renders rows;
  - `EmployeeForm` blocks an empty name;
  - delete sends nothing on cancel;
  - the leave form blocks end before start;
  - `HrRequestsPage` shows the email confirmation and no status;
  - `AssistantPage` streams text incrementally and disables send while streaming;
  - the `SessionExpiredBanner` appears on `AuthError`;
  - `AppLayout` uses the wordmark and no starter content.
- [x] **Step 13: Backend Gateway Responses** (FR6.1). Edit `hr_leave_portal/backend_stack.py` to add the `DEFAULT_4XX` and `DEFAULT_5XX` gateway responses with CORS headers. Change nothing else in the stack.
- [x] **Step 14: Expose the agent runtime ARN** (FR7.3). Edit `hr_leave_portal/agent_runtime_stack.py` so it sets `self.agent_runtime_arn` from the existing runtime construct. Existing resources and outputs are unchanged.
- [x] **Step 15: CDK UI stack** (FR7.1–FR7.7, NFR1, NFR2, NFR10). Add `hr_leave_portal/ui_stack.py` as described in Key Technical Decisions. Edit `app.py` to instantiate `UiStack(app, "HrLeavePortalUi", api=backend.api, user_pool=backend.user_pool, user_pool_client=backend.user_pool_client, agent_runtime_arn=agent_runtime.agent_runtime_arn)`. This keeps the `AgentRuntimeStack(...)` result in a variable.
- [x] **Step 16: CDK tests** (test-after for the infrastructure layer). Add `tests/unit/test_ui_stack.py`, which uses a temporary `ui/dist` fixture and synthesizes with in-test stand-ins for the backend dependencies. It asserts:
  - the bucket blocks all public access;
  - CloudFront uses OAC and redirect-to-https;
  - 403/404 error responses map to `/index.html`;
  - the BucketDeployment exists with distribution invalidation paths;
  - the `UiUrl` output exists.
  Add `tests/unit/test_backend_gateway_responses.py`, which asserts the `DEFAULT_4XX` and `DEFAULT_5XX` GatewayResponses carry `Access-Control-Allow-Origin`. If an SSM lookup blocks synth, it uses the template from a minimal stack construction with the SSM parameter mocked through context. The pre-existing broken `tests/unit/test_hr_leave_portal_stack.py` is left as is (constraint C5).
- [x] **Step 17: Build and lint configuration** (NFR8). Confirm `npm run lint`, `npm run build` (`tsc -b && vite build`) and `npm test` pass in `ui/`. Fix any type or lint errors in the new code. Do not loosen the ESLint or TS config.
- [x] **Step 18: Documentation**. Replace the boilerplate `ui/README.md` with: what the app is, the HR-staff-only note (NFR4), local dev with `config.json`, the test and build commands, and the deploy order (scripts → `npm run build` in `ui/` → `cdk deploy HrLeavePortalUi`, plus the stacks it depends on). The A1/OQ1 check on the deployed URL is also documented there.

## Requirement → Step Traceability

| Requirement | Steps |
|---|---|
| FR1.1–FR1.5 | 4, 5, 6, 12 |
| FR2.1–FR2.7 | 5, 6, 7, 8, 11, 12 |
| FR3.1–FR3.4 | 5, 7, 8, 11, 12 |
| FR4.1–FR4.4 | 5, 7, 8, 11, 12 |
| FR5.1–FR5.7 | 9, 10, 11, 12 |
| FR6.1 | 13, 16 |
| FR7.1–FR7.7 | 1, 4, 14, 15, 16, 18 |
| FR8.1–FR8.5 | 3, 11, 12 |
| NFR1, NFR2, NFR10 | 15, 16 |
| NFR3 | 4 |
| NFR4 | 11, 18 |
| NFR5 | 9, 11 |
| NFR6 | 3, 11 |
| NFR7 | 17 (Vite default modern browser targets) |
| NFR8 | 17 |
| NFR9 | 2, 6, 8, 10, 12, 16 |

## Files Not Changed

The pre-existing files are kept as they are, apart from the ones listed above. That includes the root `README.md`, `requirements*.txt`, `.gitignore`, `api/`, `hrAgent/`, `state_machines/`, `scripts/` and the broken test `tests/unit/test_hr_leave_portal_stack.py`. `ui/README.md` is replaced (Step 18) because it is untouched Vite boilerplate. `ui/package.json` gains dependencies and scripts (Step 1).

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:c8f84e35190e007d9863fad236154d0269ab9bf633fc2a3ff106ed965ba4a9b9",
  "contract_sha256": "sha256:bb76c1b22f8307be6e5780d50cabab891684449d5b164bd0e825e9e4e5c61e5b"
}
```
