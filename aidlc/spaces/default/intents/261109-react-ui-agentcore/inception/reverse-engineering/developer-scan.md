# Developer Code Scan - hr-leave-portal

Repo: `hr-leave-portal` (unrecorded project-root repo). Breadth: full rescan of `./`. Head commit `3e968145993fc50c7e6fd64b1919bbc1b1f6443d`, scanned as the working tree stands. Depth: Minimal.

## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - `app.py`, `cdk.json`, `pyproject.toml`, `requirements.txt`, `requirements-dev.txt`, `.python-version`, `README.md`, `.gitignore` (project part)
  - `api/` (handler, models, controllers/, services/)
  - `hr_leave_portal/` (backend, notification, state machine, agent runtime stacks)
  - `state_machines/hr_state_machine_definition.json`
  - `scripts/` (`build_layer.sh`, `build_and_push_agent.sh`)
  - `hrAgent/` (`agentcore/agentcore.json`, `agentcore/aws-targets.json`, `.gitignore`; `app/agent/` main.py, parse.py, memory/, model/, tools/, Dockerfile, pyproject.toml, README.md, `.dockerignore`, `.gitignore`)
  - `ui/` (package.json, vite/tsconfig/eslint configs, index.html, `src/App.tsx`, `src/main.tsx`, README.md, `.gitignore`)
  - `tests/unit/test_hr_leave_portal_stack.py`
  - `src/hr_leave_portal/__init__.py`, `source.bat`
- **Skimmed only**:
  - `ui/src/*.css`, `ui/src/assets/`, `ui/public/` (Vite starter styles and images; line counts and names only)
  - `uv.lock`, `hrAgent/app/agent/uv.lock`, `ui/package-lock.json` (version lookups only)
  - Working-tree diff: `git diff -w` shows the modified Python/JSON/shell files differ from HEAD only by line endings; the real content changes are `ui/package.json` + lock (Amplify deps added) and the AI-DLC block in `.gitignore`.
- **Left out**:
  - `.venv/`, `hrAgent/app/agent/.venv/` (virtualenvs)
  - `ui/node_modules/` (dependencies)
  - `cdk.out/` (CDK synth output, gitignored)
  - `__pycache__/` folders (bytecode caches)
  - `hrAgent/agentcore/.cli/` and `hrAgent/agentcore/.env.local` (gitignored CLI state and local secrets)
  - `.claude/`, `.kiro/`, `aidlc/`, `AGENTS.md` (AI-DLC install; `AGENTS.md` is entirely the AI-DLC marked block)

### Packages Found
- `hr-leave-portal` (root) - CDK app - Python 3.14 - deploys four stacks (`app.py`)
- `api/` - Lambda asset - Python - FastAPI REST API behind API Gateway via Mangum
- `hr_leave_portal/` - CDK stacks package - Python - Backend, Notification, StateMachine, AgentRuntime stacks
- `hrAgent/app/agent` (`agent`) - container app - Python 3.12 image - Strands HR agent on Bedrock AgentCore Runtime
- `ui/` (`ui`) - Vite SPA - TypeScript/React 19 - still the Vite starter template plus Amplify deps
- `src/hr_leave_portal/` - `uv init` leftover - Python - prints hello; unused

### Build System
- **Type**: uv (Python, root + agent), CDK CLI (`python3 app.py`), npm + Vite (ui), Docker/finch (agent image)
- **Config Files**: `pyproject.toml`, `uv.lock`, `requirements*.txt`, `cdk.json`, `hrAgent/app/agent/pyproject.toml`, `hrAgent/app/agent/Dockerfile`, `ui/package.json`, `ui/vite.config.ts`, `ui/tsconfig*.json`
- **Build Dependencies**: `scripts/build_layer.sh` -> SSM `/hr-leave-portal/fastapi-layer-arn` -> `BackendStack`; `scripts/build_and_push_agent.sh` -> ECR `hr-agent` + SSM `/hr-leave-portal/agent-image-uri` -> `AgentRuntimeStack`; `app.py`: Notification -> StateMachine(topic, api_function); Backend -> StateMachine (env var + policy back-reference); Backend + Notification -> AgentRuntime

### APIs Discovered
- REST (FastAPI via API Gateway `LambdaRestApi`, Cognito authorizer) - `api/controllers/` - 10 operations (employees x5, leave x3, hr-requests x2)
- AgentCore Runtime HTTP invocation (`/invocations`, SSE stream) - `hrAgent/app/agent/main.py` - 1 entrypoint, 10 agent tools
- Step Functions state machine input contract - `state_machines/hr_state_machine_definition.json` - 2 request types

### Frameworks & Libraries
- aws-cdk-lib - 2.275.0 - IaC (incl. L2 `aws_bedrockagentcore`)
- constructs - 10.8.1 - CDK constructs
- fastapi - 0.162.0 - REST API
- pydantic - 2.14.1 - request models
- mangum - 0.22.0 - ASGI-to-Lambda adapter (Lambda layer)
- boto3 - 1.43.121 (root) / 1.43.124 (agent) - AWS SDK
- strands-agents - 1.64.0 - agent framework
- bedrock-agentcore - 1.25.3 - AgentCore runtime app + memory integration
- aws-opentelemetry-distro - 0.21.0 - agent tracing
- react / react-dom - 19.3.1 - UI
- aws-amplify - 6.22.2; @aws-amplify/ui-react - 6.15.7 - added to ui deps, not yet imported
- vite - 8.3.6; typescript - 6.0.3; eslint - 10.14.0 - UI tooling

### Test Coverage
- **Test Directories**: `tests/unit/`
- **Test Frameworks**: pytest 8.4.2 + `aws_cdk.assertions`
- **Coverage Config**: absent. The only test imports `hr_leave_portal.hr_leave_portal_stack.HrLeavePortalStack`, which does not exist (CDK init leftover asserting an SQS queue); it fails at import. No tests for `api/`, `hrAgent/`, or `ui/`.

### Code Quality Indicators
- **Linting**: ESLint flat config in `ui/eslint.config.js`; no Python linter/formatter config
- **CI/CD**: none (no pipeline files)
- **Documentation**: root `README.md` is the CDK init boilerplate; `hrAgent/app/agent/README.md` documents the payload; `ui/README.md` is the Vite boilerplate. Agent tools carry good docstrings; API code has few.

### Technical Debt Signals
- No per-user authorization: any Cognito user can CRUD any employee/leave (`api/controllers/*.py`); `user_id` and `actorId` are caller-supplied, never taken from the token
- HR-request outcomes are unobservable through the API: `POST /hr-requests*` returns only `executionArn` (`api/services/hr_request_service.py:24,39`); results go to an SNS email
- API Gateway 4XX/5XX gateway responses carry no CORS headers (`hr_leave_portal/backend_stack.py:87-99`), so a browser sees 401s as CORS errors
- AgentCore Memory declared in `hrAgent/agentcore/agentcore.json` but not created by `AgentRuntimeStack`, and `MEMORY_AGENTMEMORY_ID` is not set, so memory is disabled in the CDK deployment
- Hard-coded HR email (`hr_leave_portal/notification_stack.py:9`, TODO) and AWS account id (`hrAgent/agentcore/aws-targets.json`)
- Duplicated DynamoDB access code between `api/services/` and `hrAgent/app/agent/tools/`
- DynamoDB queries without pagination (`employee_service.list_all`, `leave_service.list_for_employee`)
- Key collision risk: employees under `PK="USER"`, leave under `PK=<employeeId>`
- Broken stale test; boilerplate READMEs; unused `src/hr_leave_portal/`; `requirements.txt` vs `pyproject.toml` drift
- Stale comment about "Sonnet 5" in `hrAgent/app/agent/tools/email_tools.py:7,47`
- IAM `bedrock:InvokeModel` on `*` in agent and state machine roles
- Mixed line endings: most tracked files show as modified only because of CRLF/LF changes

## Handoff Summary
- **Intent-relevant finding**: The backend already exposes everything a SPA needs to authenticate: `BackendStack` creates a Cognito user pool (email sign-in, no self sign-up) and an app client with `USER_PASSWORD` + `USER_SRP` flows, and outputs `ApiUrl`, `UserPoolId`, `UserPoolClientId` (`hr_leave_portal/backend_stack.py:70-106`). The AgentCore runtime uses a Cognito JWT inbound authorizer on the same pool/client (`hr_leave_portal/agent_runtime_stack.py:36-46`) and outputs only `AgentRuntimeArn`. The `ui/` scaffold is still the Vite starter (`ui/src/App.tsx`) with `aws-amplify` added but unused.
- **Risks / follow-up**: (1) Token type differs - the API Gateway Cognito authorizer expects the ID token; the AgentCore Cognito authorizer validates `client_id` against allowed clients, which is an access-token claim, so the UI likely needs to send different tokens to each (verify). (2) Browser CORS on the AgentCore data-plane endpoint is unverified; a proxy (Lambda/API route) may be needed. (3) No per-user authorization or role model exists on API or agent. (4) The agent streams raw Strands/Bedrock ConverseStream events as SSE; session continuity needs the `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` header (min 33 chars). (5) HR-request results are not retrievable via the API. (6) No stack output or SSM parameter exposes the region; the UI stack must take `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `AgentRuntimeArn` as cross-stack inputs. (7) The Cognito client has no hosted-UI domain and default OAuth callback URLs; a CloudFront origin is not registered anywhere.
