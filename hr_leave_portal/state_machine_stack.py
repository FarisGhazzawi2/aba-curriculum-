import json

from aws_cdk import (
    Aws,
    CfnOutput,
    Stack,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_sns as sns,
    aws_stepfunctions as sfn)
from constructs import Construct

STATE_MACHINE_DEFINITION_FILE = "state_machines/hr_state_machine_definition.json"

# The only model the workflow invokes, from the "Bedrock InvokeModel" state in the
# definition file. Keep the two in step.
WORKFLOW_MODEL_ID = "us.amazon.nova-2-lite-v1:0"
WORKFLOW_FOUNDATION_MODEL = "amazon.nova-2-lite-v1:0"


class StateMachineStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        hr_email_topic: sns.Topic,
        api_function: lambda_.Function,
        **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        with open(STATE_MACHINE_DEFINITION_FILE) as definition_file:
            state_machine_definition = json.load(definition_file)

        state_machine_definition["States"]["SNS Publish"]["Arguments"][
            "TopicArn"
        ] = hr_email_topic.topic_arn

        state_machine_role = iam.Role(
            self,
            "HrStateMachineRole",
            assumed_by=iam.ServicePrincipal("states.amazonaws.com"))

        # The "us." profile and the foundation model it routes to (us-east-1,
        # us-east-2 or us-west-2); IAM authorizes both hops.
        state_machine_role.add_to_policy(
            iam.PolicyStatement(
                actions=["bedrock:InvokeModel"],
                resources=[
                    f"arn:aws:bedrock:{Aws.REGION}:{Aws.ACCOUNT_ID}:"
                    f"inference-profile/{WORKFLOW_MODEL_ID}",
                    f"arn:aws:bedrock:*::foundation-model/{WORKFLOW_FOUNDATION_MODEL}",
                ])
        )

        hr_email_topic.grant_publish(state_machine_role)

        # PutMetricData has no resource ARN, so "*" is required; the condition key
        # limits it to the HR namespace the workflow writes to.
        state_machine_role.add_to_policy(
            iam.PolicyStatement(
                actions=["cloudwatch:PutMetricData"],
                resources=["*"],
                conditions={"StringEquals": {"cloudwatch:namespace": "HR"}})
        )

        # X-Ray tracing is off by default; the role needs these to send traces.
        # These X-Ray actions support no resource-level permissions, so "*" it is.
        state_machine_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "xray:PutTraceSegments",
                    "xray:PutTelemetryRecords",
                    "xray:GetSamplingRules",
                    "xray:GetSamplingTargets",
                ],
                resources=["*"])
        )

        hr_state_machine = sfn.CfnStateMachine(
            self,
            "HrStateMachine",
            role_arn=state_machine_role.role_arn,
            definition_string=json.dumps(state_machine_definition),
            tracing_configuration=sfn.CfnStateMachine.TracingConfigurationProperty(
                enabled=True))

        api_function.add_environment(
            "HR_STATE_MACHINE_ARN", hr_state_machine.attr_arn)

        api_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["states:StartExecution"],
                resources=[hr_state_machine.attr_arn])
        )

        CfnOutput(self, "HrStateMachineArn", value=hr_state_machine.attr_arn)