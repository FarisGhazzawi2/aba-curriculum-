# Build and Test Summary: HR Leave Portal Web UI

## Overall Status

- **Build**: SUCCESS. `npm --prefix ui run build` exits 0, and lint reports 0 errors.
- **Tests**: 94 of 94 new tests pass (82 UI in jsdom, 12 CDK).
- **Pre-existing suite**: the one existing test file fails at import, and it already did at HEAD. There is no regression.
- **Prerequisites**: see `build-instructions.md`. A UI build is now required before any `cdk synth` or `cdk deploy`.

## Test Type Inventory

- Unit tests (Minimal strategy): written in Code Generation and run here.
- No integration, performance or security instruction files: the Minimal strategy generates none.
- CDK assertion tests for the UI stack and the backend Gateway Responses.

## Coverage Expectations

- The express scope has no line-coverage floor, and none is configured.
- Requirement coverage is 50 of 50 IDs (see `cross-unit-traceability.md`).
- There is one zero-Unit iteration, so no per-Unit expectations apply.

## Target Verification Matrix

Sources inventoried: the `## Testing Contract` in `construction/code-generation/code-generation-plan.md`. There are no `nfr-requirements/` or `nfr-design/` artifacts, because the express scope skips those stages. The contract has no CI obligation, and CI Pipeline is SKIP in this plan.

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-STRAT-1 | Testing Contract, obligations.strategy_volume[0] | One verifiable test per requirement at the narrowest effective level | Every FR group FR1–FR8 has at least one unit or CDK test (mapping in unit-test-instructions.md). 94 tests pass. | `test-results.md`, Unit Tests (jsdom and pytest) | build-and-test | Met |
| TC-STRAT-2 | Testing Contract, obligations.strategy_volume[1] | At least one happy-path unit test per component | The API client, validation, SSE, agent client, 6 pages/layout and the UI stack all have passing happy-path tests | `test-results.md` | build-and-test | Met |
| TC-STRAT-3 | Testing Contract, obligations.strategy_volume[2] | Unit tests are the default level | All new tests are unit or CDK-assertion level | `test-results.md` | build-and-test | Met |
| TC-FLOOR-1 | Testing Contract, obligations.scope_floor[0] | Keep the existing test suite green (no regressions) | The only existing test, `tests/unit/test_hr_leave_portal_stack.py`, fails at collection with the same `ModuleNotFoundError` as at HEAD (it imports a module that never existed). No new failures. | `test-results.md`, Pre-existing Suite. `git ls-tree HEAD hr_leave_portal/` has no `hr_leave_portal_stack.py`. | build-and-test | Met (no regression; pre-existing failure noted) |
| TC-CI | Testing Contract (no CI line); state: ci-pipeline SKIP | n/a | n/a | the plan runs no CI Pipeline | n/a | N/A |

## Readiness Assessment

- **Build-ready**: yes.
- **Test-ready**: yes, all scoped commands pass.
- **Deployment-ready**: yes, with conditions. The code synthesizes and the tests pass, but these assumptions can only be checked on a deployed stack (Deployment Execution):
  - A1: browser CORS on AgentCore direct calls.
  - A2: which token type each endpoint accepts.
  - A real sign-in, plus a visual and axe check in a real browser.

## Known Limitations and Outstanding Items

- All UI behavior was checked in jsdom (Node), not a real browser engine.
- If AgentCore blocks browser CORS (A1), the assistant needs the streaming-proxy fallback. That goes back to the person.
- The bundle is about 879 kB. Code-splitting Amplify is a possible follow-up.
- `npm audit` reports 10 moderate findings, which were not auto-fixed.
- The pre-existing broken test `test_hr_leave_portal_stack.py` is out of scope (C5). It could be deleted or rewritten in a follow-up.
