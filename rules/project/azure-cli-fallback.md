---
alwaysApply: true
description: Azure CLI fallback when Azure DevOps MCP commands fail
---

# Azure CLI fallback for failed Azure DevOps commands

Use this rule for every task in this project.

## When to use the Azure CLI

Use the Azure CLI (`az`) only to log in, and only after an Azure DevOps MCP
command or an Azure MCP command fails.

Do not use the Azure CLI for any operation that the Azure MCP server or the
Azure DevOps MCP server already provides. Examples of blocked uses: work item
reads or writes, pull request operations, pipeline operations, repository
reads, wiki operations, and resource or subscription queries. Route all of
these through the matching MCP tool, not through `az`.

## Exception: no MCP tool covers the operation

Use `az` directly, not only for login, when no mounted MCP tool exposes the
action at all. Confirm this by name, not by guess: check the tool list for a
matching action before you reach for `az`.

Example: the Azure DevOps PR thread MCP tool has no delete action for a
posted comment. `pr-review/SKILL.md` uses `az devops invoke --area git
--resource pullRequestThreadComments --http-method DELETE` for that one
case. This is correct under this rule, because no MCP substitute exists, not
because the MCP tool failed.

This exception is narrow. It covers a missing action on an otherwise-present
MCP tool. It does not cover a failed call to an action the MCP tool does
expose; use the login fallback below for that case instead.

## Default login command

Run this command to log in:

```bash
az login --tenant $CLIENT_AZURE_TENANT_ID --subscription $CLIENT_AZURE_SUB_ID_AI_DEV
```

This command reads the tenant ID and the subscription ID from environment
variables. Set `CLIENT_AZURE_TENANT_ID` and `CLIENT_AZURE_SUB_ID_AI_DEV` in
the shell before you run it. Do not hardcode the tenant ID or the
subscription ID in a command you run or a file you write.

Look up the current tenant ID and subscription ID on
`vault://wiki/projects/infra.md` before you set the
environment variables. That page is the source of truth; do not copy a
previously seen value into a command or a file instead of reading the page.

## After login

Retry the original MCP command once the CLI login succeeds. Report the login
step and the retry result to the user. Do not silently swap an MCP call for
a permanent `az` command; the CLI login is a one-time recovery step, not a
replacement workflow.
