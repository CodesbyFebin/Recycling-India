import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

const adapterPath = process.env.SAFE_DEEP_ADAPTER;
if (!adapterPath) {
  throw new Error(
    "SAFE_DEEP_ADAPTER must point to the real runner adapter. " +
    "Mock-only or skipped adversarial tests do not satisfy the production gate."
  );
}

const adapter = await import(pathToFileURL(adapterPath).href);
assert.equal(typeof adapter.createHarness, "function");

function includesReason(result, expected) {
  const reasons = result?.reasons ?? [];
  return reasons.some((reason) =>
    typeof reason === "string"
      ? reason.includes(expected)
      : `${reason?.code ?? ""} ${reason?.message ?? ""}`.includes(expected)
  );
}

function assertBlocked(result, status, reason) {
  assert.equal(result.status, status);
  assert.equal(includesReason(result, reason), true, JSON.stringify(result));
}

test("ADV-01 fabricated recycler cannot become public", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const candidate = await h.recycler.ingest({
    name: "Kerala Green Circular Recycling Pvt Ltd",
    slug: "kerala-green-circular-recycling",
    claimedAuthorizations: ["CPCB AUTHORIZED"],
    address: "Kochi, Kerala",
    phone: "+91-0000000000",
    sources: []
  });
  const result = await h.recycler.publish(candidate.id);
  assertBlocked(result, "BLOCKED_EVIDENCE", "LEGAL_IDENTITY_UNVERIFIED");
  assert.notEqual((await h.recycler.get(candidate.id)).status, "PUBLISHED");
});

test("ADV-02 expired authorization cannot support an authorization badge", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const candidate = await h.recycler.ingest({
    name: "Historical Recycler",
    legalIdentityEvidence: { verified: true, snapshotHash: "sha256:legal" },
    authorizations: [{
      authority: "State Pollution Control Board",
      authorizationNumber: "AUTH-123",
      wasteCategories: ["E_WASTE"],
      facilityId: "facility-1",
      validFrom: "2023-01-01",
      expiresAt: "2025-12-31",
      sourceSnapshotHash: "sha256:expired"
    }]
  });
  const result = await h.recycler.publish(candidate.id);
  assertBlocked(result, "BLOCKED_STALE_AUTHORIZATION", "AUTHORIZATION_EXPIRED");
  const stored = await h.recycler.get(candidate.id);
  assert.equal(stored.badges?.includes("AUTHORIZED_RECYCLER") ?? false, false);
});

test("ADV-03 address must not be promoted into an inferred service area", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const page = await h.pages.propose({
    type: "LOCAL_RECYCLER",
    city: "Kochi",
    recycler: {
      id: "recycler-kerala",
      registeredAddress: { state: "Kerala", city: "Thiruvananthapuram" },
      verifiedServiceAreas: []
    },
    claims: [{ predicate: "SERVES_CITY", object: "Kochi", derivedFrom: "STATE_ADDRESS" }]
  });
  const result = await h.pages.publish(page.id);
  assertBlocked(result, "BLOCKED_UNVERIFIED_SERVICE_AREA", "SERVICE_AREA_INFERRED");
  assert.notEqual((await h.pages.get(page.id)).status, "PUBLISHED");
});

test("ADV-04 incomplete scrap-price observations are unpublishable", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const observation = await h.prices.ingest({
    material: "Copper scrap",
    price: 700
  });
  const result = await h.prices.publish(observation.id);
  assertBlocked(result, "BLOCKED_INVALID_PRICE_OBSERVATION", "PRICE_PROVENANCE_INCOMPLETE");
});

test("ADV-05 superseded regulation cannot support current compliance guidance", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const regulation = await h.regulations.ingest({
    jurisdiction: "IN",
    instrument: "Example Waste Rules",
    version: "2022",
    effectiveAt: "2022-01-01",
    supersededAt: "2025-04-01",
    sourceSnapshotHash: "sha256:old-rule",
    proposedGuidance: "Businesses must currently follow the 2022 process."
  });
  const result = await h.regulations.publish(regulation.id);
  assertBlocked(result, "BLOCKED_STALE_REGULATION", "REGULATION_SUPERSEDED");
});

test("ADV-06 unsafe damaged-battery listing cannot activate", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const listing = await h.marketplace.submitListing({
    category: "LITHIUM_ION_BATTERY",
    condition: ["DAMAGED", "SWOLLEN"],
    quantity: { value: 20, unit: "kg" },
    fulfillment: "ORDINARY_DOORSTEP_PICKUP",
    packagingPlan: null,
    authorizedTransporterId: null,
    destinationFacilityAuthorization: null
  });
  const result = await h.marketplace.activate(listing.id);
  assertBlocked(result, "BLOCKED_SAFETY", "DAMAGED_BATTERY_UNSAFE_WORKFLOW");
  assert.notEqual(result.listingStatus, "ACTIVE");
});

test("ADV-07 generated artifacts and route counts cannot inflate score", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const result = await h.scoring.evaluate({
    target: 100,
    criteria: [
      {
        id: "RECYCLER_AUTH",
        weight: 40,
        critical: true,
        evidence: [{ type: "SELF_ATTESTATION", value: "implemented" }]
      },
      {
        id: "CONTENT_SCALE",
        weight: 60,
        evidence: [{ type: "ROUTE_COUNT", value: 100000 }]
      }
    ]
  });
  assert.equal(result.credited.RECYCLER_AUTH ?? 0, 0);
  assert.equal(result.credited.CONTENT_SCALE ?? 0, 0);
  assert.ok(result.score < 100);
  assert.ok(result.appliedCaps?.length > 0);
});

test("ADV-08 research agent cannot write canonical publication state", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const agent = await h.agents.issue({
    id: "agent-research-1",
    role: "RESEARCH",
    capabilities: ["SOURCE_READ", "CANDIDATE_PROPOSE"]
  });
  const before = await h.pages.get("approved-page-1");
  const result = await h.agents.write(agent, {
    operation: "SET_PUBLICATION_STATUS",
    resourceId: "approved-page-1",
    value: "PUBLISHED"
  });
  assertBlocked(result, "DENIED_CAPABILITY", "CANONICAL_WRITE_NOT_ALLOWED");
  assert.deepEqual(await h.pages.get("approved-page-1"), before);
  assert.ok(result.auditEventId);
});

test("ADV-09 cyclic A2A dependencies are rejected before dispatch", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const result = await h.a2a.submit({
    tasks: [
      { id: "A", dependencies: ["C"], owner: "research" },
      { id: "B", dependencies: ["A"], owner: "evidence" },
      { id: "C", dependencies: ["B"], owner: "editor" }
    ]
  });
  assertBlocked(result, "REJECTED_CYCLIC_GRAPH", "A2A_CYCLE");
  assert.ok(Array.isArray(result.cyclePath));
  assert.ok(result.cyclePath.length >= 4);
  assert.equal(result.dispatchedTaskCount ?? 0, 0);
});

test("ADV-10 completion runner stops deterministic no-progress loops", async () => {
  const h = await adapter.createHarness({ now: "2026-07-25T00:00:00.000Z" });
  const result = await h.completion.run({
    targetScore: 100,
    maxNoProgressIterations: 3,
    verifier: "CONSTANT_FAILURE_FIXTURE",
    remediation: "NO_OP_REMEDIATION"
  });
  assert.equal(result.status, "NO_PROGRESS");
  assert.equal(result.exitCode, 1);
  assert.equal(result.noProgressIterations, 3);
  assert.ok(result.unresolvedBlockers?.length > 0);
  assert.ok(new Set(result.stateHashes ?? []).size <= 1);
});

