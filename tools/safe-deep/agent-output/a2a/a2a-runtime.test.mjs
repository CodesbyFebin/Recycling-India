import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  A2AScheduler,
  createJsonlRecorder,
  validatePlan,
} from "./a2a-runtime.mjs";

function plan(overrides = {}) {
  return {
    maxConcurrency: 2,
    agents: [
      { id: "agent-a", capabilities: ["research", "write"] },
      { id: "agent-b", capabilities: ["validate"] },
      { id: "agent-c", capabilities: ["research"] },
    ],
    tasks: [
      {
        id: "research",
        dependsOn: [],
        requiredCapabilities: ["research"],
        risk: "READ_ONLY",
        authorization: "AUTO",
        priority: 10,
      },
      {
        id: "draft",
        dependsOn: ["research"],
        requiredCapabilities: ["write"],
        risk: "REVERSIBLE_WRITE",
        authorization: "COORDINATOR",
        priority: 5,
      },
      {
        id: "publish",
        dependsOn: ["draft"],
        requiredCapabilities: ["validate"],
        risk: "EXTERNAL_WRITE",
        authorization: "HUMAN",
        priority: 1,
      },
    ],
    ...overrides,
  };
}

test("rejects cycles, missing capabilities, and unsafe authorization", () => {
  assert.throws(() => validatePlan(plan({
    tasks: [
      { id: "a", dependsOn: ["b"], requiredCapabilities: ["research"], risk: "READ_ONLY", authorization: "AUTO" },
      { id: "b", dependsOn: ["a"], requiredCapabilities: ["validate"], risk: "READ_ONLY", authorization: "AUTO" },
    ],
  })), /cycle/);
  assert.throws(() => validatePlan(plan({
    tasks: [{ id: "x", dependsOn: [], requiredCapabilities: ["unknown"], risk: "READ_ONLY", authorization: "AUTO" }],
  })), /no agent/);
  assert.throws(() => validatePlan(plan({
    tasks: [{ id: "x", dependsOn: [], requiredCapabilities: ["research"], risk: "DESTRUCTIVE", authorization: "AUTO" }],
  })), /must be HUMAN/);
});

test("dispatch is deterministic, dependency-aware, and concurrency-bounded", () => {
  const scheduler = new A2AScheduler(plan({
    tasks: [
      { id: "z", dependsOn: [], requiredCapabilities: ["research"], risk: "READ_ONLY", authorization: "AUTO", priority: 1 },
      { id: "a", dependsOn: [], requiredCapabilities: ["validate"], risk: "READ_ONLY", authorization: "AUTO", priority: 2 },
      { id: "b", dependsOn: [], requiredCapabilities: ["research"], risk: "READ_ONLY", authorization: "AUTO", priority: 2 },
    ],
  }));
  assert.deepEqual(scheduler.dispatch(), [
    { taskId: "a", agentId: "agent-b" },
    { taskId: "b", agentId: "agent-a" },
  ]);
  assert.equal(scheduler.dispatch().length, 0);
});

test("agent output stays candidate-only until coordinator approval", () => {
  const writes = [];
  const scheduler = new A2AScheduler(plan(), {
    canonicalWriter: (...args) => writes.push(args),
  });
  const [{ taskId, agentId }] = scheduler.dispatch();
  const candidate = scheduler.submitCandidate(taskId, agentId, { hash: "sha256:abc", payload: "facts" });
  assert.equal(candidate.canonical, false);
  assert.equal(writes.length, 0);
  assert.throws(() => scheduler.approveCandidate(taskId, {
    actorRole: "AGENT",
    actorId: agentId,
  }), /only the coordinator/);
  scheduler.approveCandidate(taskId, {
    actorRole: "COORDINATOR",
    actorId: "coordinator-1",
    artifactHash: "sha256:abc",
  });
  assert.equal(writes.length, 1);
  assert.equal(scheduler.snapshot().status.research, "APPROVED");
});

test("external writes require coordinator and explicit human authorization", () => {
  const single = plan({
    tasks: [{
      id: "publish",
      dependsOn: [],
      requiredCapabilities: ["validate"],
      risk: "EXTERNAL_WRITE",
      authorization: "HUMAN",
    }],
  });
  const scheduler = new A2AScheduler(single);
  const [{ taskId, agentId }] = scheduler.dispatch();
  scheduler.submitCandidate(taskId, agentId, { hash: "sha256:publish" });
  assert.throws(() => scheduler.approveCandidate(taskId, {
    actorRole: "COORDINATOR",
    actorId: "coord",
  }), /human authorization/);
  assert.doesNotThrow(() => scheduler.approveCandidate(taskId, {
    actorRole: "COORDINATOR",
    actorId: "coord",
    artifactHash: "sha256:publish",
    humanAuthorization: { approved: true, actorId: "owner" },
  }));
});

test("records parseable JSONL events", () => {
  const path = join(mkdtempSync(join(tmpdir(), "a2a-")), "events.jsonl");
  const scheduler = new A2AScheduler(plan(), {
    clock: () => "2026-07-25T00:00:00.000Z",
    record: createJsonlRecorder(path, () => "2026-07-25T00:00:00.000Z"),
  });
  const [{ taskId, agentId }] = scheduler.dispatch();
  scheduler.submitCandidate(taskId, agentId, { hash: "sha256:event" });
  const events = readFileSync(path, "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(events.map(({ type }) => type), ["TASK_DISPATCHED", "CANDIDATE_SUBMITTED"]);
  assert.deepEqual(events.map(({ sequence }) => sequence), [1, 2]);
});
