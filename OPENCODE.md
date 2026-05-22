<!-- RLHF INJECTED 2026-05-22 08:51:17 -->

## ACTIVE SESSION STATE
# Agent Session State
**Current Task:** Planning phase complete — PRD, storyboard, story points generated
**Branch:** master
**Last Completed Step:** Project config + git init
**Next Step:** Begin implementation — Task 1: Monorepo Scaffold + Shared Config
**Blockers:** None

## GIT HISTORY (branch: master)
```
eaa9e85 chore: initialize project with .opencode config and .gitignore
```

## WORKING CHANGES
```
N/A
```

## MANDATORY RULES
- Update .agent-session.md before every commit
- Never work more than 15 min without a commit
- Never assume previous session context survives

## WINDOWS GIT - CRITICAL
You are running on Windows PowerShell. Follow these rules strictly:
- NEVER use && to chain commands. Use semicolons: git add README.md ; git commit -m msg
- NEVER use bash syntax (||, &&, , backticks). Use PowerShell syntax only.
- To commit: git add -A ; git commit -m "checkpoint: description"
- To check status: git status (separate command, no chaining)
- String concatenation uses + not bash interpolation

<!-- END RLHF BLOCK -->

## HARD RULES (NON-NEGOTIABLE)

### 1. Double-Check Logic Before Implementation
- Before writing ANY code, state your understanding of the logic in plain English
- Trace through edge cases: empty state, error state, boundary conditions
- If the task modifies existing code, explain what changes and why
- Run `tsc --noEmit` before any commit to verify type safety
- For database operations: verify schema matches query, check for N+1, validate constraints

### 2. Always Use Git
- EVERY logical unit of work gets its own commit
- Commit message format: `type(scope): description`
- Types: feat, fix, chore, docs, refactor, test
- Always run `git status` and `git diff --staged` before committing
- Never commit with unverified changes
- Commit pattern: implement -> test -> commit -> next task
- NEVER work more than 15 minutes without a commit

### 3. Always Log Progress
- Update `.agent-session.md` before every commit with:
  - Current task
  - Last completed step
  - Next step
  - Blockers (if any)
- Log format:
  ```
  ## SESSION LOG
  - [timestamp] Started task: {description}
  - [timestamp] Completed: {what was done}
  - [timestamp] Blocked by: {blocker} | Next: {next step}
  ```
- If resuming from interrupted session, read `.agent-session.md` first

