# Requirements: HR Leave Portal Web UI

## Intent Analysis

Initial description: "Build a React front end for the backend system that already exists in this repo. Also include integration with our AI hrAgent hosted in AgentCore and Create a CDK stack to deploy the new UI." [desc]

- **Goal**: give HR staff a browser-based way to do what today only the REST API and the AgentCore-hosted hrAgent can do: manage employees and leave, submit HR requests, and talk to the HR assistant. [desc] [Q1] [Q2]
- **Type**: new front end over an existing (brownfield) backend, plus a new CDK hosting stack and one small backend change (CORS on API error responses). [desc] [Q6]
- **Complexity**: standard, multi-component (React SPA, Cognito auth, REST API, streaming agent, CDK).
- **Principle**: the UI promises only what the backend actually does. It does not imply per-user data isolation, and it does not claim to show HR-request outcomes. [Q1] [Q3]

Sources: `aidlc/spaces/default/codekb/hr-leave-portal/` (business-overview.md, architecture.md, api-documentation.md, code-quality-assessment.md) and `requirements-analysis-questions.md` (Q1-Q6).

## Functional Requirements

### FR1 Authentication

- **FR1.1** The UI shall require sign-in with the existing Cognito user pool (`HrUserPool`) and app client (`HrUserPoolClient`) using SRP, through Amplify's Authenticator, before any other screen is shown. [Q5]
  - Given a signed-out visitor, When they open any UI URL, Then the sign-in form is shown and no API or agent call is made.
- **FR1.2** The UI shall offer sign-in only. No self sign-up, because the pool has self sign-up disabled and users are created by an administrator. Password reset and forced first-sign-in password change are supported as Cognito provides them. [Q5]
  - Given the sign-in screen, Then no "Create account" option is visible.
- **FR1.3** The UI shall send the Cognito **ID token** to the REST API and the Cognito **access token** to AgentCore, each as an `Authorization` header. [Q4]
  - Given a signed-in user, When a REST call is made, Then its `Authorization` header holds the ID token. When an agent call is made, Then it holds `Bearer <access token>`.
- **FR1.4** The UI shall provide sign-out, which clears the tokens and returns to the sign-in screen.
- **FR1.5** When the API returns 401 or 403, the UI shall tell the user their session has expired or they lack access, and offer to sign in again. It shall not show a generic network error. This depends on FR6.1. [Q6]
  - Given an expired token, When the user loads the employee list, Then a "session expired, sign in again" message is shown.

### FR2 Employees

- **FR2.1** The UI shall list employees from `GET /employees`, showing name, department, start date and role. [Q2]
- **FR2.2** The UI shall filter the list by hire-date range (`hiredFrom` and `hiredTo`, both required). It shall not send the filter unless both dates are set and `hiredFrom` is on or before `hiredTo`.
  - Given only one date filled in, Then the Apply action is disabled and the reason is shown.
- **FR2.3** The UI shall show one employee's details from `GET /employees/{id}`. On a 404 it shall show "Employee not found".
- **FR2.4** The UI shall create an employee (`POST /employees`) with name, department, start date and role (default `employee`). Name, department and start date are required.
  - Given an empty name, When the user submits, Then the form is not sent and the field is flagged.
- **FR2.5** The UI shall edit an employee (`PUT /employees/{id}`) with the same fields and validation as FR2.4.
- **FR2.6** The UI shall delete an employee (`DELETE /employees/{id}`) only after an explicit confirmation that names the employee.
  - Given the confirmation dialog, When the user cancels, Then no request is sent.
- **FR2.7** The UI shall not display the DynamoDB key attributes (`PK`, `SK`, `GSI1PK`, `GSI1SK`) that the API returns.

### FR3 Leave

- **FR3.1** The UI shall list an employee's leave from `GET /employees/{id}/leave`, with an optional month filter (`YYYY-MM`). [Q2]
- **FR3.2** The UI shall add leave (`POST /employees/{id}/leave`) with start date, end date and note. It shall reject an end date before the start date before sending, because the API does not check this.
  - Given end date 2026-11-01 and start date 2026-11-05, When the user submits, Then the form is blocked with "End date must be on or after start date".
- **FR3.3** The UI shall edit an existing leave entry's end date and note (`PUT /employees/{id}/leave/{startDate}`). The start date is shown read-only because it is the entry's key.
- **FR3.4** The UI shall offer no leave delete, because the API has none.

### FR4 HR Requests

- **FR4.1** The UI shall submit a time-off request (`POST /hr-requests/time-off`) with the employee (`user_id`), start date and end date. End must be on or after start. [Q2]
- **FR4.2** The UI shall submit a free-text HR or benefits question (`POST /hr-requests`) with the employee (`user_id`) and a non-empty prompt.
- **FR4.3** On `202`, the UI shall show a confirmation saying the request was submitted and that HR will receive it by email, along with a short reference derived from the returned `executionArn`. The UI shall not show or imply a status or outcome. [Q3]
  - Given a successful submit, Then the message reads in substance "Submitted. HR will receive this request by email." and no status indicator is shown.
- **FR4.4** The `user_id` shall be chosen from the employee list, not typed freely, so it matches an existing employee id. [assumption]

### FR5 HR Assistant Chat

- **FR5.1** The UI shall provide a chat panel that sends the user's message to the hrAgent on AgentCore Runtime (`POST https://bedrock-agentcore.<region>.amazonaws.com/runtimes/<URL-encoded runtime ARN>/invocations?qualifier=DEFAULT`) with body `{"prompt": <text>}`, called directly from the browser. [Q2] [Q4]
- **FR5.2** The UI shall generate one session id of at least 33 characters per conversation and send it in `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` on every turn of that conversation. A "New conversation" action starts a new session id.
- **FR5.3** The UI shall send `actorId` set to the signed-in user's Cognito `sub`, so each user's conversations are kept separate in the agent.
- **FR5.4** The UI shall render the reply as it streams, appending each `contentBlockDelta.delta.text` from the server-sent events, and shall mark the reply finished on `messageStop` or when the stream ends.
  - Given a streamed reply, Then text appears incrementally before the stream ends.
- **FR5.5** While a reply is streaming, the UI shall disable sending another message and offer a Stop action that cancels the request.
- **FR5.6** On an agent error (non-2xx, network failure or broken stream), the UI shall show an error in the conversation and keep the user's message so they can retry.
- **FR5.7** Because the agent can create, change and delete records and send email to HR, the chat panel shall say so in a short notice. The agent's own confirmation-before-delete behavior is relied on, not re-implemented.

### FR6 Backend Change: Readable API Errors

- **FR6.1** The backend stack shall add API Gateway Gateway Responses for `DEFAULT_4XX` and `DEFAULT_5XX` that include `Access-Control-Allow-Origin` and the allowed headers, so the browser can read 401, 403 and 5XX responses. Allowed origins stay as they are today (`*`). [Q6]
  - Given a request with an expired token from the UI origin, When API Gateway rejects it, Then the browser receives a 401 whose status the UI can read.

### FR7 Hosting and Deployment (CDK)

- **FR7.1** A new CDK stack (`HrLeavePortalUi`) in the existing CDK app shall host the built UI in a private S3 bucket behind CloudFront with Origin Access Control and HTTPS only (HTTP redirects to HTTPS). [desc] [Q5]
- **FR7.2** CloudFront shall serve `index.html` for unknown paths (403/404 from S3), so client-side routes work on reload.
- **FR7.3** The stack shall deploy the built `ui/dist` assets and a generated `config.json` holding the API URL, user pool id, user pool client id, region and agent runtime ARN, taken from the backend and agent runtime stacks (object passing, the pattern `app.py` already uses).
- **FR7.4** The UI shall read `config.json` at startup and contain no hard-coded environment values or secrets.
  - Given a deployed stack, When the app loads, Then it fetches `/config.json` and fails with a visible configuration error if the file is missing.
- **FR7.5** The stack shall output the CloudFront URL as a CloudFormation output.
- **FR7.6** The UI stack shall depend on the backend and agent runtime stacks, and nothing in those stacks shall depend on the UI stack (no dependency cycle).
- **FR7.7** Deploying a new UI build shall invalidate CloudFront's cache for `index.html` and `config.json`, so users get the new version without a manual step.

### FR8 Visual Design

Origin: change requested at the Requirements Analysis gate: "i want the style to be like rolex website".

- **FR8.1** The UI shall have a premium, understated look in the spirit of the Rolex website. The look is inspired by it, not copied:
  - a deep green primary color (around `#006039`) with a muted gold accent (around `#A37E2C`) on white and off-white backgrounds;
  - an elegant serif typeface for headings and a clean sans-serif for body text and data, both from Google Fonts or the system with a real fallback stack;
  - generous whitespace and a restrained, mostly monochrome layout;
  - thin rules and borders, square or near-square corners, and no heavy shadows;
  - uppercase, letter-spaced labels for navigation and buttons;
  - a full-width top navigation bar in the primary green.
  - Given any main screen, Then it uses only the defined design tokens (colors, typefaces, spacing), with no default starter styling left over.
- **FR8.2** Motion shall be subtle (fades and short transitions of 300 ms or less) and shall respect `prefers-reduced-motion`.
- **FR8.3** The design shall be defined once as tokens (CSS custom properties) and applied consistently, including to Amplify's Authenticator (sign-in screen) through its theming. The sign-in screen matches the rest of the app.
- **FR8.4** The UI shall not use Rolex's name, crown logo, trademarks, imagery, proprietary fonts or copied page layouts. It uses the HR Leave Portal's own name and a simple text wordmark.
- **FR8.5** Layouts shall work from 375 px phone width to desktop. Tables scroll horizontally inside their own container on narrow screens.

## Non-Functional Requirements

- **NFR1 Security, transport**: all UI traffic shall be HTTPS. The S3 bucket shall block all public access and be readable only through CloudFront OAC.
- **NFR2 Security, secrets**: the UI bundle and `config.json` shall contain no secrets. Only public identifiers (pool and client ids, API URL, runtime ARN, region) are allowed.
- **NFR3 Security, tokens**: tokens shall be handled by Amplify Auth's default storage, never logged to the console, and never put in URLs.
- **NFR4 Authorization honesty**: the UI shall be documented and labelled as an HR-staff tool. Any signed-in user can see and change all records (backend limitation, tracked in `code-quality-assessment.md`). [Q1]
- **NFR5 Responsiveness**: list and detail views shall show a loading indicator within 200 ms of starting a request. Agent replies shall show the first streamed text as soon as it arrives, without waiting for the full reply.
- **NFR6 Accessibility**: forms shall have associated labels, be fully usable by keyboard, and show validation errors as text, not only as color. Target: no critical axe violations on the main screens. Text and interactive elements in the green and gold palette (FR8) shall meet WCAG 2.1 AA contrast (4.5:1 for body text). Gold is used for accents, not for body text on white.
- **NFR7 Browser support**: the current and previous major versions of Chrome, Edge, Firefox and Safari.
- **NFR8 Code quality**: TypeScript strict mode and the existing ESLint config shall pass with no errors. `npm run build` shall succeed.
- **NFR9 Testing (Minimal strategy)**: at least one unit test per functional requirement group (FR1-FR5, FR7), including the date validation and SSE text extraction logic, and one CDK assertion test for the UI stack (bucket not public, OAC, SPA fallback, outputs). Existing Python tests must not get worse. One of them is already broken (see Constraints).
- **NFR10 Deployability**: `cdk synth` shall succeed for all stacks, and deploying the UI stack shall need no manual console steps beyond building the UI first.

## Constraints

- **C1** Reuse the existing Cognito pool and client, REST API and AgentCore runtime unchanged, except for FR6.1. [desc] [Q6]
- **C2** React 19 + TypeScript + Vite in `ui/`, with `aws-amplify` 6 and `@aws-amplify/ui-react` already installed. CDK in Python in the existing app (`app.py`, `hr_leave_portal/`).
- **C3** The API has no pagination. Lists show everything the API returns.
- **C4** API JSON naming is mixed: camelCase for employees and leave, snake_case for HR requests. The UI client maps each as is.
- **C5** `tests/unit/test_hr_leave_portal_stack.py` already fails at import (it references a stack that does not exist). This work does not fix it unless asked, and it does not count as a regression.

## Assumptions

- **A1** [assumption] AgentCore Runtime's data-plane endpoint accepts browser cross-origin requests with an `Authorization: Bearer` header. Not verified in the repo (Q4 chose direct with a fallback). If it is blocked, the fallback is a streaming proxy (a Lambda function URL that forwards the token), which would be a change to FR5.1 and FR7. This must be verified first during Code Generation.
- **A2** [assumption] The AgentCore Cognito authorizer accepts the access token (its allowed-client check matches the access token's `client_id`), and API Gateway accepts the ID token. To be confirmed during the first integration test.
- **A3** [assumption] The `user_id` field of HR requests is meant to be an employee id. The state machine only echoes it into the email and the metric.
- **A4** [assumption] No custom domain or WAF is needed. The default CloudFront domain is acceptable.

## Out of Scope

- Per-user or role-based authorization in the backend or agent (Q1 chose HR staff only).
- Showing HR-request status or outcomes, and any status endpoint (Q3).
- Restricting CORS origins to the CloudFront domain (Q6 chose A, not B).
- Cognito hosted UI, custom domain, self sign-up (Q5).
- Provisioning AgentCore Memory, pagination, and the other backend debt items in `code-quality-assessment.md`.
- CI/CD pipeline (deployment is manual `cdk deploy`, as today).

## Open Questions

- **OQ1** Browser CORS on the AgentCore data plane (A1): verify early in Code Generation. If it is blocked, return to the user with the proxy option before building around it.
