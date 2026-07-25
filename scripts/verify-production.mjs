#!/usr/bin/env node
/**
 * Production Handoff Verification (HAND-002)
 * Verifies that the production deployment evidence is present and valid.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const evidenceDir = join(process.cwd(), ".safe-deep", "evidence", "production");

// Required evidence files
const requiredFiles = [
  "manifest.json",
  "manifest.sig",
  "page-home.html",
  "page-recycling-directory.html",
  "page-waste-type-database.html",
  "page-e-waste-recycling.html",
  "robots.txt",
  "sitemap.xml",
  "security-headers.json"
];

function fail(msg) {
  console.error("PRODUCTION VERIFICATION FAILED:", msg);
  process.exit(1);
}

// Check manifest
const manifestPath = join(evidenceDir, "manifest.json");
if (!existsSync(manifestPath)) fail("manifest.json missing");
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  fail("manifest.json is not valid JSON: " + e.message);
}

// Check required files
for (const file of requiredFiles) {
  const path = join(evidenceDir, file);
  if (!existsSync(path)) {
    fail(`Missing required evidence file: ${file}`);
  }
  if (statSync(path).size === 0) {
    fail(`Evidence file is empty: ${file}`);
  }
}

// Check manifest has deployment info and pages
if (!manifest.deployment || !manifest.deployment.url || !manifest.deployment.gitSha) {
  fail("manifest missing deployment metadata");
}
if (!manifest.checks || !Array.isArray(manifest.checks.pages) || manifest.checks.pages.length === 0) {
  fail("manifest missing page checks");
}

// Check all pages in manifest had status 200
const failedPages = manifest.checks.pages.filter(p => !p.ok || p.status !== 200);
if (failedPages.length > 0) {
  fail(`Some pages did not return 200: ${failedPages.map(p => `${p.path} (${p.status})`).join(", ")}`);
}

console.log("✓ All production handoff requirements verified");
console.log(`Deployment URL: ${manifest.deployment.url}`);
console.log(`Git SHA: ${manifest.deployment.gitSha}`);
process.exit(0);
