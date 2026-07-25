import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  calculateScore,
  runVerification,
  validateScope
} from "../lib/completeness.mjs";

function scope(criteria, caps = []) {
  return {
    schemaVersion: 1,
    project: "Test",
    scopeId: "test",
    scopeFrozen: true,
    areas: [{ id: "core", name: "Core", weight: 100 }],
    criteria,
    scoreCaps: caps
  };
}

test("scope denominator must total exactly 100", () => {
  const errors = validateScope({
    ...scope([{ id: "A", area: "core", requirement: "A", weight: 99, verify: { type: "manual" } }]),
    areas: [{ id: "core", name: "Core", weight: 99 }]
  });
  assert.ok(errors.some((error) => error.includes("expected 100")));
});

test("route count cannot earn score without a verifier", () => {
  const errors = validateScope(
    scope([{ id: "SCALE", area: "core", requirement: "100k routes", weight: 100 }])
  );
  assert.ok(errors.some((error) => error.includes("no verifier")));
});

test("production manual evidence remains blocked", () => {
  const root = mkdtempSync(join(tmpdir(), "recycling-safe-deep-"));
  const config = scope([
    {
      id: "PROD",
      area: "core",
      requirement: "Production",
      weight: 100,
      productionRequired: true,
      verify: { type: "manual", instructions: "Attach production evidence." }
    }
  ]);
  const report = runVerification(root, config);
  assert.equal(report.score.score, 0);
  assert.equal(report.results.PROD.status, "BLOCKED_EXTERNAL");
});

test("critical cap is applied to otherwise high raw score", () => {
  const config = scope(
    [
      { id: "PASS", area: "core", requirement: "Pass", weight: 95, verify: { type: "files", all: ["proof"] } },
      { id: "FAIL", area: "core", requirement: "Fail", weight: 5, tags: ["critical"], verify: { type: "files", all: ["missing"] } }
    ],
    [{ whenTagFails: "critical", cap: 50, reason: "Critical failure." }]
  );
  const score = calculateScore(config, {
    PASS: { fraction: 1 },
    FAIL: { fraction: 0 }
  });
  assert.equal(score.rawScore, 95);
  assert.equal(score.score, 50);
});

test("file verifier requires non-empty evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "recycling-safe-deep-file-"));
  writeFileSync(join(root, "empty"), "");
  const config = scope([
    { id: "FILE", area: "core", requirement: "File", weight: 100, verify: { type: "files", all: ["empty"] } }
  ]);
  const report = runVerification(root, config);
  assert.equal(report.results.FILE.status, "FAILED");
});
