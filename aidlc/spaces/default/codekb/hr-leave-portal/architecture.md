# Architecture - hr-leave-portal

## Architecture Analysis

### System Overview

A serverless AWS application defined in one Python CDK app (`app.py`) with four stacks:

- **HrLeavePortalNotifications** - SNS topic `HrEmailTopic` with one email subscription.
- **HrLeavePortalBackend** - DynamoDB single table `HrTable` (PK/SK + `GSI1`), the FastAPI Lambda `ApiFunction`, API Gateway REST API `HrApi` (Lambda proxy, Cognito authorizer on every method), Cognito `HrUserPool` + `HrUserPoolClient`.
- **HrLeavePortalStateMachine** - Step Functions state machine (JSONata) that routes HR requests to an SNS email (time off) or to Bedrock InvokeModel then SNS (other requests), then emits a CloudWatch metric.
- **HrLeavePortalAgentRuntime** - Bedrock AgentCore Runtime `hrAgent` running the Strands agent container (image URI from SSM), HTTP protocol, Cognito JWT inbound authorizer bound to the backend user pool and client.

A React/Vite SPA exists only as a starter scaffold in `ui/`; no stack hosts it.

### Architectural Style

Serverless, event-assisted. Evidence: Lambda + API Gateway for synchronous CRUD, Step Functions + SNS for asynchronous HR requests, a managed container runtime (AgentCore) for the agent, DynamoDB on-demand. Two independent compute paths (API Lambda and agent) share the same table directly; there is no shared domain library.

### Component Relationships

```mermaid
flowchart LR
    Browser["Browser (ui/ - not built)"]
    Cognito["Cognito HrUserPool + HrUserPoolClient"]
    APIGW["API Gateway HrApi (Cognito authorizer)"]
    Lambda["ApiFunction (FastAPI + Mangum)"]
    DDB[("DynamoDB HrTable + GSI1")]
    SFN["Step Functions HrStateMachine"]
    Nova["Bedrock Nova 2 Lite"]
    SNS["SNS HrEmailTopic"]
    CW["CloudWatch metric HR/HrRequests"]
    Agent["AgentCore Runtime hrAgent (Strands)"]
    Sonnet["Bedrock Claude Sonnet 4.6"]
    Mail["HR mailbox"]

    Browser -->|sign in| Cognito
    Browser -->|Bearer ID token| APIGW
    Browser -.->|Bearer JWT, not wired yet| Agent
    APIGW --> Lambda
    Lambda --> DDB
    Lambda -->|StartExecution| SFN
    SFN --> Nova
    SFN --> SNS
    SFN --> CW
    Agent --> DDB
    Agent --> Sonnet
    Agent --> SNS
    SNS --> Mail
    APIGW -. validates .-> Cognito
    Agent -. validates JWT .-> Cognito
```

Text fallback: the browser signs in with Cognito, calls API Gateway with a bearer token; API Gateway validates it against the user pool and proxies to the FastAPI Lambda, which reads/writes DynamoDB and starts Step Functions executions. The state machine calls Bedrock (Nova) for non-time-off requests, publishes to SNS (email to HR) and writes a CloudWatch metric. The AgentCore runtime validates a Cognito JWT, then the Strands agent uses Claude Sonnet 4.6 and its tools read/write the same DynamoDB table and publish to the same SNS topic. The browser-to-agent path does not exist yet.

### Data Flow

- **CRUD**: Browser -> API Gateway (authorizer) -> Lambda -> DynamoDB -> JSON response (synchronous).
- **HR request**: Browser -> API -> Lambda `StartExecution` -> `202 {executionArn}` returned immediately; the state machine continues asynchronously and its only outputs are an SNS email and a metric. Nothing is written back to DynamoDB, and no endpoint reads execution status.
- **Agent chat**: Client -> AgentCore `/invocations` (JWT) -> `invoke(payload, context)` -> Strands `stream_async` -> SSE stream of Bedrock ConverseStream events. Tools act on DynamoDB/SNS with the runtime role, not the caller's identity.
- **Single-table layout** (`HrTable`): employees `PK="USER", SK=<employeeId>, GSI1PK="USER_BY_DATE", GSI1SK=<startDate>`; leave `PK=<employeeId>, SK=<startDate>`.

### Key Design Decisions

1. **One Cognito pool for API and agent** - the AgentCore authorizer (`RuntimeAuthorizerConfiguration.using_cognito(user_pool, [user_pool_client])`) reuses the backend pool/client, so one sign-in can serve both. Consequence: API Gateway's Cognito authorizer (no OAuth scopes) accepts the ID token, while the AgentCore authorizer checks allowed clients, a claim the access token carries (`client_id`); the UI will likely send the ID token to the API and the access token to the agent (to verify in design).
2. **Build artifacts passed through SSM** - Lambda layer ARN and agent image URI are produced by scripts and read at synth time (`value_for_string_parameter`). Consequence: deploy order is scripts first, then `cdk deploy`.
3. **Cross-stack wiring by object passing** - `StateMachineStack` injects `HR_STATE_MACHINE_ARN` and a `states:StartExecution` policy into the Backend Lambda, so `HrLeavePortalBackend` depends on `HrLeavePortalStateMachine` (which depends on Notifications). A UI stack consuming `backend.api`, `backend.user_pool`, `backend.user_pool_client` and the runtime ARN fits this same pattern.
4. **Fire-and-forget HR requests** - simple, but results are not visible to a UI.
5. **Permissive CORS** - FastAPI `CORSMiddleware(allow_origins=["*"])` and API Gateway preflight `ALL_ORIGINS`; no gateway responses add CORS headers to authorizer 401/403 errors.

### Improvement Opportunities

- Add authorization beyond authentication (Cognito groups such as HR vs employee; derive `user_id`/`actorId` from token claims instead of request bodies).
- Expose HR-request status/results (persist outcomes or add `GET /hr-requests/{id}` via `DescribeExecution`).
- Add `GatewayResponse` CORS headers for `DEFAULT_4XX`/`DEFAULT_5XX`; restrict origins to the UI's CloudFront domain once it exists.
- Verify browser CORS support of the AgentCore data plane; if absent, front the agent with a proxy Lambda/API route that also streams.
- Create the AgentCore Memory resource in CDK and pass `MEMORY_AGENTMEMORY_ID`, or drop the memory config.
- Add `CfnOutput`s or SSM parameters for the region and the runtime's invocation URL; register the UI origin as Cognito callback/logout URL if the hosted UI is used.
- Factor the duplicated DynamoDB access code into one shared module.

## Interaction Diagrams

### Authenticated CRUD (e.g. list an employee's leave)

```mermaid
sequenceDiagram
    participant U as Browser
    participant C as Cognito
    participant G as API Gateway HrApi
    participant L as ApiFunction (FastAPI)
    participant D as DynamoDB HrTable
    U->>C: Sign in (SRP or USER_PASSWORD)
    C-->>U: ID, access, refresh tokens
    U->>G: GET /employees/{id}/leave?month=YYYY-MM (Authorization: ID token)
    G->>C: Validate token (Cognito authorizer)
    G->>L: Lambda proxy event
    L->>D: Query PK=id, SK begins_with month
    D-->>L: Items
    L-->>G: 200 {"leave": [...]}
    G-->>U: 200 + CORS headers from FastAPI
```

Text fallback: the user signs in to Cognito and receives tokens; the browser calls the API with the token; API Gateway validates it and proxies to FastAPI, which queries DynamoDB and returns the items with CORS headers.

### Asynchronous HR request

```mermaid
sequenceDiagram
    participant U as Browser
    participant L as ApiFunction
    participant S as Step Functions
    participant B as Bedrock Nova 2 Lite
    participant N as SNS HrEmailTopic
    participant M as CloudWatch
    U->>L: POST /hr-requests {user_id, prompt}
    L->>S: StartExecution(hr_request_type=BenefitsInquiry)
    L-->>U: 202 {executionArn}
    alt TimeOff
        S->>S: Build TimeOff Body
    else other request
        S->>B: InvokeModel(prompt)
        B-->>S: answer text
    end
    S->>N: Publish email_body
    S->>M: PutMetricData HrRequests
```

Text fallback: the API starts an execution and returns 202 with the execution ARN only; the state machine builds the email body (template for time off, Bedrock answer otherwise), publishes it to SNS and records a metric. The caller never receives the result.

### Agent chat turn

```mermaid
sequenceDiagram
    participant U as Client (UI to be built)
    participant R as AgentCore Runtime
    participant A as invoke() Strands Agent
    participant B as Bedrock Claude Sonnet 4.6
    participant T as Tools (DynamoDB / SNS)
    U->>R: POST /runtimes/{arn}/invocations (Bearer JWT, Session-Id header, {prompt, actorId})
    R->>R: Validate JWT against Cognito pool and allowed client
    R->>A: invoke(payload, context.session_id)
    A->>B: ConverseStream
    B-->>A: toolUse
    A->>T: e.g. list_leave(employee_id)
    T-->>A: items
    A->>B: tool result
    B-->>A: text deltas
    A-->>U: SSE events (contentBlockDelta, messageStop, ...)
```

Text fallback: the client posts a prompt with a bearer JWT and a session id header; AgentCore validates the token and calls the `invoke` entrypoint, which streams the Strands agent; the model may call tools that hit DynamoDB or SNS; text deltas stream back to the client as server-sent events. One cached Agent per (session_id, actorId) keeps conversation state in the session's process.
