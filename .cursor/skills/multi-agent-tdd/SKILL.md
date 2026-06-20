---
name: multi-agent-tdd
description: Use this skill for non-trivial coding tasks requiring investigation, planning, implementation, tests, verification, regression review, or autonomous execution.
disable-model-invocation: false
---

# Multi-Agent TDD Development Workflow

## Goal

Use specialized agents to investigate, plan, implement, test, verify, and review changes before reporting completion.

## Required agents

Use separate agents or separate reasoning passes for:

1. Investigator
   - Understand current codebase.
   - Find relevant files.
   - Identify existing conventions.
   - Identify hidden dependencies and prior assumptions.

2. Planner
   - Produce a small, staged implementation plan.
   - Define success criteria.
   - Identify likely edge cases.
   - Decide what tests should exist before implementation.

3. Test Designer
   - Create or update tests first when practical.
   - Cover expected behavior, edge cases, and regression cases.
   - Prefer focused tests over broad brittle tests.

4. Coder
   - Implement the smallest change that satisfies the plan.
   - Preserve existing APIs unless explicitly changing them.
   - Avoid unrelated refactors.

5. Verifier
   - Run relevant tests, type checks, lint, build, or smoke checks.
   - Inspect failures and determine whether they are caused by the change.

6. Regression Reviewer
   - Re-read the diff.
   - Look for unexpected side effects.
   - Check backward compatibility.
   - Check error handling.
   - Check race conditions, data loss, performance cliffs, security issues, and API contract breakage.

7. Reporter
   - Summarize final outcome.
   - Include changed files, tests run, known risks, and next steps.

## Execution protocol

For every non-trivial task:

1. Investigate
   - Read relevant docs and code.
   - Search for similar patterns.
   - Identify current behavior.

2. Plan
   - Write a short plan.
   - Define tests/checks.
   - Identify rollback path.

3. Test first when practical
   - Add failing tests for new behavior or bug reproduction.
   - If test-first is not practical, explain why and add verification after implementation.

4. Implement
   - Make minimal changes.
   - Avoid unrelated cleanup.

5. Verify
   - Run targeted tests.
   - Run broader tests when risk justifies it.
   - Fix failures caused by the change.

6. Regression review
   - Review final diff.
   - Check edge cases.
   - Check unexpected interactions.

7. Report
   - Provide concise completion report.

## Stop conditions

Stop and ask the user only when blocked by:
- required credentials
- paid APIs
- missing local data
- unavailable hardware
- destructive migration
- legal/security-sensitive decision
- product ambiguity that cannot be safely defaulted

## Final report format

Return:

- Summary
- Files changed
- Tests/checks run
- Regression review result
- Remaining risks
- Next recommended step
