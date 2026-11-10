#!/usr/bin/env python3
import aws_cdk as cdk
from aws_cdk import Validations
# from cdk_nag import AwsSolutionsChecks

from hr_leave_portal.agent_runtime_stack import AgentRuntimeStack
from hr_leave_portal.backend_stack import BackendStack
from hr_leave_portal.dashboard_stack import DashboardStack
from hr_leave_portal.notification_stack import NotificationStack
from hr_leave_portal.state_machine_stack import StateMachineStack
from hr_leave_portal.ui_stack import UiStack

app = cdk.App()

# Uncomment to audit every stack against the AWS Solutions rule pack. Synth
# fails while findings are unacknowledged, which is the point of it.
# (31 errors left on 2026-11-11; acknowledged ones live at the end of each stack.)
# Validations.of(app).add_plugins(AwsSolutionsChecks(app, verbose=True))

notifications = NotificationStack(app, "HrLeavePortalNotifications")

backend = BackendStack(app, "HrLeavePortalBackend")

StateMachineStack(
    app,
    "HrLeavePortalStateMachine",
    hr_email_topic=notifications.hr_email_topic,
    api_function=backend.api_function
)

agent_runtime = AgentRuntimeStack(
    app,
    "HrLeavePortalAgentRuntime",
    table=backend.table,
    hr_email_topic=notifications.hr_email_topic,
    user_pool=backend.user_pool,
    user_pool_client=backend.user_pool_client
)

# Build the UI first (npm run build in ui/); the stack deploys ui/dist and config.json.
UiStack(
    app,
    "HrLeavePortalUi",
    api=backend.api,
    user_pool=backend.user_pool,
    user_pool_client=backend.user_pool_client,
    agent_runtime_arn=agent_runtime.agent_runtime_arn
)

DashboardStack(
    app, "HrLeavePortalDashboard", api_function=backend.api_function, api=backend.api
)

app.synth()
