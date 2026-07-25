# Adversarial conformance proposal

Run the suite against a real adapter:

```bash
SAFE_DEEP_ADAPTER=/absolute/path/to/real-adapter.mjs \
  node --test agent-output/adversarial/adversarial.conformance.test.mjs
```

The command must run in CI and in the final 99-to-100 independent re-audit.
An absent adapter fails immediately. Tests must not be skipped when credentials
are missing; external-only cases belong in a separate deployment verification
suite, while these ten invariants are locally testable.

Recommended SAFE-DEEP scope criterion:

```json
{
  "id": "SEC-ADVERSARIAL",
  "area": "security-data-quality",
  "requirement": "All domain and orchestration adversarial tests pass.",
  "weight": 5,
  "tags": ["critical", "security", "publication-gate"],
  "verify": {
    "type": "command",
    "command": "npm run test:adversarial"
  }
}
```

Recommended package script:

```json
{
  "scripts": {
    "test:adversarial": "node --test agent-output/adversarial/adversarial.conformance.test.mjs"
  }
}
```

Do not set `SAFE_DEEP_ADAPTER` to `adapter.example.mjs` except to demonstrate
that unimplemented integrations fail closed.
