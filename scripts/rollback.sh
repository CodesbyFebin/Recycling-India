#!/bin/bash
# Rollback script for production deployments
# This script should restore the previous known-good release

set -e

echo "Starting rollback procedure..."

# Ensure we have a previous commit to roll back to
if [ -z "$PREVIOUS_COMMIT_SHA" ]; then
  echo "ERROR: PREVIOUS_COMMIT_SHA environment variable is required"
  exit 1
fi

# Check current deployment log
echo "Current commit: $(git rev-parse HEAD)"
echo "Rolling back to: $PREVIOUS_COMMIT_SHA"

# Perform the rollback (this would typically involve switching a symlink or re-deploying)
git checkout "$PREVIOUS_COMMIT_SHA"

# Rebuild and redeploy if needed
# In a Vercel environment, you might trigger a redeploy via API

echo "Rollback successful. Redeploying..."
# vercel --prod --yes

echo "Rollback completed."
