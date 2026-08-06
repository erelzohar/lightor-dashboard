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
HOST=ubuntu@51.16.211.227
TARGET=/var/www/dashboard.lightor/dist
STAGING=temp_dashboard_dist

[ -f "$KEY" ] || { echo "✗ ssh key not found at $KEY"; exit 1; }

echo "🚀 1/4  Building locally..."
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
  sudo cp -r "$STAGING"/* "$TARGET"/
  sudo chown -R www-data:www-data "$TARGET"
  rm -rf "$STAGING"
EOF

echo "✅ 4/4  the owner dashboard deployed."
