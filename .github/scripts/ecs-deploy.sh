#!/usr/bin/env bash
# =============================================================================
# ECS Deploy — register new task definition revision and update service.
#
# Usage:
#   ./ecs-deploy.sh <task-family> <container-name> <image-uri> <service-name> <cluster>
#
# Example:
#   ./ecs-deploy.sh regain-deutschapi deutschapi \
#     907356469674.dkr.ecr.us-east-1.amazonaws.com/regain/deutsch-api:abc1234 \
#     regain-deutschapi regain-production
# =============================================================================

set -euo pipefail

TASK_FAMILY="${1:?Usage: ecs-deploy.sh <task-family> <container-name> <image-uri> <service-name> <cluster>}"
CONTAINER_NAME="${2:?Missing container name}"
IMAGE_URI="${3:?Missing image URI}"
SERVICE_NAME="${4:?Missing service name}"
CLUSTER="${5:?Missing cluster name}"

echo "==> Deploying ${SERVICE_NAME}"
echo "    Task family:  ${TASK_FAMILY}"
echo "    Container:    ${CONTAINER_NAME}"
echo "    Image:        ${IMAGE_URI}"
echo "    Cluster:      ${CLUSTER}"

# 1. Get current task definition
TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition "${TASK_FAMILY}" \
  --query 'taskDefinition')

# 2. Create new revision with updated image (and fix role ARNs for account migration)
ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
NEW_TASK_DEF=$(echo "${TASK_DEF}" | jq \
  --arg IMAGE "${IMAGE_URI}" \
  --arg CONTAINER "${CONTAINER_NAME}" \
  --arg ACCOUNT_ID "${ACCOUNT_ID}" \
  '(.containerDefinitions[] | select(.name == $CONTAINER)).image = $IMAGE |
   .executionRoleArn = (.executionRoleArn | sub("arn:aws:iam::[0-9]+:"; "arn:aws:iam::" + $ACCOUNT_ID + ":")) |
   .taskRoleArn = (.taskRoleArn | sub("arn:aws:iam::[0-9]+:"; "arn:aws:iam::" + $ACCOUNT_ID + ":")) |
   (.containerDefinitions[].secrets // [])[] |= (.valueFrom |= sub("arn:aws:secretsmanager:[^:]+:[0-9]+:"; "arn:aws:secretsmanager:us-east-1:" + $ACCOUNT_ID + ":")) |
   .runtimePlatform = {"cpuArchitecture": "ARM64", "operatingSystemFamily": "LINUX"} |
   del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
       .compatibilities, .registeredAt, .registeredBy)')

# 3. Register new task definition revision
NEW_ARN=$(aws ecs register-task-definition \
  --cli-input-json "${NEW_TASK_DEF}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "    New revision: ${NEW_ARN}"

# 4. Update service to use new task definition
aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${SERVICE_NAME}" \
  --task-definition "${NEW_ARN}" \
  --no-cli-pager > /dev/null

echo "    Service updated"
