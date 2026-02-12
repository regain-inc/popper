# Popper -- Dual-Mode Architecture Tasks

> **Reference**: `/Users/macbookpro/development/deutsch/docs/deployment/unified-aws-architecture.md` (Section 13)
> **Date**: February 2026

---

## Overview

Popper requires **ZERO application code changes** for dual-mode architecture support.

Popper has no dependencies on Vault or Keycloak in application code:
- **Auth**: API key (SHA-256, DB-backed) + Better Auth (email/password for dashboard)
- **Service-to-service**: Deutsch -> Popper via API key (`supervision:write` scope)
- **PHI-blind**: receives opaque `subject_id` and `snapshot` references, never decrypts

All changes are limited to **Helm chart infrastructure** -- switching External Secrets Operator (ESO) from HashiCorp Vault to AWS Secrets Manager for the US deployment.

---

## Current State

### Helm Files

| File | Purpose |
|------|---------|
| `infra/helm/popper/values.yaml` | Default values, Vault config (`externalSecrets.vault.*`) |
| `infra/helm/popper/values-prod.yaml` | Production: `vault.server: vault.internal.regain.com`, `role: popper-prod` |
| `infra/helm/popper/values-staging.yaml` | Staging: ESO enabled, `environment: staging` |
| `infra/helm/popper/values-dev.yaml` | Dev: ESO disabled |
| `infra/helm/popper/templates/secret-store.yaml` | SecretStore CRD -- hardcoded Vault provider |
| `infra/helm/popper/templates/external-secret.yaml` | ExternalSecret CRD -- Vault KV v2 paths (`secret/data/popper/{env}/*`) |

### Secrets Pulled via ESO

| Secret | Vault Path |
|--------|-----------|
| `DATABASE_URL` | `secret/data/popper/{env}/core` |
| `REDIS_URL` | `secret/data/popper/{env}/core` |
| `POPPER_ADMIN_API_KEY` | `secret/data/popper/{env}/core` |
| `S3_ENDPOINT` | `secret/data/popper/{env}/s3` |
| `S3_ACCESS_KEY` | `secret/data/popper/{env}/s3` |
| `S3_SECRET_KEY` | `secret/data/popper/{env}/s3` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `secret/data/popper/{env}/observability` |

### CI/CD

- `ci.yml`: lint -> test -> regression (no deployment)
- `deploy-sa.yml`: deploys on `sa` branch push to KSA self-hosted runner via shell script

---

## Task List

> **Audit Date**: 2026-02-08
> **Audit Result**: 6/7 tasks completed and verified. Task 7 (AWS Secrets Manager provisioning) remains BLOCKED -- requires AWS access.
> **Final Audit**: PASS -- all template conditionals verified correct, no stale references found.

### TASK 1: Add `values-prod-us.yaml` for AWS deployment -- DONE

**File(s)**: `infra/helm/popper/values-prod-us.yaml` (new)

**What to do**:
Create a new values file for US (AWS) production deployment that configures ESO to use AWS Secrets Manager instead of Vault.

```yaml
# US Production overrides (AWS)
externalSecrets:
  enabled: true
  environment: "prod"
  provider: "aws"  # new field to switch provider
  refreshInterval: "1h"
  secretStoreRef:
    name: "aws-secretsmanager-backend"
    kind: "ClusterSecretStore"
  secretStore:
    create: true
  aws:
    region: "us-east-1"
    service: "SecretsManager"
    # Auth: IRSA (IAM Roles for Service Accounts) -- no static credentials

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: "arn:aws:iam::role/popper-prod-eso"
```

Secrets Manager path format: `popper/prod/core`, `popper/prod/s3`, `popper/prod/observability` (flat keys, no `secret/data/` prefix).

**Effort**: Small (1-2 hours)

---

### TASK 2: Update `secret-store.yaml` for conditional Vault / AWS SM -- DONE

**File(s)**: `infra/helm/popper/templates/secret-store.yaml`

**What to do**:
Currently hardcoded to Vault provider. Add conditional logic based on `.Values.externalSecrets.provider` to support both Vault (KSA) and AWS Secrets Manager (US).

**Current** (Vault-only):
```yaml
spec:
  provider:
    vault:
      server: {{ .Values.externalSecrets.vault.server | quote }}
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: {{ .Values.externalSecrets.vault.role | quote }}
          serviceAccountRef:
            name: {{ include "popper.serviceAccountName" . }}
```

**Target** (dual-mode):
```yaml
spec:
  provider:
    {{- if eq (.Values.externalSecrets.provider | default "vault") "aws" }}
    aws:
      service: {{ .Values.externalSecrets.aws.service | default "SecretsManager" }}
      region: {{ .Values.externalSecrets.aws.region | quote }}
      auth:
        jwt:
          serviceAccountRef:
            name: {{ include "popper.serviceAccountName" . }}
    {{- else }}
    vault:
      server: {{ .Values.externalSecrets.vault.server | quote }}
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: {{ .Values.externalSecrets.vault.role | quote }}
          serviceAccountRef:
            name: {{ include "popper.serviceAccountName" . }}
    {{- end }}
```

**Effort**: Small (1-2 hours)

---

### TASK 3: Update `external-secret.yaml` for AWS SM path format -- DONE

**File(s)**: `infra/helm/popper/templates/external-secret.yaml`

**What to do**:
Currently uses Vault KV v2 paths (`secret/data/popper/{env}/core`). AWS Secrets Manager uses flat paths (`popper/{env}/core`). Add conditional logic for the `remoteRef.key` format.

**Current** (Vault paths):
```yaml
- secretKey: DATABASE_URL
  remoteRef:
    key: secret/data/popper/{{ .Values.externalSecrets.environment }}/core
    property: DATABASE_URL
```

**Target** (dual-mode):
```yaml
{{- $prefix := ternary "" "secret/data/" (eq (.Values.externalSecrets.provider | default "vault") "aws") }}
...
- secretKey: DATABASE_URL
  remoteRef:
    key: {{ $prefix }}popper/{{ .Values.externalSecrets.environment }}/core
    property: DATABASE_URL
```

Alternatively, introduce a `.Values.externalSecrets.pathPrefix` value that defaults to `secret/data/` for Vault and is empty string for AWS SM.

Also: AWS Secrets Manager stores all keys in a single JSON secret, so `property` works the same way (ESO extracts JSON keys). No change needed for `property` fields.

**Effort**: Small (1-2 hours)

---

### TASK 4: Update `values.yaml` defaults with provider field -- DONE

**File(s)**: `infra/helm/popper/values.yaml`

**What to do**:
Add `provider` field and `aws` section to `externalSecrets` defaults, keeping Vault as the default provider for backwards compatibility.

Add to `externalSecrets`:
```yaml
externalSecrets:
  enabled: false
  environment: "dev"
  provider: "vault"         # NEW: "vault" (default) or "aws"
  refreshInterval: "1h"
  secretStoreRef:
    name: "vault-backend"
    kind: "ClusterSecretStore"
  secretStore:
    create: false
  vault:                     # existing
    server: "https://vault.example.com"
    role: "popper-dev"
  aws:                       # NEW
    region: "us-east-1"
    service: "SecretsManager"
```

**Effort**: Minimal (30 min)

---

### TASK 5: Rename `values-prod.yaml` to `values-prod-ksa.yaml` -- DONE

**File(s)**:
- `infra/helm/popper/values-prod.yaml` -> `infra/helm/popper/values-prod-ksa.yaml`
- Update any references in CI/CD or documentation

**What to do**:
Rename the existing production values file to explicitly indicate it is for the KSA deployment. This prevents ambiguity now that there are two production environments. Add `provider: "vault"` explicitly.

Check `deploy-sa.yml` and any Helm install/upgrade commands that reference `values-prod.yaml`.

**Effort**: Minimal (30 min)

---

### TASK 6: Add `deploy-us.yml` CI/CD workflow -- DONE

**File(s)**: `.github/workflows/deploy-us.yml` (new)

**What to do**:
Create a GitHub Actions workflow for deploying to US (AWS ECS Fargate). Unlike KSA which uses self-hosted runner + shell script, US deployment should:

1. Build and push Docker image to ECR via OIDC (no long-lived credentials)
2. Deploy to ECS using `aws ecs update-service` or Helm (if EKS is used)
3. Set `DEPLOY_REGION=us` as env variable
4. Use `values-prod-us.yaml` for Helm values

Key env variables:
```yaml
env:
  DEPLOY_REGION: us
  AWS_REGION: us-east-1
```

Note: The exact deployment mechanism depends on whether Popper uses ECS Fargate (as described in the architecture doc) or EKS. If ECS Fargate, Helm charts are not used directly -- the ESO templates are for a potential EKS setup. Clarify with the team which orchestrator is used in US.

**Effort**: Medium (4-6 hours, depends on ECS vs EKS decision)

---

### TASK 7: Create AWS Secrets Manager entries -- BLOCKED (requires AWS access)

**File(s)**: N/A (AWS Console / Terraform / CDK)

**What to do**:
Provision the following secrets in AWS Secrets Manager (us-east-1) to match the Vault structure:

| SM Secret Name | Keys |
|---------------|------|
| `popper/prod/core` | `DATABASE_URL`, `REDIS_URL`, `POPPER_ADMIN_API_KEY` |
| `popper/prod/s3` | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| `popper/prod/observability` | `OTEL_EXPORTER_OTLP_ENDPOINT` |

Each secret is a JSON object with the keys as properties.

Also create the IAM policy for the ESO service account:
```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:popper/prod/*"
}
```

**Effort**: Small (1-2 hours)

---

## Summary

| # | Task | Files | Effort | Status |
|---|------|-------|--------|--------|
| 1 | Add `values-prod-us.yaml` | 1 new file | Small | DONE |
| 2 | Update `secret-store.yaml` (conditional provider) | 1 file | Small | DONE |
| 3 | Update `external-secret.yaml` (path format) | 1 file | Small | DONE |
| 4 | Update `values.yaml` defaults | 1 file | Minimal | DONE |
| 5 | Rename `values-prod.yaml` -> `values-prod-ksa.yaml` | 1 file + refs | Minimal | DONE |
| 6 | Add `deploy-us.yml` workflow | 1 new file | Medium | DONE |
| 7 | Create AWS Secrets Manager entries | AWS infra | Small | BLOCKED (AWS) |

**Total effort**: ~1-2 days of DevOps work

**Order of execution**: 4 -> 2 -> 3 -> 5 -> 1 -> 7 -> 6

---

*No application code changes required. All changes are Helm/infrastructure only.*

---

## Audit Log

### 2026-02-08 -- Initial Audit

**Result**: 0/7 tasks completed. No dual-mode work has been started on Popper.

**Evidence**:
- `values-prod-us.yaml` -- does not exist
- `values-prod-ksa.yaml` -- does not exist (`values-prod.yaml` not renamed)
- `deploy-us.yml` -- does not exist (only `ci.yml` and `deploy-sa.yml` present)
- `secret-store.yaml` -- still hardcoded Vault provider (no conditional logic)
- `external-secret.yaml` -- still uses hardcoded `secret/data/` Vault KV v2 prefix
- `values.yaml` -- no `provider` field, no `aws` section in `externalSecrets`
- No AWS-related strings found in any Helm files
- Recent git history (20 commits) shows no dual-mode related changes; latest work was SA deployment, Docker fixes, OTEL config

### 2026-02-08 -- Implementation

**Result**: 6/7 tasks completed.

**Changes made**:
- **TASK 4**: `values.yaml` -- added `provider: "vault"` field and `aws:` section to `externalSecrets` defaults
- **TASK 2**: `secret-store.yaml` -- added conditional logic: `aws` provider (JWT/IRSA auth) vs `vault` provider (Kubernetes auth)
- **TASK 3**: `external-secret.yaml` -- added `$prefix` variable via `ternary`: empty for AWS SM, `secret/data/` for Vault
- **TASK 5**: `values-prod.yaml` renamed to `values-prod-ksa.yaml`, added explicit `provider: "vault"`
- **TASK 1**: Created `values-prod-us.yaml` with AWS SM config, IRSA annotation, `provider: "aws"`
- **TASK 6**: Created `deploy-us.yml` -- OIDC auth, ECR push, Helm deploy to EKS, triggers on `us` branch
- **TASK 7**: BLOCKED -- requires AWS Console/Terraform access to provision secrets

### 2026-02-08 -- Final Audit

**Result**: 6/7 tasks verified. All file-level tasks (1-6) are correctly implemented. Task 7 remains BLOCKED (requires AWS access).

**Verification details**:

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1 | `values-prod-us.yaml` | PASS | File exists with `provider: "aws"`, IRSA annotation, SecretsManager config, correct ingress `popper-api.us.regain.com` |
| 2 | `secret-store.yaml` conditional | PASS | Conditional `{{- if eq (.Values.externalSecrets.provider \| default "vault") "aws" }}` correctly branches between AWS (JWT/IRSA) and Vault (Kubernetes auth) |
| 3 | `external-secret.yaml` path prefix | PASS | `$isAws` variable + `ternary` produces empty prefix for AWS SM, `secret/data/` for Vault. All 7 secret keys use `$prefix` correctly |
| 4 | `values.yaml` defaults | PASS | `provider: "vault"` (line 119), `aws:` block with `region` and `service` (lines 129-131) |
| 5 | Rename `values-prod.yaml` | PASS | Old file gone, `values-prod-ksa.yaml` exists with explicit `provider: "vault"` and Vault server/role config |
| 6 | `deploy-us.yml` workflow | PASS | OIDC auth, ECR push (server + queue), EKS Helm deploy using `values-prod-us.yaml`, triggers on `us` branch, rollout verification |
| 7 | AWS Secrets Manager entries | BLOCKED | Requires AWS Console/Terraform access -- no files to verify |

**Template correctness checks**:
- `secret-store.yaml`: `{{- if eq ... "aws" }}` guard is correct; default falls through to Vault
- `external-secret.yaml`: `ternary` argument order is correct (`""` for true/aws, `"secret/data/"` for false/vault)
- `deploy-us.yml`: Helm command correctly layers `values.yaml` + `values-prod-us.yaml`; uses `--set image.tag` for both server and queue worker
- `deploy-sa.yml`: Uses shell script, not Helm directly -- no stale `values-prod.yaml` reference
- No remaining references to `values-prod.yaml` in any non-documentation file

**No issues found.**
