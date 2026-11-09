# Business Overview - hr-leave-portal

## Purpose

An internal HR leave portal for a small company. HR staff keep employee records and leave (time-off) entries, raise HR requests that reach the HR mailbox by email, and use an AI HR assistant that can query and change the same records in natural language.

## Business Domain

- **Employees**: name, department, start (hire) date, role (`employee` by default). Identified by an 8-hex-char generated id.
- **Leave**: one entry per employee per start date, with end date and free-text note. Listable per employee, optionally per month (`YYYY-MM`).
- **HR requests**: asynchronous workflows. A *time-off request* becomes a formatted email to HR; any other request (*benefits inquiry*) is answered by a Bedrock model (Amazon Nova 2 Lite) and the answer is emailed to HR. Each request also records a CloudWatch metric `HR/HrRequests`.
- **HR assistant (hrAgent)**: a conversational agent (Claude Sonnet 4.6 via Bedrock) with tools to create/read/update/delete employees, save/list leave, draft a leave email and send email to HR. Its system prompt requires confirmation before deletes and a draft-before-send step.

## Users

- **HR staff** are the only explicit audience (agent system prompt: "You help HR staff manage employee records"). Users are Cognito users created by an administrator (self sign-up disabled).
- No employee self-service role, groups, or per-user data scoping exist today; see `code-quality-assessment.md`.

## Key Functionality

| Capability | Where | Channel |
|---|---|---|
| Employee CRUD and hire-date search | `api/` | REST API |
| Leave create/update/list | `api/` | REST API |
| Time-off and general HR requests (fire-and-forget) | `api/` + Step Functions | REST API -> email |
| Conversational HR assistant | `hrAgent/` | AgentCore Runtime invocation |
| Web front end | `ui/` | Not built yet (Vite starter template) |

## Active Intent Context

Intent `react-ui-agentcore`: build a React front end over the existing API, integrate the AgentCore-hosted hrAgent, and add a CDK stack that deploys the UI. Front-end constraints are collected in `architecture.md` (Key Design Decisions, Improvement Opportunities) and `api-documentation.md`.
