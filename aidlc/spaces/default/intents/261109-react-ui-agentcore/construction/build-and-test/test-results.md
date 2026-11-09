# Test Results: HR Leave Portal Web UI

Run date: 2026-11-09. Environment: local WSL2 (Linux), Node via npm, Python `.venv`. All test runs are in Node with jsdom (UI) or in-process CDK synth (Python). No real browser engine was used, and nothing was deployed.

## Build

| Command | Exit | Result |
|---|---|---|
| `npm --prefix ui run build` | 0 | Success. Vite advisory: one chunk over 500 kB (about 879 kB, 243 kB gzip) |
| `npm --prefix ui run lint` | 0 | 0 errors, 0 warnings |

## Unit Tests

| Command | Exit | Total | Passed | Failed | Skipped |
|---|---|---|---|---|---|
| `npm --prefix ui test -- src/test/smoke.test.ts src/api/client.test.ts src/lib/validation.test.ts src/agent/sse.test.ts src/agent/agentClient.test.ts src/pages` | 0 | 82 (11 files) | 82 | 0 | 0 |
| `.venv/bin/python -m pytest tests/unit/test_ui_stack.py tests/unit/test_backend_gateway_responses.py` | 0 | 12 | 12 | 0 | 0 |

The CDK tests check:
- the bucket blocks public access and requires TLS;
- CloudFront reads the bucket through OAC only and redirects HTTP to HTTPS;
- 403/404 fall back to `/index.html`;
- the deployment ships the build plus `config.json` and invalidates the cache;
- `config.json` holds only public identifiers;
- the `UiUrl` output exists;
- synth fails with instructions when the UI isn't built;
- the 4XX/5XX Gateway Responses carry CORS headers;
- only those two Gateway Responses were added;
- the API methods still use the Cognito authorizer.

## Pre-existing Suite

| Command | Exit | Result |
|---|---|---|
| `.venv/bin/python -m pytest tests/unit/test_hr_leave_portal_stack.py` | 2 | Collection error: `ModuleNotFoundError: No module named 'hr_leave_portal.hr_leave_portal_stack'` |

This failure predates this work. At HEAD (`3e96814`), `hr_leave_portal/` contains no `hr_leave_portal_stack.py`, so the test could not import before any change here. This work did not change it (requirements constraint C5). There is no new failure.

## Coverage

The express scope has no coverage floor and none is configured, so no coverage report was produced. Coverage is requirement-based: every FR and NFR ID has an implementing file, and every FR group has at least one test. See `cross-unit-traceability.md`.

## Where Browser Behavior Was Checked

The UI behaviors were checked in jsdom (Node), not in a real browser. These are integration-level checks:
- the streaming chat rendering (FR5.4/5.5);
- the session-expired banner (FR1.5);
- the form validation;
- the page rendering.

Native browser behavior, real CORS and real Cognito sign-in were not exercised.

## Not Verified Here (needs a deployed stack)

- A1/OQ1: whether the browser can call the AgentCore data plane directly (CORS).
- A2: whether AgentCore accepts the Cognito access token, and API Gateway the ID token, against real tokens.
- A real sign-in, the CloudFront SPA fallback in a live distribution, the visual look and an axe accessibility scan in a real browser.

These go to Deployment Execution. Steps are in `ui/README.md`.
