# Work Plan: Project Configuration — LSP, Versioning, Logging, Git Init

## TL;DR
> Enable Language Server Protocol (TypeScript), git versioning, and session logging for the Discord → Global Relay Bridge project. Initialize git repository.

## Context
The project workspace at `D:\Projects\DiscordToGlobalRelay` has no `.opencode/` configuration, no git repository, and no logging setup. This plan enables all three foundational capabilities.

## Work Objectives
1. Create `.opencode/opencode.jsonc` with LSP, versioning, and logging enabled
2. Initialize git repository with `.gitignore`
3. Create initial commit for the project structure

---

## TODOs

- [ ] 1. Create `.opencode/` directory and `opencode.jsonc`

  **What to do**:
  1. Create directory: `D:\Projects\DiscordToGlobalRelay\.opencode\`
  2. Create `opencode.jsonc` with these settings:
     ```jsonc
     {
       "$schema": "https://opencode.ai/config.json",
       "lsp": {
         "enabled": true
       },
       "versioning": {
         "enabled": true,
         "git": {
           "autoStage": true,
           "commitConvention": "conventional"
         }
       },
       "logging": {
         "enabled": true,
         "dir": ".opencode/logs",
         "level": "info",
         "retention": {
           "maxFiles": 10,
           "maxSizeMb": 50
         }
       },
       "plugin": [
         "code-simplifier",
         "oh-my-opencode"
       ]
     }
     ```
  3. Create `.opencode/.gitkeep` to track the directory

  **QA Scenarios**:
  ```
  Scenario: Verify opencode.jsonc exists and is valid JSON
    Tool: Bash
    Steps:
      1. Test-Path -LiteralPath "D:\Projects\DiscordToGlobalRelay\.opencode\opencode.jsonc"
      2. Get-Content -LiteralPath "D:\Projects\DiscordToGlobalRelay\.opencode\opencode.jsonc" | ConvertFrom-Json
    Expected Result: File exists and parses as valid JSON
    Evidence: .sisyphus/evidence/task-1-opencode-config.txt
  ```

- [ ] 2. Initialize git repository

  **What to do**:
  1. Run: `cd D:\Projects\DiscordToGlobalRelay && git init`
  2. Verify `.git` directory created:
     Run: `Test-Path -LiteralPath "D:\Projects\DiscordToGlobalRelay\.git"`
  3. Check git status: `git status`

  **QA Scenarios**:
  ```
  Scenario: Git repo initialized
    Tool: Bash
    Steps:
      1. Test-Path -LiteralPath "D:\Projects\DiscordToGlobalRelay\.git"
      2. git rev-parse --git-dir
    Expected Result: .git directory exists, git-dir returns correct path
    Evidence: .sisyphus/evidence/task-2-git-init.txt
  ```

- [ ] 3. Create `.gitignore` and initial commit

  **What to do**:
  1. Create `.gitignore` with:
     ```
     node_modules/
     dist/
     .env
     *.db
     *.db-journal
     .next/
     .opencode/logs/
     ```
  2. Stage files: `git add -A`
  3. Commit: `git commit -m "chore: initialize project with .opencode config and .gitignore"`

  **QA Scenarios**:
  ```
  Scenario: Initial commit created
    Tool: Bash
    Steps:
      1. git log --oneline -1
      2. Check git status is clean
    Expected Result: One commit exists, working tree clean
    Evidence: .sisyphus/evidence/task-3-git-commit.txt
  ```

---

## Verification
- [ ] `Test-Path .opencode/opencode.jsonc` → True
- [ ] `Test-Path .git` → True
- [ ] `git log --oneline | Measure-Object | Select-Object -ExpandProperty Count` → ≥ 1
- [ ] `git status --porcelain` → empty (clean working tree)
