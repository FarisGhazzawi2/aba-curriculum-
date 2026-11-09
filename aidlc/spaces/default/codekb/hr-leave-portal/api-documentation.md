# API Documentation - hr-leave-portal

## 1. HR REST API (API Gateway `HrApi` -> FastAPI)

- **Base URL**: CloudFormation output `HrLeavePortalBackend.ApiUrl` (`https://<id>.execute-api.<region>.amazonaws.com/prod/`).
- **Auth**: every method uses the Cognito user pools authorizer `HrAuthorizer`; send `Authorization: <Cognito ID token>` (with no OAuth scopes configured, the authorizer expects the ID token). OPTIONS preflight methods are unauthenticated.
- **Authorization**: none beyond a valid token. Any signed-in user may call any endpoint for any employee.
- **CORS**: preflight allows all origins/methods (API Gateway); actual responses get `Access-Control-Allow-Origin: *` from FastAPI's `CORSMiddleware`. Authorizer rejections (401/403) and gateway 5XX have no CORS headers, so browsers report them as CORS failures.
- **Errors**: FastAPI defaults - `{"detail": ...}`; 422 for validation; 404 only on `GET /employees/{id}`. Unhandled boto3 errors become 500. No pagination, rate limiting or request ids.

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/employees` | body `EmployeeIn` | 201 employee item (incl. `PK`, `SK`, `GSI1PK`, `GSI1SK`, `employeeId`, ...) |
| GET | `/employees` | query `hiredFrom`, `hiredTo` (dates; both required to filter) | 200 `{"employees": [...]}` |
| GET | `/employees/{employee_id}` | - | 200 item, 404 `{"detail": "Employee not found"}` |
| PUT | `/employees/{employee_id}` | body `EmployeeIn` | 200 item (create or replace) |
| DELETE | `/employees/{employee_id}` | - | 200 `{"deleted": id}` (also when absent) |
| POST | `/employees/{employee_id}/leave` | body `LeaveIn` | 201 leave item |
| GET | `/employees/{employee_id}/leave` | query `month` (`^\d{4}-\d{2}$`, optional) | 200 `{"leave": [...]}` |
| PUT | `/employees/{employee_id}/leave/{start_date}` | body `LeaveUpdate` | 200 leave item (upsert) |
| POST | `/hr-requests/time-off` | body `TimeOffRequestIn` | 202 `{"executionArn": ...}` |
| POST | `/hr-requests` | body `HrRequestIn` | 202 `{"executionArn": ...}` |

No DELETE for leave; no endpoint returns HR-request status or results.

### Request models (`api/models.py`)

| Model | Fields |
|---|---|
| `EmployeeIn` | `name: str`, `department: str`, `startDate: date`, `role: str = "employee"` |
| `LeaveIn` | `startDate: date`, `endDate: date`, `note: str = ""` |
| `LeaveUpdate` | `endDate: date`, `note: str = ""` |
| `TimeOffRequestIn` | `user_id: str`, `start_date: date`, `end_date: date` |
| `HrRequestIn` | `user_id: str`, `prompt: str` |

Responses return raw DynamoDB items, including key attributes. No end-date-after-start-date validation.

## 2. hrAgent invocation API (AgentCore Runtime)

- **Identifier**: output `HrLeavePortalAgentRuntime.AgentRuntimeArn`; runtime name `hrAgent`, protocol HTTP.
- **Endpoint (AgentCore data plane)**: `POST https://bedrock-agentcore.<region>.amazonaws.com/runtimes/<URL-encoded runtime ARN>/invocations?qualifier=DEFAULT`.
- **Auth**: inbound JWT authorizer from `RuntimeAuthorizerConfiguration.using_cognito(user_pool, [user_pool_client])`: `Authorization: Bearer <token>` issued by `HrUserPool` for `HrUserPoolClient`. The allowed-client check matches the access token's `client_id` claim, so use the access token (to be confirmed in design). With a JWT authorizer, SigV4 callers are not accepted.
- **Session**: header `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` (AgentCore requires at least 33 characters); reuse it to continue a conversation. Missing -> agent uses `"default-session"` key.
- **Body** (`parse.py`): `{"prompt": string}` or `{"messages": [{role, content:[...]}]}` (takes precedence; trailing `toolUse` blocks stripped), optional `"actorId": string` (default `"default"`). Invalid shapes raise `ValueError`.
- **Response**: streamed `text/event-stream`. Each `data:` line is a Strands raw event `{"event": {...}}` carrying Bedrock ConverseStream parts (`messageStart`, `contentBlockStart` with a `start`, `contentBlockDelta` with `delta.text` or `delta.toolUse`, `contentBlockStop`, `messageStop`, `metadata`). The UI renders `contentBlockDelta.delta.text`.
- **Browser CORS**: not configured in this repo, and support on the AgentCore data plane is unverified; treat a direct browser call as an open question.

### Agent tools (`hrAgent/app/agent/tools/`)

| Tool | Effect |
|---|---|
| `create_employee`, `save_employee`, `get_employee`, `list_employees`, `list_employees_by_hire_date`, `delete_employee` | Same DynamoDB items as the REST API |
| `save_leave`, `list_leave` | Same leave items as the REST API |
| `generate_leave_email` | Bedrock InvokeModel (Claude Sonnet 4.6) to draft text |
| `send_email_to_hr` | SNS publish to `HR_EMAIL_TOPIC_ARN` |

## 3. Internal contract: HR state machine input

`{"hr_request_type": "TimeOff", "user_id", "start_date", "end_date"}` or `{"hr_request_type": "BenefitsInquiry", "user_id", "prompt"}`. Output is a side effect only (SNS email, metric `HR/HrRequests` with dimensions `hr_request_type`, `user_id`).
