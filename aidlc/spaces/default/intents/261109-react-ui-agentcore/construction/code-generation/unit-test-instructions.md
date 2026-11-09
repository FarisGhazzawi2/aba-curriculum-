# Unit Test Instructions: HR Leave Portal Web UI

Strategy: Minimal (express). At least one requirement-driven test per requirement group, and a happy-path test for every component.

## Test Framework Setup

- **UI**: Vitest with jsdom, React Testing Library, user-event and jest-dom, configured in `ui/vite.config.ts` (`test.environment = "jsdom"`, `test.setupFiles = ["./src/test/setup.ts"]`). Install with `npm install` in `ui/`.
- **CDK**: pytest (from `requirements-dev.txt`) with `aws_cdk.assertions.Template`. Install with `pip install -r requirements.txt -r requirements-dev.txt` in the project venv.

## How to Run This Work's Tests

Each command is scoped to the files this work adds. Run them from the project root.

UI tests (exact files):

```bash
npm --prefix ui test -- src/test/smoke.test.ts src/api/client.test.ts src/lib/validation.test.ts src/agent/sse.test.ts src/agent/agentClient.test.ts src/pages
```

(`npm --prefix ui exec -- vitest ...` runs Vitest from the repo root, which skips `ui/vite.config.ts` and its jsdom setup. Use the `npm --prefix ui test --` form above.)

CDK tests (exact files):

```bash
python -m pytest tests/unit/test_ui_stack.py tests/unit/test_backend_gateway_responses.py
```

The runner-readiness check, run before the first test step (plan Step 2):

```bash
npm --prefix ui test -- src/test/smoke.test.ts
```

Do not run a bare `pytest`. It also collects the pre-existing `tests/unit/test_hr_leave_portal_stack.py`, which fails at import because it references a stack class that doesn't exist. That failure is pre-existing and out of scope (requirements C5).

## Expected Coverage Targets

- No line-coverage floor applies to the express scope, and none is configured. Coverage is requirement-based: every FR group FR1–FR8 has at least one test, as mapped below.
- Required by requirement group:
  - FR1: `client.test.ts` (ID token header, 401 → AuthError) and the session-expired banner page test
  - FR2: client stripping and hire-filter tests, `validation.test.ts`, `EmployeesPage` and `EmployeeForm` tests, the delete-cancel test
  - FR3: the date-range validation test and the leave-form test
  - FR4: the `executionReference` test and the `HrRequestsPage` confirmation test (no status shown)
  - FR5: `sse.test.ts`, `agentClient.test.ts`, and the `AssistantPage` streaming test
  - FR6: `test_backend_gateway_responses.py`
  - FR7: `test_ui_stack.py`
  - FR8: the `AppLayout` wordmark test (no starter content). Visual fidelity is checked by eye at Build and Test.

## Mocking and Stubbing

- `fetch` is stubbed with `vi.stubGlobal("fetch", vi.fn())`, and `ReadableStream` bodies are built from encoded strings to simulate SSE chunks, including an event split across chunks.
- `aws-amplify/auth` `fetchAuthSession` is mocked with `vi.mock` to return fixed fake tokens (strings like `"id-token-test"`), never real credentials.
- Page tests mock `src/api/client` and `src/agent/agentClient` modules.
- CDK tests create a temporary `ui/dist` with an `index.html` via pytest's `tmp_path`, passed to the stack through context or a constructor argument. The backend dependencies are constructed in-test (stand-in RestApi, UserPool, client, and a literal ARN string). The SSM layer lookup is not needed for the UI stack test. The gateway-response test synthesizes `BackendStack` and asserts on `AWS::ApiGateway::GatewayResponse`.

## Test Data

Inline fixtures in each test file include sample employees (`{employeeId: "a1b2c3d4", name: "Ada Lovelace", department: "Engineering", startDate: "2024-01-15", role: "employee", PK: "USER", SK: "a1b2c3d4"}`), leave items, and an execution ARN `arn:aws:states:us-east-1:111111111111:execution:HrStateMachine:abc-123`. No real AWS resources or network calls are used.
