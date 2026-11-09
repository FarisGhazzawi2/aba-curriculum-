# Requirements Analysis Questions

Context: the code scan (`aidlc/spaces/default/codekb/hr-leave-portal/`) shows a FastAPI REST API behind API Gateway + Cognito, an hrAgent on AgentCore Runtime with a Cognito JWT authorizer on the same user pool, and a `ui/` folder that is still the Vite starter (aws-amplify installed, unused). These questions settle what the front end promises, given what the backend actually does.

## Q1. [product manager] Who is the UI for, and what may each user do?

The backend has no authorization beyond sign-in: any Cognito user can read, change or delete every employee and leave record (through the API or the agent), and `user_id` comes from the request body, not the token. The UI cannot enforce record-level isolation on its own.

A. HR staff only. Every signed-in user sees and can do everything the API allows; the UI makes no per-user promises (matches the backend as it is today)
B. HR staff and employees, with the UI hiding HR-only screens based on a Cognito group. Documented as cosmetic only: the API still lets any user do anything
C. HR staff and employees, with real enforcement: add Cognito groups and backend authorization checks (API and agent) in this work. Expands scope into the backend
X. Other (please specify)

[Answer]: A

## Q2. [product manager] Which features must the first version of the UI include? (select all that apply)

A. Employees: list (with the hire-date range filter), view, create, edit, delete with confirmation
B. Leave: list an employee's leave (optionally by month), add leave, edit end date and note (the API has no leave delete)
C. HR requests: submit a time-off request and a free-text HR/benefits question
D. HR assistant chat: a chat panel that talks to the hrAgent on AgentCore and streams its replies
X. Other (please specify)

[Answer]: A, B, C, D (user: "everything")

## Q3. [product manager] What should the UI show after an HR request is submitted?

HR request endpoints return only `202 {executionArn}`; the outcome is emailed to the HR mailbox via SNS and is not stored or readable through the API.

A. Show a confirmation ("Request submitted; HR will receive it by email") with a reference id. No backend change; the UI never claims to show the outcome
B. Add a backend status endpoint (for example `GET /hr-requests/{id}` using Step Functions DescribeExecution) and show running / succeeded / failed. Backend change in this work
C. Leave HR-request submission out of the UI for now
X. Other (please specify)

[Answer]: A

## Q4. [architect] How should the browser reach the hrAgent on AgentCore?

AgentCore validates a Cognito JWT (the access token, per the allowed-client check). Whether the AgentCore endpoint allows browser CORS is not configured or verified in the repo. Replies are a server-sent-events stream.

A. Call AgentCore directly from the browser with the user's Cognito access token; verify CORS early, and switch to option B only if it is blocked
B. Always go through a small proxy we add (for example a Lambda function URL with response streaming that forwards the user's token), so CORS is under our control
C. Call it through the existing API Gateway / FastAPI (non-streaming: the UI shows the full reply when it is done)
X. Other (please specify)

[Answer]: A

## Q5. [platform engineer] How should the UI be hosted and configured by the new CDK stack?

The backend stack exports `ApiUrl`, `UserPoolId` and `UserPoolClientId`; the agent stack exports `AgentRuntimeArn`. Users are created by an admin (self sign-up is off), and the app client supports SRP sign-in with no hosted UI domain.

A. Private S3 bucket + CloudFront (Origin Access Control, HTTPS, SPA fallback to index.html), built assets deployed by CDK, and a generated `config.json` carrying the API URL, pool ids, region and agent ARN. Sign-in in-app with Amplify's Authenticator (SRP), no hosted UI
B. Same as A, but use the Cognito hosted UI (adds a Cognito domain and registers the CloudFront URL as a callback, which needs care to avoid a stack dependency cycle)
C. AWS Amplify Hosting instead of S3 + CloudFront
X. Other (please specify)

[Answer]: A

## Q6. [platform engineer] Should this work fix the API error responses the browser can't read?

API Gateway's authorizer 401/403 and gateway 5XX responses carry no CORS headers, so the browser reports an expired session or a backend fault as a generic CORS/network error, and the UI can't tell the user to sign in again.

A. Yes: add Gateway Responses with CORS headers for 4XX/5XX in the backend stack (small backend change), so the UI can show "session expired, sign in again" and real error messages
B. Yes, and also restrict allowed origins to the new CloudFront domain instead of `*`
C. No backend change: the UI treats any network/CORS failure as a possible expired session and offers re-sign-in
X. Other (please specify)

[Answer]: A
