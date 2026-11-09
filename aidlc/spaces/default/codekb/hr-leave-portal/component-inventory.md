# Component Inventory - hr-leave-portal

## API Lambda (FastAPI)

- **Location**: `api/`
- **Responsibility**: REST endpoints for employees, leave and HR requests (see `api-documentation.md`).
- **Depends on**: DynamoDB `HrTable` (`TABLE_NAME`), Step Functions (`HR_STATE_MACHINE_ARN`), FastAPI layer from `scripts/build_layer.sh`.
- **Deployed by**: BackendStack (`ApiFunction`, Python 3.14, 512 MB, 10 s).

## BackendStack

- **Location**: `hr_leave_portal/backend_stack.py` (stack `HrLeavePortalBackend`)
- **Responsibility**: `HrTable` (+ `GSI1`, destroy on delete), `ApiFunction`, `HrApi` (LambdaRestApi, Cognito authorizer, open CORS preflight), `HrUserPool` (email sign-in, no self sign-up), `HrUserPoolClient` (USER_PASSWORD, USER_SRP).
- **Exposes**: attributes `table`, `api_function`, `api`, `user_pool`, `user_pool_client`; outputs `ApiUrl`, `TableName`, `UserPoolId`, `UserPoolClientId`.
- **Depends on**: SSM `/hr-leave-portal/fastapi-layer-arn`; receives env var + policy from StateMachineStack.

## NotificationStack

- **Location**: `hr_leave_portal/notification_stack.py` (stack `HrLeavePortalNotifications`)
- **Responsibility**: SNS `HrEmailTopic` with a hard-coded email subscription. Output `HrEmailTopicArn`.

## StateMachineStack

- **Location**: `hr_leave_portal/state_machine_stack.py` (stack `HrLeavePortalStateMachine`)
- **Responsibility**: `CfnStateMachine` from the JSON definition, IAM role (Bedrock InvokeModel `*`, SNS publish, PutMetricData); injects `HR_STATE_MACHINE_ARN` and `states:StartExecution` into `ApiFunction`. Output `HrStateMachineArn`.

## HR State Machine

- **Location**: `state_machines/hr_state_machine_definition.json`
- **Responsibility**: route by `hr_request_type`; TimeOff -> templated email; otherwise Bedrock `us.amazon.nova-2-lite-v1:0` (200 max tokens) -> email; then CloudWatch metric.

## AgentRuntimeStack

- **Location**: `hr_leave_portal/agent_runtime_stack.py` (stack `HrLeavePortalAgentRuntime`)
- **Responsibility**: AgentCore `Runtime` `hrAgent` from the ECR image in SSM `/hr-leave-portal/agent-image-uri`; Cognito JWT authorizer on the backend pool/client; env `TABLE_NAME`, `HR_EMAIL_TOPIC_ARN`; IAM for DynamoDB, SNS, Bedrock, ECR pull. Output `AgentRuntimeArn`. Does not create AgentCore Memory.

## HR Agent (Strands on AgentCore)

- **Location**: `hrAgent/app/agent/` (+ `hrAgent/agentcore/` CLI config)
- **Responsibility**: `invoke` streaming entrypoint, payload parsing, Strands Agent with Claude Sonnet 4.6, ten tools, optional AgentCore Memory session manager (active only when `MEMORY_AGENTMEMORY_ID` is set).
- **Depends on**: DynamoDB, SNS, Bedrock; container built by `scripts/build_and_push_agent.sh` (linux/arm64).

## Build Scripts

- **Location**: `scripts/`
- **Responsibility**: `build_layer.sh` builds and publishes the FastAPI/pydantic/mangum/powertools layer (py3.14, x86_64) and writes its ARN to SSM; `build_and_push_agent.sh` builds/pushes the agent image to ECR `hr-agent` (finch by default) and writes its URI to SSM.

## React UI Scaffold

- **Location**: `ui/`
- **Responsibility**: none yet - unmodified Vite React-TS starter (counter demo). `aws-amplify` 6.22.2 and `@aws-amplify/ui-react` 6.15.7 are installed but not imported. No env config, router, API client or hosting stack.

## CDK Unit Tests

- **Location**: `tests/unit/test_hr_leave_portal_stack.py`
- **Responsibility**: intended stack assertions; currently imports a non-existent `HrLeavePortalStack` and tests an SQS queue that no stack creates, so it cannot pass.
