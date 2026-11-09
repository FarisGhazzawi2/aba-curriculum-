# Code Quality Assessment - hr-leave-portal

## Summary Ratings

| Aspect | Rating | Notes |
|---|---|---|
| Naming clarity | good | Small, clearly named modules and functions |
| Function size | good | All functions well under 30 lines |
| Error handling | fair | Pydantic/FastAPI validation at the edge; boto3 errors surface as 500; agent `parse.py` validates payload shape |
| Test presence | poor | One broken test; nothing for API, agent or UI |
| Duplication | fair | DynamoDB access duplicated between `api/services/` and agent tools |
| Dead code | fair | `src/hr_leave_portal/`, stale test, boilerplate READMEs, UI starter content |

## Testing

- `tests/unit/test_hr_leave_portal_stack.py` imports `hr_leave_portal.hr_leave_portal_stack`, which does not exist, so `pytest` fails at collection. No coverage configuration.
- No tests for `api/`, `hrAgent/`, or `ui/` (no Vitest/Jest setup in `ui/package.json`).

## Linting and Formatting

- UI: ESLint flat config (`ui/eslint.config.js`) with typescript-eslint, react-hooks, react-refresh; strict TS compiler flags (`noUnusedLocals`, `erasableSyntaxOnly`, ...). No Prettier config.
- Python: no Ruff/Black/mypy configuration.

## CI/CD

None. Deployment is manual: run the two scripts, then `cdk deploy` (as `scripts/build_and_push_agent.sh` suggests).

## Documentation

Root `README.md` and `ui/README.md` are generator boilerplate (the root one describes an SQS/SNS sample that no longer exists). `hrAgent/app/agent/README.md` documents the payload accurately. Agent tool docstrings are good; API code is sparsely commented.

## Security Findings

- **No authorization model**: any authenticated Cognito user may read, change or delete any employee or leave record via the API or the agent; `user_id` (API) and `actorId` (agent) come from the request body, not the token.
- **Agent acts with its own role**: tools run with the runtime role's DynamoDB read/write and SNS publish, regardless of the caller.
- **Broad IAM**: `bedrock:InvokeModel` on `*` (agent and state machine roles); `ecr:GetAuthorizationToken` on `*` is expected.
- **Open CORS** (`*`) on API Gateway preflight and FastAPI.
- **Hard-coded values**: HR email address (`notification_stack.py`, marked TODO), AWS account id in `hrAgent/agentcore/aws-targets.json`; no secrets found in tracked files.
- **Data retention**: `HrTable` and `HrUserPool` use `RemovalPolicy.DESTROY`.

## Technical Debt

1. HR-request results unobservable (202 + `executionArn` only; no status endpoint, nothing persisted).
2. API Gateway authorizer errors lack CORS headers.
3. AgentCore Memory declared in `agentcore.json` but not provisioned by CDK.
4. No DynamoDB pagination (`LastEvaluatedKey` ignored) in API services and agent tools.
5. Possible key collision: an employee id equal to `USER` would mix leave items into the employee partition (ids are random hex, so unlikely).
6. Responses leak DynamoDB key attributes (`PK`, `SK`, `GSI1PK`, `GSI1SK`).
7. Mixed naming in JSON (camelCase vs snake_case for HR requests).
8. Stale comments in `email_tools.py` referring to "Sonnet 5".
9. Line-ending churn: most tracked files appear modified only by CRLF/LF differences.
10. Two Python manifests (`requirements.txt` vs `pyproject.toml`).
