# Recycling.EWasteKochi.com SAFE-DEEP + A2A Completion Runner

A dependency-free Node.js governance runner for completing a fresh
Recycling.EWasteKochi.com project with evidence-backed scoring and bounded
parallel work.

## What it does

- Freezes an exact 100-point launch scope.
- Creates persistent SAFE-DEEP project tracking.
- Executes declared verification commands.
- Captures timestamps, output, exit codes, and score evidence.
- Applies fail-closed score caps for critical defects.
- Keeps production-only requirements blocked until real evidence exists.
- Validates an A2A dependency graph before dispatch.
- Matches tasks to workers by declared capabilities.
- Limits parallelism.
- Treats all worker results as non-canonical candidate artifacts.
- Requires coordinator approval before canonical writes.
- Requires human authorization for external and destructive actions.
- Stops autonomous loops when no progress occurs.
- Exits successfully only at evidence-backed 100/100.

It does not create 100,000 pages automatically. The large URL universe remains
a candidate opportunity subject to local-value, recycler-verification,
serviceability, regulatory, price-provenance, uniqueness, and editorial gates.

## Files

```text
safe-deep-recycling.mjs
safe-deep.scope.example.json
work-plan.example.json
agents.example.json
lib/completeness.mjs
agent-output/a2a/
agent-output/adversarial/
test/
```

## Install in the real repository

Copy the bundle into the fresh project:

```text
tools/safe-deep/
```

Copy:

```text
safe-deep.scope.example.json → safe-deep.scope.json
work-plan.example.json       → work-plan.json
```

Replace placeholder `npm run ...` verifiers only with commands that genuinely
exist and prove the stated requirement.

## Commands

```bash
node tools/safe-deep/safe-deep-recycling.mjs validate \
  --scope tools/safe-deep/safe-deep.scope.json \
  --plan tools/safe-deep/work-plan.json

node tools/safe-deep/safe-deep-recycling.mjs init \
  --root . \
  --scope tools/safe-deep/safe-deep.scope.json

node tools/safe-deep/safe-deep-recycling.mjs audit \
  --root . \
  --scope tools/safe-deep/safe-deep.scope.json

node tools/safe-deep/safe-deep-recycling.mjs verify \
  --root . \
  --scope tools/safe-deep/safe-deep.scope.json

node tools/safe-deep/safe-deep-recycling.mjs dispatch \
  --root . \
  --scope tools/safe-deep/safe-deep.scope.json \
  --plan tools/safe-deep/work-plan.json

node tools/safe-deep/safe-deep-recycling.mjs loop \
  --root . \
  --scope tools/safe-deep/safe-deep.scope.json
```

## Controlled remediation

The runner never invents fixes. A criterion may opt into a deterministic
project-owned fix:

```json
{
  "fix": {
    "allowAutoFix": true,
    "command": "npm run fix:known-condition"
  }
}
```

Then use `loop --apply`.

Do not allowlist production deployment, credential operations, destructive
database changes, policy weakening, or uncontrolled dependency upgrades.

## A2A flow

```text
Coordinator
→ validates task DAG and capabilities
→ dispatches ready independent tasks
→ workers return content-addressed candidates
→ independent gates evaluate candidates
→ coordinator approves exact artifact hash
→ human authorizes external/destructive effects
→ canonical state changes
```

Agent output never becomes canonical merely because a task completed.

## Adversarial conformance

The adversarial suite covers:

- Fabricated recycler profiles
- Expired authorizations
- Inferred service areas
- Incomplete scrap prices
- Superseded regulations
- Unsafe damaged-battery listings
- Score inflation from route counts
- Unauthorized agent writes
- Cyclic A2A graphs
- Infinite no-progress loops

It intentionally fails closed until `SAFE_DEEP_ADAPTER` points to a real
project adapter:

```bash
SAFE_DEEP_ADAPTER=/absolute/path/to/real-adapter.mjs npm run test:adversarial
```

Mock or skipped conformance checks cannot earn the production gate.

## Honest exit behavior

- Exit `0`: valid configuration or verified 100/100.
- Exit `1`: incomplete, blocked, or no progress.
- Exit `2`: invalid scope/plan or runner error.

An unavailable production credential may justify an honest 99% handoff, but
never a false 100/100.

