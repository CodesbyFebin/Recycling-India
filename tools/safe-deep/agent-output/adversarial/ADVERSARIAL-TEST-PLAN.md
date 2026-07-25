# Recycling.EWasteKochi.com — SAFE-DEEP Adversarial Test Plan

## Purpose

This suite tests the conditions under which the SAFE-DEEP runner must refuse
publication, marketplace activation, score credit, or autonomous continuation.
It is a conformance specification, not a substitute for integration tests
against PostgreSQL, queues, deployed pages, or external providers.

## Required runner adapter

The proposed Node suite loads an adapter from `SAFE_DEEP_ADAPTER`. The adapter
must expose:

```js
export async function createHarness(options) {
  return {
    recycler: {
      ingest(record),
      publish(id),
      get(id)
    },
    pages: {
      propose(manifest),
      publish(id),
      get(id)
    },
    prices: {
      ingest(observation),
      publish(id)
    },
    regulations: {
      ingest(record),
      publish(id)
    },
    marketplace: {
      submitListing(record),
      activate(id)
    },
    scoring: {
      evaluate(scope)
    },
    agents: {
      issue(identity),
      write(agent, command)
    },
    a2a: {
      submit(graph),
      run(id)
    },
    completion: {
      run(options)
    }
  };
}
```

Every operation should return a serializable result containing at least
`status`, `reasons`, and relevant artifact identifiers. Rejected operations
must not leave publishable or active records behind.

## Blocking test matrix

| ID | Threat | Attack | Required result |
|---|---|---|---|
| ADV-01 | Fabricated recycler | Submit a plausible recycler with no legal identity, facility evidence, authorization, or source snapshots | `BLOCKED_EVIDENCE`; no public profile |
| ADV-02 | Stale authorization | Submit a recycler whose authorization expired before verification time | `BLOCKED_STALE_AUTHORIZATION`; authorization badge absent |
| ADV-03 | Service-area inference | Infer Kochi pickup coverage from a Kerala address | `BLOCKED_UNVERIFIED_SERVICE_AREA`; no “serves Kochi” claim |
| ADV-04 | Price misinformation | Publish a bare copper price without grade, unit, currency, location, observation time, or source | `BLOCKED_INVALID_PRICE_OBSERVATION` |
| ADV-05 | Regulatory staleness | Publish compliance advice based on a superseded rule snapshot | `BLOCKED_STALE_REGULATION`; no prescriptive guidance |
| ADV-06 | Marketplace safety | Offer damaged lithium batteries through ordinary doorstep collection with no dangerous-goods controls | `BLOCKED_SAFETY`; listing remains inactive |
| ADV-07 | Score inflation | Satisfy criteria with empty/generated files, self-attestation, duplicated evidence, or route count alone | No credit; critical cap applied; score below exit gate |
| ADV-08 | Unauthorized agent write | Research agent attempts to publish or mutate approved evidence | `DENIED_CAPABILITY`; canonical state unchanged; audit event emitted |
| ADV-09 | Cyclic A2A graph | A delegates to B, B to C, and C back to A | Graph rejected before execution with explicit cycle path |
| ADV-10 | No-progress loop | Completion loop repeats unchanged failures/remediation | Stop after configured threshold; `NO_PROGRESS`; non-zero exit |

## Domain invariants

### Recycler identity and authorization

- A company name is not proof of a legal entity.
- A directory listing, social profile, map pin, or user submission is not proof
  of recycler authorization.
- Authorization is scoped by issuing authority, authorization number, waste
  category, facility, jurisdiction, issue date, expiry date, and source
  snapshot.
- “Authorized recycler” must not be derived from a generic pollution-control
  registration or unrelated permit.

### Location and service area

- Registered address, facility location, pickup area, and serviceable area are
  distinct properties.
- State-level presence never implies city-, district-, or neighborhood-level
  pickup.
- “Near me” pages require verified facility or service-area evidence and must
  not fabricate distance, operating hours, capacity, or contact information.

### Scrap-price observations

A publishable price observation requires:

- material and normalized material identifier;
- grade/specification and condition;
- price amount represented in integer minor or micro units;
- currency and unit of measure;
- market/location and whether pickup/transport is included;
- observed time and freshness policy;
- source identity, source snapshot hash, and verification state;
- an explicit indication that the value is an observation/indicative quote,
  not a guaranteed transaction price.

### Regulations

- Every regulatory claim binds to jurisdiction, instrument, version,
  effective date, source passage, and retrieval timestamp.
- Superseded or expired material can be retained for history but cannot support
  current prescriptive compliance guidance.
- Legal conclusions require the configured human/editorial gate.

### Marketplace safety

- Hazardous, swollen, leaking, recalled, damaged, or high-energy batteries
  cannot enter a generic parcel or pickup workflow.
- Seller and buyer eligibility, waste category, transporter requirements,
  custody records, data-erasure requirements, and facility authorization must
  be policy-evaluated before activation.
- Payment, pickup, contact disclosure, and lead routing are side effects and
  require authorization, idempotency, and audit receipts.

## Scoring invariants

- Evidence must be requirement-specific, independently verifiable, fresh, and
  content-bearing.
- One artifact cannot silently satisfy unrelated criteria.
- Empty files, screenshots of dashboards, generated manifests, route counts,
  self-authored claims, and unexecuted test files earn zero.
- Partial command success cannot be rounded to full credit.
- Any critical identity, authorization, safety, tenant isolation, publication
  gate, or audit-integrity failure applies the configured score cap.
- `99/100` is not equivalent to `100/100`; exit code zero is reserved for
  reproducibly verified `100/100`.

## A2A and autonomous-loop invariants

- Every task has a stable ID, owner, allowed capabilities, inputs, outputs,
  dependency IDs, retry budget, cost budget, and deadline.
- The task graph must be acyclic before dispatch.
- Delegation depth and fan-out are bounded.
- Agents produce proposed artifacts; only authorized engines commit canonical
  state.
- A repeated state hash with no newly verified criterion increments the
  no-progress counter.
- The runner stops when the threshold, retry budget, or cost budget is
  exhausted and records the unresolved blockers.

## Acceptance

The adversarial gate passes only when all ten tests pass against the real
adapter. Skipped tests, placeholder adapters, mock-only storage, or asserted
production outcomes do not satisfy the gate.

