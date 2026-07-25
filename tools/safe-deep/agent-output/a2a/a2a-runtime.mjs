import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const RISK_LEVELS = Object.freeze([
  "READ_ONLY",
  "REVERSIBLE_WRITE",
  "EXTERNAL_WRITE",
  "DESTRUCTIVE",
]);

export const AUTHORIZATION_LEVELS = Object.freeze([
  "AUTO",
  "COORDINATOR",
  "HUMAN",
]);

const RISK_AUTHORIZATION = Object.freeze({
  READ_ONLY: "AUTO",
  REVERSIBLE_WRITE: "COORDINATOR",
  EXTERNAL_WRITE: "HUMAN",
  DESTRUCTIVE: "HUMAN",
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uniqueStrings(values, label) {
  assert(Array.isArray(values), `${label} must be an array`);
  assert(values.every((value) => typeof value === "string" && value.length > 0),
    `${label} must contain non-empty strings`);
  assert(new Set(values).size === values.length, `${label} contains duplicates`);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

export function validatePlan(plan) {
  assert(plan && typeof plan === "object", "plan must be an object");
  assert(Number.isInteger(plan.maxConcurrency) && plan.maxConcurrency > 0,
    "maxConcurrency must be a positive integer");
  assert(Array.isArray(plan.agents) && plan.agents.length > 0, "agents are required");
  assert(Array.isArray(plan.tasks) && plan.tasks.length > 0, "tasks are required");

  const agentIds = new Set();
  const capabilities = new Map();
  for (const agent of plan.agents) {
    assert(typeof agent.id === "string" && agent.id.length > 0, "agent.id is required");
    assert(!agentIds.has(agent.id), `duplicate agent id: ${agent.id}`);
    uniqueStrings(agent.capabilities, `agent ${agent.id} capabilities`);
    agentIds.add(agent.id);
    capabilities.set(agent.id, new Set(agent.capabilities));
  }

  const tasks = new Map();
  for (const task of plan.tasks) {
    assert(typeof task.id === "string" && task.id.length > 0, "task.id is required");
    assert(!tasks.has(task.id), `duplicate task id: ${task.id}`);
    uniqueStrings(task.dependsOn ?? [], `task ${task.id} dependsOn`);
    uniqueStrings(task.requiredCapabilities, `task ${task.id} requiredCapabilities`);
    assert(RISK_LEVELS.includes(task.risk), `invalid risk for task ${task.id}`);
    assert(AUTHORIZATION_LEVELS.includes(task.authorization),
      `invalid authorization for task ${task.id}`);
    assert(task.authorization === RISK_AUTHORIZATION[task.risk],
      `task ${task.id} authorization must be ${RISK_AUTHORIZATION[task.risk]} for ${task.risk}`);
    assert(Number.isInteger(task.priority ?? 0), `task ${task.id} priority must be an integer`);
    tasks.set(task.id, task);
  }

  for (const task of plan.tasks) {
    for (const dependency of task.dependsOn ?? []) {
      assert(tasks.has(dependency), `task ${task.id} has unknown dependency ${dependency}`);
      assert(dependency !== task.id, `task ${task.id} cannot depend on itself`);
    }
    const eligible = plan.agents.some((agent) =>
      task.requiredCapabilities.every((capability) =>
        capabilities.get(agent.id).has(capability)));
    assert(eligible, `no agent has all capabilities required by task ${task.id}`);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error(`dependency cycle detected at task ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of tasks.get(id).dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of [...tasks.keys()].sort()) visit(id);

  return Object.freeze({
    ...plan,
    agents: plan.agents.map((agent) => Object.freeze({
      ...agent,
      capabilities: Object.freeze([...agent.capabilities]),
    })),
    tasks: plan.tasks.map((task) => Object.freeze({
      ...task,
      dependsOn: Object.freeze([...(task.dependsOn ?? [])]),
      requiredCapabilities: Object.freeze([...task.requiredCapabilities]),
      priority: task.priority ?? 0,
    })),
  });
}

export function createJsonlRecorder(path, clock = () => new Date().toISOString()) {
  mkdirSync(dirname(path), { recursive: true });
  return (event) => {
    const record = canonical({ timestamp: clock(), ...event });
    appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
    return record;
  };
}

export class A2AScheduler {
  constructor(plan, options = {}) {
    this.plan = validatePlan(plan);
    this.record = options.record ?? (() => undefined);
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.canonicalWriter = options.canonicalWriter ?? (() => undefined);
    this.status = new Map(this.plan.tasks.map(({ id }) => [id, "PENDING"]));
    this.assignments = new Map();
    this.candidates = new Map();
    this.approvals = new Map();
    this.runningAgents = new Set();
    this.sequence = 0;
  }

  emit(type, detail = {}) {
    return this.record(canonical({
      sequence: ++this.sequence,
      type,
      occurredAt: this.clock(),
      ...detail,
    }));
  }

  readyTasks() {
    if (this.runningAgents.size >= this.plan.maxConcurrency) return [];
    return this.plan.tasks
      .filter((task) => this.status.get(task.id) === "PENDING")
      .filter((task) => task.dependsOn.every((id) => this.status.get(id) === "APPROVED"))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  dispatch() {
    const dispatched = [];
    for (const task of this.readyTasks()) {
      if (this.runningAgents.size >= this.plan.maxConcurrency) break;
      const agent = this.plan.agents
        .filter(({ id, capabilities }) =>
          !this.runningAgents.has(id) &&
          task.requiredCapabilities.every((item) => capabilities.includes(item)))
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!agent) continue;
      this.status.set(task.id, "RUNNING");
      this.assignments.set(task.id, agent.id);
      this.runningAgents.add(agent.id);
      this.emit("TASK_DISPATCHED", {
        taskId: task.id,
        agentId: agent.id,
        risk: task.risk,
        authorization: task.authorization,
      });
      dispatched.push({ taskId: task.id, agentId: agent.id });
    }
    return dispatched;
  }

  submitCandidate(taskId, agentId, artifact) {
    assert(this.status.get(taskId) === "RUNNING", `task ${taskId} is not running`);
    assert(this.assignments.get(taskId) === agentId, `agent ${agentId} is not assigned to ${taskId}`);
    assert(artifact && typeof artifact === "object", "candidate artifact must be an object");
    assert(typeof artifact.hash === "string" && artifact.hash.length > 0,
      "candidate artifact hash is required");
    const candidate = Object.freeze({
      ...structuredClone(artifact),
      taskId,
      producedBy: agentId,
      canonical: false,
    });
    this.candidates.set(taskId, candidate);
    this.status.set(taskId, "CANDIDATE");
    this.runningAgents.delete(agentId);
    this.emit("CANDIDATE_SUBMITTED", { taskId, agentId, artifactHash: artifact.hash });
    return candidate;
  }

  approveCandidate(taskId, decision) {
    assert(decision?.actorRole === "COORDINATOR",
      "only the coordinator may approve canonical writes");
    assert(typeof decision.actorId === "string" && decision.actorId.length > 0,
      "coordinator actorId is required");
    assert(this.status.get(taskId) === "CANDIDATE", `task ${taskId} has no candidate`);
    const task = this.plan.tasks.find(({ id }) => id === taskId);
    if (task.authorization === "HUMAN") {
      assert(decision.humanAuthorization?.approved === true,
        `task ${taskId} requires explicit human authorization`);
      assert(typeof decision.humanAuthorization.actorId === "string",
        "human authorization actorId is required");
    }
    const candidate = this.candidates.get(taskId);
    assert(!decision.artifactHash || decision.artifactHash === candidate.hash,
      "approval artifact hash does not match candidate");
    const approval = Object.freeze({
      taskId,
      artifactHash: candidate.hash,
      coordinatorId: decision.actorId,
      humanAuthorizerId: decision.humanAuthorization?.actorId ?? null,
    });
    this.canonicalWriter(candidate, approval);
    this.approvals.set(taskId, approval);
    this.status.set(taskId, "APPROVED");
    this.emit("CANONICAL_WRITE_APPROVED", approval);
    return approval;
  }

  rejectCandidate(taskId, decision) {
    assert(decision?.actorRole === "COORDINATOR", "only the coordinator may reject candidates");
    assert(this.status.get(taskId) === "CANDIDATE", `task ${taskId} has no candidate`);
    this.status.set(taskId, "REJECTED");
    this.emit("CANDIDATE_REJECTED", {
      taskId,
      coordinatorId: decision.actorId,
      reason: decision.reason ?? "unspecified",
    });
  }

  snapshot() {
    return canonical({
      status: Object.fromEntries(this.status),
      assignments: Object.fromEntries(this.assignments),
      runningAgents: [...this.runningAgents].sort(),
    });
  }
}
