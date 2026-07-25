#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const pipelineAsync = promisify(pipeline);

async function fetchUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return {
    text: await response.text(),
    headers: Object.fromEntries(response.headers.entries()),
    status: response.status,
    url: response.url
  };
}

async function collectEvidence() {
  const PROD_BASE_URL = process.env.PROD_BASE_URL || "https://recycling-india.vercel.app";
  const EVIDENCE_DIR = join(process.cwd(), ".safe-deep", "evidence", "production");
  
  // Ensure evidence directory exists
  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString();
  const gitHash = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  
  console.log(`Collecting production evidence for ${PROD_BASE_URL}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Git SHA: ${gitHash}`);
  
  // 1. Test representative pages
  const pages = [
    { path: "/", name: "homepage" },
    { path: "/recycling-directory", name: "recycling-directory" },
    { path: "/waste-type-database", name: "waste-type-database" },
    { path: "/e-waste-recycling", name: "e-waste-recycling" }
  ];
  
  const pageResults = [];
  for (const page of pages) {
    try {
      const response = await fetchUrl(`${PROD_BASE_URL}${page.path}`);
      pageResults.push({
        path: page.path,
        status: response.status,
        ok: response.status === 200,
        contentLength: response.text.length,
        hasDoctype: response.text.includes("<!DOCTYPE"),
        hasHtml: response.text.includes("<html"),
        headHasTitle: response.text.includes("<title>") && response.text.includes("</title>"),
        headHasMetaDescription: response.text.includes('name="description"'),
        ...(response.status === 200 && {
          hasCanonical: response.text.includes('<link rel="canonical"'),
          hasOgTitle: response.text.includes('property="og:title"'),
          hasOgDescription: response.text.includes('property="og:description"'),
          hasSchemaOrg: response.text.includes('itemscope') || response.text.includes('schema.org')
        })
      });
      
      // Save raw HTML for inspection
      const safePath = page.path === "/" ? "home" : page.path.substring(1).replace(/\//g, "_");
      writeFileSync(
        join(EVIDENCE_DIR, `page-${safePath}.html`),
        response.text
      );
      
      console.log(`✓ ${page.path}: ${response.status}`);
    } catch (error) {
      pageResults.push({
        path: page.path,
        error: error.message,
        status: 0,
        ok: false
      });
      console.log(`✗ ${page.path}: ${error.message}`);
    }
  }
  
  // 2. Check robots.txt and sitemap
  try {
    const robotsRes = await fetchUrl(`${PROD_BASE_URL}/robots.txt`);
    writeFileSync(
      join(EVIDENCE_DIR, "robots.txt"),
      robotsRes.text
    );
    console.log(`✓ robots.txt: ${robotsRes.status}`);
  } catch (error) {
    console.log(`✗ robots.txt: ${error.message}`);
  }
  
  try {
    const sitemapRes = await fetchUrl(`${PROD_BASE_URL}/sitemap.xml`);
    writeFileSync(
      join(EVIDENCE_DIR, "sitemap.xml"),
      sitemapRes.text
    );
    console.log(`✓ sitemap.xml: ${sitemapRes.status}`);
  } catch (error) {
    console.log(`✗ sitemap.xml: ${error.message}`);
  }
  
  // 3. Check security headers (from homepage)
  try {
    const securityRes = await fetchUrl(`${PROD_BASE_URL}/`);
    const headers = securityRes.headers;
    const securityHeaders = {
      "content-security-policy": headers["content-security-policy"] || headers["Content-Security-Policy"],
      "x-frame-options": headers["x-frame-options"] || headers["X-Frame-Options"],
      "x-content-type-options": headers["x-content-type-options"] || headers["X-Content-Type-Options"],
      "referrer-policy": headers["referrer-policy"] || headers["Referrer-Policy"],
      "strict-transport-security": headers["strict-transport-security"] || headers["Strict-Transport-Security"],
      "x-xss-protection": headers["x-xss-protection"] || headers["X-XSS-Protection"]
    };
    
    writeFileSync(
      join(EVIDENCE_DIR, "security-headers.json"),
      JSON.stringify(securityHeaders, null, 2)
    );
    console.log(`✓ security headers collected`);
  } catch (error) {
    console.log(`✗ security headers: ${error.message}`);
  }
  
  // 4. Create manifest with metadata
  const manifest = {
    deployment: {
      url: PROD_BASE_URL,
      timestamp,
      gitSha: gitHash,
      verifiedAt: new Date().toISOString()
    },
    checks: {
      pages: pageResults
      // In a real implementation, we would also check:
      // - Recycler and price data freshness
      // - Marketplace workflow completion
      // - Monitoring alerts
      // - Backup/restore procedures
      // For now, we're simulating these as "would be checked in production"
    },
    passed: pageResults.every(p => p.ok && p.status === 200)
  };
  
  writeFileSync(
    join(EVIDENCE_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  
  // Create signature (in real implementation, this would be a PGP signature)
  const manifestStr = JSON.stringify(manifest);
  const hash = createHash("sha256").update(manifestStr).digest("hex");
  const signature = {
    algorithm: "SHA256",
    value: hash,
    timestamp: new Date().toISOString(),
    note: "In production, this would be a cryptographic signature using a private key"
  };
  
  writeFileSync(
    join(EVIDENCE_DIR, "manifest.sig"),
    JSON.stringify(signature, null, 2)
  );
  
  console.log(`Evidence collected to ${EVIDENCE_DIR}`);
  console.log(`Manifest passed: ${manifest.passed}`);
  
  return manifest.passed;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectEvidence().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error("Failed to collect evidence:", err);
    process.exit(1);
  });
}

export { collectEvidence };
