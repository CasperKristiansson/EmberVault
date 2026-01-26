# EmberVault Infrastructure (Pulumi)

This stack provisions S3 + CloudFront + Route53 for a static SvelteKit build.

## Deploy

```bash
cd infra
pulumi login
AWS_PROFILE=Personal pulumi up
```

## Upload the site

```bash
pnpm build
AWS_PROFILE=Personal aws s3 sync ../build s3://$(pulumi stack output bucket) --delete
AWS_PROFILE=Personal aws cloudfront create-invalidation \
  --distribution-id $(pulumi stack output distributionId) \
  --paths "/*"
```

## Notes

The domain and hosted zone are hardcoded in `infra/index.ts`. To change them,
edit that file and re-run `pulumi up`.
