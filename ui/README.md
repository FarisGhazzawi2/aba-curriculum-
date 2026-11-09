# HR Leave Portal UI

A React single-page app for HR staff. It signs in with the existing Cognito user pool and lets you:

- list, filter (by hire date), create, edit and delete employees;
- view, add and edit an employee's leave (there is no leave delete, because the API has none);
- submit time-off requests and HR or benefits questions, which HR receives by email;
- chat with the hrAgent on Amazon Bedrock AgentCore, with replies streamed as they are written.

Built with React 19, TypeScript (strict), Vite, React Router, and Amplify Auth with the Amplify UI Authenticator. The look is defined once as design tokens in `src/styles/tokens.css`.

## Who this is for

This is an **HR-staff tool**. The backend has no per-user authorization: every signed-in user can see and change every employee and leave record, and the assistant can do the same and send email to HR. Only give accounts to HR staff. Users are created by an administrator in the Cognito user pool; there is no self sign-up.

## Project layout

| Path | What it holds |
|---|---|
| `src/main.tsx` | Loads `/config.json`, configures Amplify and renders the Authenticator around the app |
| `src/config.ts` | Reads and validates the runtime config |
| `src/auth/` | Token access (`session.ts`) and the session-expired event channel |
| `src/api/` | Typed REST client, error types and API data types |
| `src/agent/` | AgentCore streaming client and the server-sent-events parser |
| `src/lib/validation.ts` | Form and business validation the API does not do itself |
| `src/pages/`, `src/components/` | Screens and shared components |
| `src/styles/`, `src/theme/` | Design tokens, global styles and the Authenticator theme |

## Runtime configuration

The app reads `/config.json` at startup and contains no environment values or secrets. The deployed stack writes this file for you. It holds only public identifiers:

```json
{
  "apiUrl": "https://<id>.execute-api.<region>.amazonaws.com/prod/",
  "region": "<region>",
  "userPoolId": "<region>_<id>",
  "userPoolClientId": "<client id>",
  "agentRuntimeArn": "arn:aws:bedrock-agentcore:<region>:<account>:runtime/<id>"
}
```

If the file is missing or invalid, the app shows a configuration error page instead of the sign-in form.

## Local development

Prerequisites: Node.js 22 and the backend and agent runtime stacks already deployed.

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `public/config.example.json` to `public/config.json` and fill in the values from the stack outputs `HrLeavePortalBackend.ApiUrl`, `HrLeavePortalBackend.UserPoolId`, `HrLeavePortalBackend.UserPoolClientId` and `HrLeavePortalAgentRuntime.AgentRuntimeArn`. `public/config.json` is git-ignored, and the CDK stack never deploys it.

3. Start the dev server:

   ```bash
   npm run dev
   ```

## Test, lint and build

```bash
npm test            # Vitest unit and component tests (jsdom), run once
npm run test:watch  # the same in watch mode
npm run lint        # ESLint
npm run build       # type-check (tsc -b) and production build into dist/
```

Run the tests through the package script (`npm test`, or `npm --prefix ui test -- <files>` from the repository root), so Vitest picks up `vite.config.ts` and its jsdom setup.

The CDK tests for the hosting stack live in the repository's `tests/unit/` folder:

```bash
python -m pytest tests/unit/test_ui_stack.py tests/unit/test_backend_gateway_responses.py
```

## Deploy

The UI is deployed by the `HrLeavePortalUi` stack in the repository's CDK app. It hosts `ui/dist` in a private S3 bucket behind CloudFront (Origin Access Control, HTTPS only), writes `config.json` from the other stacks' outputs, and invalidates `/index.html` and `/config.json` on every deploy.

Order:

1. Run the scripts the backend and agent need (`scripts/build_layer.sh` and `scripts/build_and_push_agent.sh`), as for the existing stacks.
2. Build the UI. The CDK app needs `ui/dist` at synth time and stops with an error telling you to build it if it is missing.

   ```bash
   cd ui && npm ci && npm run build && cd ..
   ```

3. Deploy the stacks the UI depends on, then the UI stack:

   ```bash
   cdk deploy HrLeavePortalNotifications HrLeavePortalStateMachine HrLeavePortalBackend HrLeavePortalAgentRuntime
   cdk deploy HrLeavePortalUi
   ```

   `cdk deploy HrLeavePortalUi --exclusively` redeploys only the UI after a new build.

4. Open the `HrLeavePortalUi.UiUrl` output.

## First check on a new deployment: the assistant from the browser

The assistant calls AgentCore Runtime directly from the browser with the user's Cognito access token. Whether the AgentCore endpoint accepts these cross-origin requests has not been verified yet (requirements assumption A1, open question OQ1). On the deployed URL:

1. Sign in and open **Assistant**.
2. Send a short message, for example "List employees".
3. Open the browser developer tools, Network tab, and look at the `invocations` request.

- **Reply streams in**: the direct call works. Nothing more to do.
- **The request fails with a CORS error** (the console shows "blocked by CORS policy", often on the preflight `OPTIONS` request): the browser cannot call AgentCore directly. Do not work around this in the UI. The planned fallback is a small streaming proxy (a Lambda function URL that forwards the token), which changes the requirements and goes back to the product owner first.
- **401 or 403**: the agent's authorizer rejected the access token (assumption A2). Check that the runtime's allowed client is the `HrUserPoolClient`.

Errors from the REST API (401, 403, 5XX) carry CORS headers through API Gateway Gateway Responses, so the app can show "session expired" instead of a generic network error.
