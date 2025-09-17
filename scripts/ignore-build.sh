# scripts/ignore-build.sh
# Heuristic: if this is a Git auto-build from GitHub integration, Vercel sets git metadata.
# We'll skip those; everything else (manual, deploy hook) is allowed.
if [ -n "$VERCEL_GIT_COMMIT_REF" ] && [ -n "$VERCEL_GIT_COMMIT_SHA" ] && [ -n "$VERCEL_GIT_PROVIDER" ]; then
  echo "Skipping auto Git build for $VERCEL_GIT_COMMIT_REF ($VERCEL_GIT_PROVIDER)"
  exit 0
fi

# Allow deploy-hook/manual builds
exit 1
