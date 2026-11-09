# Cross-Unit Traceability: HR Leave Portal Web UI

Source: `aidlc engine sensor-traceability --stage build-and-test` (zero-Unit express run; all work belongs to the single `code-generation` stage).

**Verdict: PASS.** 50 of 50 requirement IDs are covered, with 0 uncovered.

| ID | Covered | Owning stage | Target file |
|---|---|---|---|
| FR1.1 | Yes | code-generation | ui/src/main.tsx |
| FR1.2 | Yes | code-generation | ui/src/main.tsx |
| FR1.3 | Yes | code-generation | ui/src/auth/session.ts |
| FR1.4 | Yes | code-generation | ui/src/components/AppLayout.tsx |
| FR1.5 | Yes | code-generation | ui/src/components/SessionExpiredBanner.tsx |
| FR2.1 | Yes | code-generation | ui/src/pages/EmployeesPage.tsx |
| FR2.2 | Yes | code-generation | ui/src/lib/validation.ts |
| FR2.3 | Yes | code-generation | ui/src/pages/EmployeeDetailPage.tsx |
| FR2.4 | Yes | code-generation | ui/src/pages/EmployeeForm.tsx |
| FR2.5 | Yes | code-generation | ui/src/pages/EmployeeForm.tsx |
| FR2.6 | Yes | code-generation | ui/src/components/ConfirmDialog.tsx |
| FR2.7 | Yes | code-generation | ui/src/api/client.ts |
| FR3.1 | Yes | code-generation | ui/src/pages/LeaveSection.tsx |
| FR3.2 | Yes | code-generation | ui/src/lib/validation.ts |
| FR3.3 | Yes | code-generation | ui/src/pages/LeaveSection.tsx |
| FR3.4 | Yes | code-generation | ui/src/pages/LeaveSection.tsx |
| FR4.1 | Yes | code-generation | ui/src/pages/HrRequestsPage.tsx |
| FR4.2 | Yes | code-generation | ui/src/pages/HrRequestsPage.tsx |
| FR4.3 | Yes | code-generation | ui/src/pages/HrRequestsPage.test.tsx |
| FR4.4 | Yes | code-generation | ui/src/pages/HrRequestsPage.tsx |
| FR5.1 | Yes | code-generation | ui/src/agent/agentClient.ts |
| FR5.2 | Yes | code-generation | ui/src/agent/agentClient.ts |
| FR5.3 | Yes | code-generation | ui/src/agent/agentClient.ts |
| FR5.4 | Yes | code-generation | ui/src/agent/sse.ts |
| FR5.5 | Yes | code-generation | ui/src/pages/AssistantPage.tsx |
| FR5.6 | Yes | code-generation | ui/src/pages/AssistantPage.tsx |
| FR5.7 | Yes | code-generation | ui/src/pages/AssistantPage.tsx |
| FR6.1 | Yes | code-generation | hr_leave_portal/backend_stack.py |
| FR7.1 | Yes | code-generation | hr_leave_portal/ui_stack.py |
| FR7.2 | Yes | code-generation | hr_leave_portal/ui_stack.py |
| FR7.3 | Yes | code-generation | hr_leave_portal/ui_stack.py |
| FR7.4 | Yes | code-generation | ui/src/config.ts |
| FR7.5 | Yes | code-generation | hr_leave_portal/ui_stack.py |
| FR7.6 | Yes | code-generation | app.py |
| FR7.7 | Yes | code-generation | hr_leave_portal/ui_stack.py |
| FR8.1 | Yes | code-generation | ui/src/styles/tokens.css |
| FR8.2 | Yes | code-generation | ui/src/styles/global.css |
| FR8.3 | Yes | code-generation | ui/src/theme/amplifyTheme.ts |
| FR8.4 | Yes | code-generation | ui/src/components/AppLayout.tsx |
| FR8.5 | Yes | code-generation | ui/src/styles/global.css |
| NFR1 | Yes | code-generation | hr_leave_portal/ui_stack.py |
| NFR2 | Yes | code-generation | tests/unit/test_ui_stack.py |
| NFR3 | Yes | code-generation | ui/src/auth/session.ts |
| NFR4 | Yes | code-generation | ui/README.md |
| NFR5 | Yes | code-generation | ui/src/hooks/useLoader.ts |
| NFR6 | Yes | code-generation | ui/src/styles/tokens.css |
| NFR7 | Yes | code-generation | ui/vite.config.ts |
| NFR8 | Yes | code-generation | ui/eslint.config.js |
| NFR9 | Yes | code-generation | tests/unit/test_ui_stack.py |
| NFR10 | Yes | code-generation | hr_leave_portal/ui_stack.py |

UI behavior targets (FR1.5, FR2–FR5) were tested in jsdom under Node, which is integration evidence, not a real browser.

Uncovered elements: none.
