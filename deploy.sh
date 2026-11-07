#!/usr/bin/env bash
#
# Deploy the owner dashboard to /var/www/dashboard.lightor/dist on the EC2 box.
#
# Aborts on any failure. The original register script ran the build and then
# wiped the live directory unconditionally, so a failed build took the site
# down; the guards below make that impossible.

set -euo pipefail

# Override with: KEY=/path/to/key ./deploy.sh
KEY="${KEY:-$HOME/Documents/lightor-key.pem}"
# Override with: HOST=user@ip ./deploy.sh   (CI passes it from a secret)
HOST="${HOST:-ubuntu@51.16.211.227}"
TARGET=/var/www/dashboard.lightor/dist
STAGING=temp_dashboard_dist

[ -f "$KEY" ] || { echo "✗ ssh key not found at $KEY"; exit 1; }

# LT-608: what this bundle is, baked into it and published with it for the
# apps' over-the-air updates: the commit and the time, and when it was built.
export BUNDLE_ID="${BUNDLE_ID:-$(git rev-parse --short=7 HEAD)-$(date -u +%Y%m%d%H%M)}"
export BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

echo "🚀 1/4  Building locally ($BUNDLE_ID)..."
npm run build

if [ ! -f dist/index.html ]; then
  echo "✗ dist/index.html missing — build produced nothing. Aborting before touching the server."
  exit 1
fi
echo "   built $(find dist -type f | wc -l | tr -d ' ') files"

echo "🚀 2/4  Uploading to staging on the server..."
ssh -i "$KEY" "$HOST" "rm -rf $STAGING"
scp -q -i "$KEY" -r ./dist "$HOST:$STAGING"

echo "⚙️  3/4  Swapping into $TARGET..."
ssh -i "$KEY" "$HOST" bash -s <<EOF
  set -euo pipefail
  if [ ! -f "$STAGING/index.html" ]; then
    echo "✗ staging incomplete on the server — live site left untouched"
    exit 1
  fi
  sudo mkdir -p "$TARGET"
  sudo rm -rf "$TARGET"/*
  # "$STAGING"/. not /* — a glob silently skips dot-entries, which meant
  # dist/.well-known (the Apple app-site-association and Google verification
  # files) never reached the server while every visible file did.
  sudo cp -r "$STAGING"/. "$TARGET"/
  sudo chown -R www-data:www-data "$TARGET"
  rm -rf "$STAGING"
EOF

echo "✅ 4/4  the owner dashboard deployed."

# LT-608: the same build, zipped and signed, for the apps' over-the-air
# updates. LIVE_UPDATE_KEY is the private key's file (CI writes it from the
# LIVE_UPDATE_PRIVATE_KEY secret); without it the apps get nothing new. The
# server's manifest lists the last 20 bundles with each one's native
# fingerprint; the API (GET /api/app/update) picks the one an app may take.
UPDATES=/var/www/app-updates
if [ -n "${LIVE_UPDATE_KEY:-}" ] && [ -f "$LIVE_UPDATE_KEY" ]; then
  echo "📦 Publishing the apps' bundle $BUNDLE_ID..."
  FINGERPRINT=$(node tools/native-fingerprint.mjs)
  rm -f bundle.zip
  (cd dist && zip -qrX ../bundle.zip .)
  CHECKSUM=$( (sha256sum bundle.zip 2>/dev/null || shasum -a 256 bundle.zip) | cut -d' ' -f1)
  SIGNATURE=$(openssl dgst -sha256 -sign "$LIVE_UPDATE_KEY" bundle.zip | base64 | tr -d '\n')
  [ -n "$SIGNATURE" ] || { echo "✗ could not sign the bundle"; exit 1; }
  ssh -i "$KEY" "$HOST" "cat $UPDATES/manifest.json 2>/dev/null || echo '{}'" > manifest.old.json
  ID="$BUNDLE_ID" FP="$FINGERPRINT" SUM="$CHECKSUM" SIG="$SIGNATURE" BUILT="$BUILD_TIME" \
    BASE="${APP_UPDATES_BASE:-https://dashboard.lightor.app/app-updates}" node tools/publish-manifest.mjs manifest.old.json app-updates.json manifest.json
  scp -q -i "$KEY" bundle.zip "$HOST:app-update-$BUNDLE_ID.zip"
  scp -q -i "$KEY" manifest.json "$HOST:app-update-manifest.json"
  ssh -i "$KEY" "$HOST" "UPDATES=$UPDATES ID=$BUNDLE_ID bash -s" <<'REMOTE'
    set -euo pipefail
    sudo mkdir -p "$UPDATES"
    sudo mv ~/"app-update-$ID.zip" "$UPDATES/$ID.zip"
    sudo mv ~/app-update-manifest.json "$UPDATES/manifest.json"
    # Only the zips the manifest still lists stay.
    cd "$UPDATES"
    for f in *.zip; do grep -q "\"${f%.zip}\"" manifest.json || sudo rm -f "$f"; done
    sudo chown -R www-data:www-data "$UPDATES"
    sudo chmod -R a+rX "$UPDATES"
REMOTE
  rm -f bundle.zip manifest.old.json manifest.json
  echo "✅ the apps' bundle $BUNDLE_ID published ($FINGERPRINT)."
else
  echo "ℹ️  No LIVE_UPDATE_KEY: the apps' bundle is not published."
fi
