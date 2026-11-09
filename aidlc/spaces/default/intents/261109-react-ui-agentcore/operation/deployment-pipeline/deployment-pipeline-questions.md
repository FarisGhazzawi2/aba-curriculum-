# Deployment Pipeline Questions

Context: the repo has no CI/CD today. Deployment is manual: the build scripts run, then `cdk deploy`, from one AWS account (`hrAgent/agentcore/aws-targets.json`). The new `HrLeavePortalUi` stack is static hosting (S3 + CloudFront), so each deploy is an all-at-once swap of files plus a cache invalidation. Blue/green and canary don't apply to it.

## Q1. [release engineer] How should UI deployments be run?

A. A single repeatable script, `scripts/deploy_ui.sh`, run by a person. It does `npm ci`, lint, the unit tests, `npm run build`, the CDK tests, `cdk deploy HrLeavePortalUi`, then a smoke check of the CloudFront URL. This matches how the project deploys today and adds no new accounts or permissions.
B. A GitHub Actions workflow (OIDC role into AWS) that runs the same steps on every push to `master`. This needs a new IAM role and repo secrets/variables.
C. CDK Pipelines / CodePipeline in AWS, self-mutating from the repo.
X. Other (please specify)

[Answer]:

## Q2. [release engineer] Which environments and approval gates?

A. One environment (the current account and region), deployed by the person running it. That run is the approval.
B. Two environments (dev and prod), deploying to dev automatically and to prod only after a manual approval. Each environment needs its own backend stacks.
X. Other (please specify)

[Answer]:
