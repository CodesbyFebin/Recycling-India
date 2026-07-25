#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ensureTracking,
  readJson,
  runCommand,
  runVerification,
  sha256,
  validateScope,
  writeJson
} from "./lib/completeness.mjs";
import {
  A2AScheduler,
  createJsonlRecorder,
  validatePlan
} from "./agent-output/a2a/a2a-runtime.mjs";

const args = process.argv.slice(2);
const operation = args[0] ?? "help";

function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const root = resolve(option("--root", process.cwd()));
const scopePath = resolve(option("--scope", join(process.cwd(), "safe-deep.scope.json")));
const planPath = resolve(option("--plan", join(process.cwd(), "work-plan.json")));

function loadScope() {
  if (!existsSync(scopePath)) throw new Error(`Scope not found: ${scopePath}`);
  const scope = readJson(scopePath);
  const errors = validateScope(scope);
  if (errors.length) throw new Error(errors.join("\n"));
  return scope;
}

function loadPlan() {
  if (!existsSync(planPath)) throw new Error(`A2A plan not found: ${planPath}`);
  return validatePlan(readJson(planPath));
}

function printReport(report) {
  console.log(`SAFE-DEEP score: ${report.score.score}/100 (raw ${report.score.rawScore}/100)`);
  for (const cap of report.score.caps) {
    console.log(`Score cap ${cap.cap}: ${cap.reason} [${cap.criteria.join(", ")}]`);
  }
  console.log(report.score.score === 100 ? "Exit gate: PASS" : "Exit gate: BLOCKED");
}

function createScheduler(plan) {
  const a2aRoot = join(root, ".safe-deep", "a2a");
  return new A2AScheduler(plan, {
    record: createJsonlRecorder(join(a2aRoot, "events.jsonl")),
    canonicalWriter(candidate, approval) {
      writeJson(join(a2aRoot, "approved", `${candidate.taskId}.json`), {
        candidate,
        approval,
        canonical: true
      });
    }
  });
}

function help() {
  console.log(`Usage:
  node safe-deep-recycling.mjs validate --scope <scope.json> --plan <plan.json>
  node safe-deep-recycling.mjs init --root <project> --scope <scope.json>
  node safe-deep-recycling.mjs audit --root <project> --scope <scope.json>
  node safe-deep-recycling.mjs verify --root <project> --scope <scope.json>
  node safe-deep-recycling.mjs score --root <project>
  node safe-deep-recycling.mjs plan --plan <plan.json>
  node safe-deep-recycling.mjs dispatch --root <project> --scope <scope.json> --plan <plan.json>
  node safe-deep-recycling.mjs loop --root <project> --scope <scope.json> [--apply]

Sub-agents produce candidate artifacts only. Canonical writes require coordinator
approval, and external/destructive actions require explicit human authorization.`);
}

function runAudit(scope) {
  ensureTracking(root, scope);
  const packagePath = join(root, "package.json");
  const audit = {
    schemaVersion: 1,
    root,
    project: scope.project,
    scopeHash: sha256(scope),
    packageJson: existsSync(packagePath),
    packageScripts: existsSync(packagePath)
      ? Object.keys(JSON.parse(readFileSync(packagePath, "utf8")).scripts ?? {}).sort()
      : [],
    gitMetadata: existsSync(join(root, ".git")),
    generatedAt: new Date().toISOString()
  };
  writeJson(join(root, ".safe-deep", "audit.json"), audit);
  console.log(JSON.stringify(audit, null, 2));
}

function dispatchReady(scope, plan) {
  ensureTracking(root, scope);
  const scheduler = createScheduler(plan);
  const assignments = scheduler.dispatch();
  for (const assignment of assignments) {
    const task = plan.tasks.find((item) => item.id === assignment.taskId);
    writeJson(join(root, ".safe-deep", "a2a", "outbox", `${assignment.taskId}.json`), {
      schemaVersion: 1,
      planId: plan.planId,
      ...assignment,
      task,
      outputPolicy: {
        canonicalWriteAllowed: false,
        candidateArtifactRequired: true,
        coordinatorApprovalRequired: true
      }
    });
  }
  console.log(JSON.stringify({ assignments, snapshot: scheduler.snapshot() }, null, 2));
}

function controlledLoop(scope) {
  const apply = args.includes("--apply");
  let previousStateHash = null;
  let noProgress = 0;
  const limit = scope.maxIterations ?? 10;
  for (let iteration = 1; iteration <= limit; iteration += 1) {
    console.log(`Iteration ${iteration}/${limit}`);
    const report = runVerification(root, scope);
    printReport(report);
    if (report.score.score === 100) return 0;
    const stateHash = sha256({
      score: report.score.score,
      failed: scope.criteria
        .filter((criterion) => report.results[criterion.id].fraction < 1)
        .map((criterion) => criterion.id)
    });
    noProgress = stateHash === previousStateHash ? noProgress + 1 : 0;
    previousStateHash = stateHash;
    if (noProgress >= 2) {
      console.log("No progress detected; stopping safely.");
      return 1;
    }
    if (!apply) {
      console.log("Verification only. Use --apply for explicitly allowlisted project fixes.");
      return 1;
    }
    const target = scope.criteria
      .filter((criterion) => report.results[criterion.id].fraction < 1)
      .filter((criterion) => criterion.fix?.allowAutoFix === true && criterion.fix.command)
      .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))[0];
    if (!target) {
      console.log("No allowlisted automatic fix remains.");
      return 1;
    }
    console.log(`Applying allowlisted fix for ${target.id}: ${target.fix.command}`);
    const result = runCommand(root, target.fix.command);
    writeJson(join(root, ".safe-deep", "last-fix.json"), {
      criterionId: target.id,
      result
    });
    if (!result.passed) return 1;
  }
  console.log("Maximum iterations reached.");
  return 1;
}

try {
  if (operation === "help") {
    help();
    process.exit(0);
  }
  if (operation === "score") {
    const path = join(root, ".safe-deep", "completeness.json");
    if (!existsSync(path)) throw new Error("No completeness report exists.");
    printReport(readJson(path));
    process.exit(0);
  }
  if (operation === "plan") {
    const plan = loadPlan();
    const scheduler = createScheduler(plan);
    console.log(JSON.stringify({
      valid: true,
      planId: plan.planId,
      ready: scheduler.readyTasks().map((task) => task.id),
      maxConcurrency: plan.maxConcurrency
    }, null, 2));
    process.exit(0);
  }

  const scope = loadScope();
  if (operation === "validate") {
    const plan = loadPlan();
    console.log(`Valid scope: ${scope.project} / 100 points`);
    console.log(`Valid A2A plan: ${plan.planId} / ${plan.tasks.length} tasks`);
    process.exit(0);
  }
  if (operation === "init") {
    ensureTracking(root, scope);
    console.log(`Tracking initialized in ${root}`);
    process.exit(0);
  }
  if (operation === "audit") {
    runAudit(scope);
    process.exit(0);
  }
  if (operation === "verify") {
    const report = runVerification(root, scope);
    printReport(report);
    process.exit(report.score.score === 100 ? 0 : 1);
  }
  if (operation === "dispatch") {
    dispatchReady(scope, loadPlan());
    process.exit(0);
  }
  if (operation === "loop") {
    process.exit(controlledLoop(scope));
  }
  help();
  process.exit(2);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
