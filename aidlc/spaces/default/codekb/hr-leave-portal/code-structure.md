# Code Structure - hr-leave-portal

## Layout

```
app.py                     CDK app entry: wires the four stacks
cdk.json                   CDK config + feature flags
pyproject.toml, uv.lock    root Python project (uv), Python >= 3.14
requirements*.txt          legacy pip manifests from `cdk init`
api/                       Lambda asset (FastAPI); asset root = api/, so imports are top-level
  handler.py               FastAPI app, CORS middleware, Mangum `lambda_handler`
  models.py                Pydantic request models
  controllers/             APIRouters: employee, leave, hr_request
  services/                boto3 data access / Step Functions start
hr_leave_portal/           CDK stacks
  backend_stack.py         DynamoDB, Lambda, API Gateway, Cognito
  notification_stack.py    SNS topic + email subscription
  state_machine_stack.py   Step Functions (loads state_machines/*.json)
  agent_runtime_stack.py   AgentCore Runtime + IAM
state_machines/            ASL (JSONata) definition
scripts/                   build_layer.sh, build_and_push_agent.sh
hrAgent/                   AgentCore CLI project
  agentcore/               agentcore.json (runtime + memory spec), aws-targets.json
  app/agent/               container app: main.py, parse.py, model/, memory/, tools/, Dockerfile
ui/                        Vite + React 19 + TS starter (App.tsx is the template)
tests/unit/                one stale CDK assertion test
src/hr_leave_portal/       `uv init` leftover (unused)
```

## File Classification

| Category | Files |
|---|---|
| Controller/Handler | `api/handler.py`, `api/controllers/*.py`, `hrAgent/app/agent/main.py` (`invoke` entrypoint) |
| Model/Entity | `api/models.py` |
| Service/Repository | `api/services/*.py` (repository-style DynamoDB access + Step Functions start), `hrAgent/app/agent/tools/*.py` (agent tools doubling as data access) |
| Utility/Helper | `hrAgent/app/agent/parse.py`, `hrAgent/app/agent/model/load.py`, `hrAgent/app/agent/memory/session.py` |
| Configuration / IaC | `app.py`, `hr_leave_portal/*.py`, `state_machines/*.json`, `cdk.json`, `hrAgent/agentcore/*.json`, Dockerfile, `ui/*.config.*`, `ui/tsconfig*.json` |
| Build scripts | `scripts/*.sh` |
| Test | `tests/unit/test_hr_leave_portal_stack.py` |
| Static/Asset | `ui/src/*.css`, `ui/src/assets/`, `ui/public/`, `ui/index.html` |

## Code Patterns

- **Controller -> service layering** in `api/`: routers validate with Pydantic and FastAPI path/query types, services call boto3. Services create module-level clients and read env vars at import (`TABLE_NAME`, `HR_STATE_MACHINE_ARN`), so import fails fast when unset.
- **Single-table DynamoDB** with prefixed constant partition keys (`USER`, `USER_BY_DATE`).
- **Agent tools as plain functions** decorated with `@tool`; docstrings are the tool descriptions.
- **Per-session agent cache** (`lru_cache(maxsize=128)` on `_get_agent(session_id, actor_id)`).
- **CDK object passing** between stacks; build outputs handed over through SSM parameters.
- **No shared code** between `api/` and `hrAgent/`; the same key schema is implemented twice (see `dependencies.md`).

## Naming

Python files and functions are snake_case; DynamoDB attributes and API JSON fields are camelCase (`employeeId`, `startDate`), except the HR-request models, which use snake_case (`user_id`, `start_date`). A UI must handle both conventions.
