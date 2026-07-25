// adapter-production.mjs
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function verify(evidencePath) {
  // evidencePath is the directory containing evidence.json and evidence.sig
  const evidenceFile = path.join(evidencePath, 'evidence.json');
  const sigFile = path.join(evidencePath, 'evidence.sig');

  if (!fs.existsSync(evidenceFile) || !fs.existsSync(sigFile)) {
    return { passed: false, reason: 'Evidence files not found' };
  }

  const evidenceJson = fs.readFileSync(evidenceFile, 'utf8');
  const signature = fs.readFileSync(sigFile, 'utf8');

  // Verify signature using HMAC (same secret as during generation)
  const secret = process.env.EVIDENCE_SECRET || 'default-secret-change-me';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(evidenceJson);
  const expectedSig = hmac.digest('hex');
  if (signature !== expectedSig) {
    return { passed: false, reason: 'Signature mismatch – evidence may be tampered' };
  }

  const evidence = JSON.parse(evidenceJson);

  // Check that all checks passed
  const allChecks = evidence.checks;
  let failed = false;
  for (const [key, value] of Object.entries(allChecks)) {
    if (typeof value === 'object' && value.status && value.status !== 'PASS') {
      failed = true;
      break;
    }
    if (typeof value === 'object' && !value.status) {
      // It might be a nested object with multiple keys; check if any is FAIL
      const vals = Object.values(value);
      if (vals.some(v => v === 'FAIL')) {
        failed = true;
        break;
      }
    }
  }

  if (failed) {
    return { passed: false, reason: 'Some production checks failed', details: allChecks };
  }

  // Ensure deploy_id is present and non-empty
  if (!evidence.deploy_id || evidence.deploy_id.length < 5) {
    return { passed: false, reason: 'Invalid or missing deploy_id' };
  }

  return { passed: true, score: 2 };
}
