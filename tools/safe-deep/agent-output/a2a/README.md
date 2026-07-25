# SAFE-DEEP A2A Runtime

Dependency-free Node.js module for validating and scheduling bounded sub-agent work.

```bash
node --test agent-output/a2a/a2a-runtime.test.mjs
```

The runtime enforces a valid dependency DAG, explicit agent capabilities,
deterministic priority/ID ordering, concurrency limits, risk-derived
authorization, candidate-only agent outputs, coordinator-gated canonical
writes, human authorization for external/destructive work, and JSONL events.

The `canonicalWriter` callback is the only canonical write boundary. Production
adapters must implement that callback transactionally and preserve the supplied
artifact hash and approval receipt.
