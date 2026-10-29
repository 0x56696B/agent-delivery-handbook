---
name: deployed-version-check
description: Use when the user asks which tag, version, or commit is currently deployed to an environment (QA by default) for a service of the platform — covers the split build-vs-deploy pipeline pattern, the container-tag vs zip-deploy split across the 5 in-scope repos, and cross-checking Azure DevOps pipeline history against the live Azure App Service config. Returns a structured per-repo report.
---

## Input

Repo name, or none for all 5 known repos. Environment name, defaulting to
QA if the user doesn't say. Known repos: `orchestrator`,
`data-mcp`, `media-mcp`, `file-gateway`,
`web-app`. `legacy-agent` is a standing exclusion (see
`ticket-bootstrap` Step 4 — retired in favor of
`orchestrator`); never add it. `other-api` is a real repo in
the same ADO project but out of this skill's scope — ask the user before
adding it.

## Step 1 — Find both pipeline definitions per repo

MCP tool `pipelines_definition`, action `list`, `repositoryId: "<repo>"`,
`repositoryType: "TfsGit"`, `project: "<ADO_PROJECT>"`. Two of the five
known repos return two definitions sharing a base name:

- **Unsuffixed** (e.g. `data-mcp`, `file-gateway`) — builds on
  every `main` push but is condition-gated to skip the push/restart step.
  Looks like a deploy pipeline in its run history; never touches the live
  app. Skip it.
- **`(id)`-suffixed** (e.g. `data-mcp (<PIPELINE_ID>)`,
  `file-gateway (<PIPELINE_ID>)`) — fires only on a git tag, actually pushes
  the image and restarts the App Service. Use this one.

`orchestrator-deploy` and `media-mcp-deploy` are single
pipelines with per-environment stages instead of two definitions; each
stage is individually condition-gated on the tag pattern. `web-app`
has dedicated per-environment pipelines (`web-app-qa`,
`web-app-dev`, `web-app-prd`) instead.

## Step 2 — Known trigger pattern per repo

Verify against the pipeline's YAML before trusting this table — it can go
stale. The tag patterns and image tags below are examples of the shapes this
step looks for; read the real values from each pipeline's YAML.

| Repo | Real deploy pipeline (QA) | QA trigger | Image tag pushed | Deploy mechanism |
|---|---|---|---|---|
| `orchestrator` | `orchestrator-deploy`, stage `build_container_image_qa` | git tag `v*` | `<tag>` and `latest` | container, pinned to `:latest` |
| `media-mcp` | `media-mcp-deploy`, stage `build_container_image_qa` | git tag `v*` | `<tag>` and `latest` | container, pinned to `:latest` |
| `data-mcp` | `data-mcp (<PIPELINE_ID>)` | git tag `qa-*` | static literal `qa-latest` | container, pinned to `:qa-latest` |
| `file-gateway` | `file-gateway (<PIPELINE_ID>)` | git tag `qa-*` | static literal `main` | container, pinned to `:main` |
| `web-app` | `web-app-qa` | push to `qa` branch | n/a | zip deploy, not a container |

For `data-mcp` and `file-gateway` the pushed image tag never
changes — the git tag that triggered the build is the only way to know
which commit currently backs it.

## Step 3 — Find the latest successful triggering build

MCP tool `pipelines_build`, action `list`, `project: "<ADO_PROJECT>"`,
`definitions: [<real-deploy-pipeline-id>]`, `top: 15`,
`queryOrder: "finishTimeDescending"`, `resultFilter: 2` (2 = Succeeded).

Read the first result's `sourceBranch` — it must match the Step 2 trigger
pattern (e.g. `refs/tags/v2.0.0`, `refs/heads/qa`). A `refs/heads/main`
entry means the tool returned the wrong (unsuffixed) pipeline's history;
skip it. Read `triggerInfo.ci.message` for the merge/release commit
message — useful for `web-app`'s "Release to QA X.Y.Z" convention. If
the top result doesn't match the pattern, page through more (`top: 30`+);
some repos push to QA rarely, and the last real deploy can be months old.

## Step 4 — Cross-check the live App Service

No Azure DevOps or Azure MCP tool reads an App Service's live container
config. Use `az` directly — this is the "no MCP tool exposes this action"
exception in the Azure CLI fallback rule, not the login-retry exception.

    az account set --subscription <SUBSCRIPTION_ID>
    az rest --method get --url "https://management.azure.com/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<rg>/providers/Microsoft.Web/sites/<app>?api-version=2023-12-01" \
      --query "properties.siteConfig.linuxFxVersion" -o tsv

`<SUBSCRIPTION_ID>` is the QA subscription
(`<QA_SUBSCRIPTION_NAME>`). `az rest` against the plain `sites` resource needs
only `Microsoft.Web/sites/read` — it works even when the caller lacks the
`config/list` or `publishxml` actions that `az webapp config container
show` / `az webapp show` require. Prefer it over those two commands for
that reason.

Resource group and app names per repo (`<REGION>` region, QA). Look the real
names up in the service registry page or the infra repo; the placeholders below
mark where each one goes:

| Repo | Resource group | App Service |
|---|---|---|
| `orchestrator` | `<RESOURCE_GROUP_ORCHESTRATOR_QA>` | `<APP_SERVICE_ORCHESTRATOR_QA>` |
| `media-mcp` | `<RESOURCE_GROUP_MEDIA_MCP_QA>` | `<APP_SERVICE_MEDIA_MCP_QA>` |
| `data-mcp` | `<RESOURCE_GROUP_DATA_MCP_QA>` | `<APP_SERVICE_DATA_MCP_QA>` |
| `file-gateway` | `<RESOURCE_GROUP_FILE_GATEWAY_QA>` | `<APP_SERVICE_FILE_GATEWAY_QA>` |
| `web-app` | `<RESOURCE_GROUP_WEB_APP_QA>` | `<APP_SERVICE_WEB_APP_QA>` |

The result is `DOCKER|<acr-login>.azurecr.io/<image>:<tag>` for containers,
or a runtime string like `NODE|20-lts` for `web-app` — confirming it
is not a container at all; do not look for an image tag there.

If `az rest` fails with `AuthorizationFailed`, the caller's own identity
lacks even `Microsoft.Web/sites/read` on that resource group. Do not retry
with `az webapp show` or `az webapp config container show` — both need
*more* permissions, not less, so they fail the same way. Report the gap and
fall back to Step 3's pipeline-history evidence alone, marked lower
confidence.

## Step 5 — Report in this exact format

One YAML block per repo, not prose:

    <repo-name>:
      deploy_pipeline: { id: <int>, name: "<pipeline name>" }
      trigger: "<git tag pattern | branch push>"
      image_tag_pushed: "<tag>"          # omit for zip-deploy repos
      live_app_service_config: "<linuxFxVersion string>"   # or "blocked: <reason>"
      current_qa_version: "<the answer>"
      evidence_build: { id: <int>, ref: "<sourceBranch>", result: succeeded, finished: "<date>" }
      confidence: high | medium | low
      notes: "<anything that qualifies the answer, e.g. stale evidence>"

Set `confidence: medium` or lower whenever Step 3's evidence build is more
than a few weeks old, or Step 4 was blocked by RBAC. State the reason in
`notes` either way — never present a stale or unverified answer as `high`
confidence silently.

## Boundaries

- Read-only. Never modify a pipeline, App Service config, or Terraform
  state from this skill.
- `legacy-agent` is a standing exclusion — never add it, even if its
  repo/pipeline data looks relevant. `other-api` is out of scope by
  default — ask the user before adding it.
- After a full five-repo run, offer to refresh the deployed columns of
  `vault://wiki/notes/service-registry.md` with today's date. Never write
  that page without the user's word.
