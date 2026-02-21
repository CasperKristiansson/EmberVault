# S3 Sync Runbook

## Scope

This runbook covers common EmberVault S3 issues for client-direct sync.

## Quick checks

1. Confirm bucket + region + prefix are correct in Settings.
2. Confirm credentials have `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, and `s3:ListBucket` for the target prefix.
3. Confirm browser can reach `https://<bucket>.s3.<region>.amazonaws.com`.
4. Open Settings and check sync state (`Idle`, `Syncing`, `Offline`, `Needs attention`) plus last error category.

## CORS failures (`cors:` errors, preflight blocked)

Symptoms:
- Browser console shows missing `Access-Control-Allow-Origin`.
- EmberVault error category is `cors`.

Fix:
- Add bucket CORS for your app origins and methods `GET, PUT, DELETE, HEAD`.
- Include headers used by SDK (`content-type`, `x-amz-*`).

Example CORS JSON:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-domain.example"],
    "AllowedMethods": ["GET", "PUT", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Auth failures (`auth:` errors)

Symptoms:
- 401/403 responses.
- Sync state becomes `Needs attention`.

Fix:
- Rotate/replace access key.
- Ensure policy includes both bucket-level list and object-level read/write/delete.
- If using temporary credentials, ensure session token is set.

## Network/timeout failures (`network:` / `timeout:`)

Symptoms:
- `Failed to fetch` or timeout errors.
- Sync state becomes `Offline` with pending count > 0.

Fix:
- Check connectivity and retry.
- Use **Retry sync now** in Settings to drain outbox once back online.

## Migration behavior and conflict semantics

- If target vault exists, migration merges local and remote data.
- For same project + same note name conflicts, incoming migration note wins.
- Startup reconciliation status in Settings reports one of:
  - `remote applied`
  - `local pushed`
  - `new vault created`

## Recovery

1. Export backup from Settings before major changes.
2. If sync remains blocked, switch temporarily to browser storage.
3. Fix S3 policy/CORS/credentials.
4. Reconnect S3 and run **Retry sync now**.

