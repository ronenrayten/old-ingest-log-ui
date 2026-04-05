#!/usr/bin/env bash
# Upload production build to a Google Cloud Storage bucket.
# Prereqs: gcloud CLI, authenticated (`gcloud auth login`), project set.
#
# One-time bucket + public static site (replace NAME with a globally unique bucket name):
#   gcloud storage buckets create gs://NAME --location=us-central1 --uniform-bucket-level-access
#   gcloud storage buckets update gs://NAME --web-main-page-suffix=index.html --web-error-page=index.html
#   gcloud storage buckets add-iam-policy-binding gs://NAME --member=allUsers --role=roles/storage.objectViewer
#
# Then deploy:
#   GCS_BUCKET=NAME npm run deploy:gcs
#
# Production API: set VITE_BACKEND_URL when building (no Vite proxy on GCS), e.g. in .env.production:
#   VITE_BACKEND_URL=https://your-api.run.app

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUCKET="${GCS_BUCKET:-}"
if [[ -z "$BUCKET" ]]; then
  echo "Set GCS_BUCKET to your bucket name (no gs:// prefix), e.g.:" >&2
  echo "  GCS_BUCKET=my-proscout-ingest-ui npm run deploy:gcs" >&2
  exit 1
fi

npm run build

echo "Syncing dist/ → gs://${BUCKET}/ ..."
gcloud storage rsync --recursive dist "gs://${BUCKET}"

echo "Done."
echo "Open: https://storage.googleapis.com/${BUCKET}/index.html"
