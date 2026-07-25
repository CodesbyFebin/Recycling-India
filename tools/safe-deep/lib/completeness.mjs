import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";

export const STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  IMPLEMENTED_UNVERIFIED: "IMPLEMENTED_UNVERIFIED",
  VERIFIED_LOCAL: "VERIFIED_LOCAL",
  VERIFIED_INTEGRATION: "VERIFIED_INTEGRATION",
  VERIFIED_PRODUCTION: "VERIFIED_PRODUCTION",
  BLOCKED_EXTERNAL: "BLOCKED_EXTERNAL",
  FAILED: "FAILED"
});

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : stableJson(value))
    .digest("hex");
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function validateScope(scope) {
  const errors = [];
  if (scope.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (scope.scopeFrozen !== true) errors.push("scopeFrozen must be true");
  if (!Array.isArray(scope.areas) || !scope.areas.length) errors.push("areas must be non-empty");
  if (!Array.isArray(scope.criteria) || !scope.criteria.length) errors.push("criteria must be non-empty");

  const areaWeights = new Map();
  const criterionWeights = new Map();
  const ids = new Set();
  for (const area of scope.areas ?? []) {
    if (areaWeights.has(area.id)) errors.push(`duplicate area: ${area.id}`);
    areaWeights.set(area.id, area.weight);
  }
  for (const criterion of scope.criteria ?? []) {
    if (ids.has(criterion.id)) errors.push(`duplicate criterion: ${criterion.id}`);
    ids.add(criterion.id);
    if (!areaWeights.has(criterion.area)) errors.push(`${criterion.id} has unknown area ${criterion.area}`);
    if (!(criterion.weight > 0)) errors.push(`${criterion.id} has invalid weight`);
    if (!criterion.verify?.type) errors.push(`${criterion.id} has no verifier`);
    criterionWeights.set(
      criterion.area,
      (criterionWeights.get(criterion.area) ?? 0) + (criterion.weight ?? 0)
    );
  }
  const total = [...areaWeights.values()].reduce((sum, weight) => sum + weight, 0);
  if (total !== 100) errors.push(`area weights total ${total}; expected 100`);
  for (const [id, expected] of areaWeights) {
    const actual = criterionWeights.get(id) ?? 0;
    if (actual !== expected) errors.push(`${id} criteria total ${actual}; expected ${expected}`);
  }
  return errors;
}

export function ensureTracking(root, scope) {
  const stateRoot = join(root, ".safe-deep");
  const docsRoot = join(root, "docs", "completeness");
  mkdirSync(stateRoot, { recursive: true });
  mkdirSync(join(stateRoot, "a2a", "outbox"), { recursive: true });
  mkdirSync(join(stateRoot, "a2a", "candidates"), { recursive: true });
  mkdirSync(join(stateRoot, "a2a", "approved"), { recursive: true });
  mkdirSync(docsRoot, { recursive: true });

  const statePath = join(stateRoot, "project-state.json");
  if (!existsSync(statePath)) {
    writeJson(statePath, {
      schemaVersion: 1,
      project: scope.project,
      scopeId: scope.scopeId,
      scopeHash: sha256(scope),
      phase: "AUDIT",
      score: 0,
      currentTask: null,
      nextSafeAction: "Run the baseline audit."
    });
  }

  const documents = {
    "CURRENT_STATE.md": `# Current State\n\nProject: ${scope.project}\n\nNo verified run recorded.\n`,
    "SCOPE.md": `# Frozen Scope\n\n- ID: \`${scope.scopeId}\`\n- Hash: \`${sha256(scope)}\`\n- Target: 100/100\n`,
    "COMPLETENESS_LEDGER.md": "# Completeness Ledger\n\nNo run recorded.\n",
    "REQUIREMENTS_TRACEABILITY.md": "# Requirements Traceability\n\n",
    "IMPLEMENTATION_PLAN.md": "# Implementation Plan\n\n",
    "DATA_PROVENANCE.md": "# Data Provenance\n\n",
    "POLICY_REGISTER.md": "# Policy Register\n\n",
    "DECISIONS.md": "# Decisions\n\n",
    "BLOCKERS.md": "# Blockers\n\n",
    "RISKS.md": "# Risks\n\n",
    "TEST_EVIDENCE.md": "# Test Evidence\n\n",
    "PRODUCTION_VERIFICATION.md": "# Production Verification\n\n",
    "FINAL_HANDOFF.md": "# Final Handoff\n\nNot ready.\n"
  };
  for (const [name, content] of Object.entries(documents)) {
    const path = join(docsRoot, name);
    if (!existsSync(path)) writeFileSync(path, content);
  }
  return { stateRoot, docsRoot };
}

function commandAvailable(command) {
  const binary = command.trim().split(/\s+/)[0];
  return spawnSync("sh", ["-c", `command -v ${JSON.stringify(binary)}`], {
    encoding: "utf8"
  }).status === 0;
}

export function runCommand(root, command) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  if (!commandAvailable(command)) {
    return {
      command,
      startedAt,
      durationMs: Date.now() - started,
      exitCode: 127,
      passed: false,
      stdout: "",
      stderr: "Executable not found."
    };
  }
  const result = spawnSync("sh", ["-c", command], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 20 * 60 * 1000
  });
  return {
    command,
    startedAt,
    durationMs: Date.now() - started,
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
    passed: result.status === 0,
    stdout: (result.stdout ?? "").slice(-20000),
    stderr: (result.stderr ?? "").slice(-20000)
  };
}

function verify(root, criterion) {
  const verifier = criterion.verify;
  if (verifier.type === "manual") {
    return {
      status: STATUS.BLOCKED_EXTERNAL,
      fraction: 0,
      summary: verifier.instructions,
      evidence: []
    };
  }
  if (verifier.type === "files") {
    const evidence = verifier.all.map((relativePath) => {
      const path = join(root, relativePath);
      return {
        path: relativePath,
        present: existsSync(path) && statSync(path).isFile() && statSync(path).size > 0
      };
    });
    const passed = evidence.every((item) => item.present);
    return {
      status: passed ? STATUS.VERIFIED_LOCAL : STATUS.FAILED,
      fraction: passed ? 1 : 0,
      summary: passed ? "Required files are present." : "Required files are missing.",
      evidence
    };
  }
  const commands = verifier.type === "commands" ? verifier.commands : [verifier.command];
  const evidence = commands.map((command) => runCommand(root, command));
  const passed = evidence.filter((item) => item.passed).length;
  const fraction = passed / evidence.length;
  const level = verifier.level ?? "LOCAL";
  const completeStatus =
    level === "PRODUCTION"
      ? STATUS.VERIFIED_PRODUCTION
      : level === "INTEGRATION"
        ? STATUS.VERIFIED_INTEGRATION
        : STATUS.VERIFIED_LOCAL;
  return {
    status: fraction === 1 ? completeStatus : fraction > 0 ? STATUS.IMPLEMENTED_UNVERIFIED : STATUS.FAILED,
    fraction,
    summary: `${passed}/${evidence.length} commands passed.`,
    evidence
  };
}

export function calculateScore(scope, results) {
  const rawScore = Number(
    scope.criteria
      .reduce((sum, criterion) => sum + criterion.weight * (results[criterion.id]?.fraction ?? 0), 0)
      .toFixed(2)
  );
  let score = rawScore;
  const caps = [];
  for (const cap of scope.scoreCaps ?? []) {
    const failed = scope.criteria.filter(
      (criterion) =>
        criterion.tags?.includes(cap.whenTagFails) &&
        (results[criterion.id]?.fraction ?? 0) < 1
    );
    if (failed.length && score > cap.cap) {
      score = cap.cap;
      caps.push({ ...cap, criteria: failed.map((item) => item.id) });
    }
  }
  return { rawScore, score, caps };
}

export function runVerification(root, scope) {
  const { stateRoot, docsRoot } = ensureTracking(root, scope);
  const results = {};
  const startedAt = new Date().toISOString();
  for (const criterion of scope.criteria) {
    results[criterion.id] = verify(root, criterion);
  }
  const report = {
    schemaVersion: 1,
    project: scope.project,
    scopeId: scope.scopeId,
    scopeHash: sha256(scope),
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    score: calculateScore(scope, results)
  };
  writeJson(join(stateRoot, "completeness.json"), report);
  appendFileSync(join(stateRoot, "verification-runs.jsonl"), `${JSON.stringify(report)}\n`);

  const ledger = [
    "# Completeness Ledger",
    "",
    `- Score: **${report.score.score}/100**`,
    `- Raw score: ${report.score.rawScore}/100`,
    `- Scope hash: \`${report.scopeHash}\``,
    "",
    "| ID | Area | Weight | Status | Earned | Requirement |",
    "|---|---|---:|---|---:|---|"
  ];
  for (const criterion of scope.criteria) {
    const result = results[criterion.id];
    ledger.push(
      `| ${criterion.id} | ${criterion.area} | ${criterion.weight} | ${result.status} | ${(criterion.weight * result.fraction).toFixed(2)} | ${criterion.requirement.replaceAll("|", "\\|")} |`
    );
  }
  writeFileSync(join(docsRoot, "COMPLETENESS_LEDGER.md"), `${ledger.join("\n")}\n`);

  const failed = scope.criteria.filter((criterion) => results[criterion.id].fraction < 1);
  writeFileSync(
    join(docsRoot, "BLOCKERS.md"),
    `# Blockers\n\n${failed.map((item) => `- **${item.id}** (${results[item.id].status}): ${item.requirement}`).join("\n") || "None."}\n`
  );
  const statePath = join(stateRoot, "project-state.json");
  const state = readJson(statePath);
  state.score = report.score.score;
  state.phase = report.score.score === 100 ? "COMPLETE" : "IMPLEMENTATION";
  state.nextSafeAction = failed.length
    ? `Resolve ${failed[0].id}: ${failed[0].requirement}`
    : "All scoped criteria verified.";
  writeJson(statePath, state);
  return report;
}
