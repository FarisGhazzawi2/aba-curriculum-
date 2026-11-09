# Technology Stack - hr-leave-portal

Versions are the resolved lock-file versions (`uv.lock`, `hrAgent/app/agent/uv.lock`, `ui/package-lock.json`).

## Languages and Runtimes

| Item | Version | Where |
|---|---|---|
| Python | 3.14 (`.python-version`, `requires-python >=3.14`, Lambda `PYTHON_3_14`) | root CDK app, `api/` |
| Python | 3.12 (`python:3.12-slim-trixie` base image; `requires-python >=3.10`) | `hrAgent/app/agent` |
| TypeScript | 6.0.3 | `ui/` |
| JSONata | Step Functions `QueryLanguage` | `state_machines/` |

## Frameworks and Libraries

| Library | Version | Purpose |
|---|---|---|
| aws-cdk-lib | 2.275.0 | IaC, including the `aws_bedrockagentcore` L2 constructs |
| constructs | 10.8.1 | CDK |
| fastapi | 0.162.0 | REST API |
| pydantic | 2.14.1 | Validation |
| mangum | 0.22.0 | Lambda adapter (shipped in the layer) |
| uvicorn | 0.54.0 | Local dev server (dependency only) |
| boto3 | 1.43.121 / 1.43.124 | AWS SDK (root / agent) |
| strands-agents | 1.64.0 | Agent framework |
| bedrock-agentcore | 1.25.3 | `BedrockAgentCoreApp`, memory integration |
| aws-opentelemetry-distro | 0.21.0 | Agent tracing (`opentelemetry-instrument`) |
| react, react-dom | 19.3.1 | UI |
| aws-amplify | 6.22.2 | Cognito auth client (installed, unused) |
| @aws-amplify/ui-react | 6.15.7 | Authenticator UI (installed, unused) |
| vite | 8.3.6 | Dev server / bundler |
| @vitejs/plugin-react | ^6.1.2 | React plugin |
| eslint | 10.14.0 (+ typescript-eslint ^8.72.1, react-hooks, react-refresh) | UI lint |
| pytest | 8.4.2 | Python tests |

## AWS Services

Cognito User Pools, API Gateway (REST), Lambda, DynamoDB, Step Functions, SNS, CloudWatch, Bedrock (Nova 2 Lite via `us.` inference profile; Claude Sonnet 4.6 via `global.` profile), Bedrock AgentCore Runtime (and Memory, declared but not deployed by CDK), ECR, SSM Parameter Store. Region in the AgentCore CLI target: `us-east-1`.

## Tooling

uv (Python packaging), AWS CDK CLI, AWS CLI, finch/docker (agent image, linux/arm64), AgentCore CLI (`hrAgent/agentcore/`), npm.
