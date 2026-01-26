import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const siteDomain = "embervault.casperkristiansson.com";
const hostedZoneName = "casperkristiansson.com";
const includeWww = true;
const bucketName = siteDomain;
const forceDestroy = false;
const priceClass = "PriceClass_100";

const zone = aws.route53.getZoneOutput({
  name: hostedZoneName,
  privateZone: false,
});

const domainAliases = includeWww
  ? [siteDomain, `www.${siteDomain}`]
  : [siteDomain];

const eastRegionProvider = new aws.Provider("east-region", {
  region: "us-east-1",
});

const certificate = new aws.acm.Certificate(
  "site-cert",
  {
    domainName: siteDomain,
    validationMethod: "DNS",
    subjectAlternativeNames: includeWww ? [`www.${siteDomain}`] : [],
  },
  { provider: eastRegionProvider }
);

const validationRecords = certificate.domainValidationOptions.apply((options) =>
  options.map(
    (option, index) =>
      new aws.route53.Record(`site-cert-validation-${index}`, {
        zoneId: zone.zoneId,
        name: option.resourceRecordName,
        type: option.resourceRecordType,
        records: [option.resourceRecordValue],
        ttl: 60,
      })
  )
);

const validationRecordFqdns = validationRecords.apply((records) =>
  records.map((record) => record.fqdn)
);

const certificateValidation = new aws.acm.CertificateValidation(
  "site-cert-validation",
  {
    certificateArn: certificate.arn,
    validationRecordFqdns,
  },
  { provider: eastRegionProvider }
);

const siteBucket = new aws.s3.Bucket("site-bucket", {
  bucket: bucketName,
  forceDestroy,
});

new aws.s3.BucketOwnershipControls("site-bucket-ownership", {
  bucket: siteBucket.id,
  rule: {
    objectOwnership: "BucketOwnerEnforced",
  },
});

new aws.s3.BucketPublicAccessBlock("site-bucket-public-access", {
  bucket: siteBucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

const originAccessControl = new aws.cloudfront.OriginAccessControl("site-oac", {
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
  description: "EmberVault static site OAC",
});

const distribution = new aws.cloudfront.Distribution("site-cdn", {
  enabled: true,
  defaultRootObject: "index.html",
  aliases: domainAliases,
  origins: [
    {
      originId: siteBucket.arn,
      domainName: siteBucket.bucketRegionalDomainName,
      originAccessControlId: originAccessControl.id,
      s3OriginConfig: {
        originAccessIdentity: "",
      },
    },
  ],
  defaultCacheBehavior: {
    targetOriginId: siteBucket.arn,
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    cachedMethods: ["GET", "HEAD", "OPTIONS"],
    compress: true,
    forwardedValues: {
      cookies: { forward: "none" },
      queryString: false,
    },
  },
  customErrorResponses: [
    { errorCode: 403, responseCode: 200, responsePagePath: "/200.html" },
    { errorCode: 404, responseCode: 200, responsePagePath: "/200.html" },
  ],
  priceClass,
  restrictions: {
    geoRestriction: { restrictionType: "none" },
  },
  viewerCertificate: {
    acmCertificateArn: certificateValidation.certificateArn,
    sslSupportMethod: "sni-only",
    minimumProtocolVersion: "TLSv1.2_2021",
  },
});

new aws.s3.BucketPolicy("site-bucket-policy", {
  bucket: siteBucket.id,
  policy: pulumi
    .all([siteBucket.arn, distribution.arn])
    .apply(([bucketArn, distributionArn]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "cloudfront.amazonaws.com" },
            Action: "s3:GetObject",
            Resource: `${bucketArn}/*`,
            Condition: {
              StringEquals: {
                "AWS:SourceArn": distributionArn,
              },
            },
          },
        ],
      })
    ),
});

new aws.route53.Record("site-alias-record", {
  zoneId: zone.zoneId,
  name: siteDomain,
  type: "A",
  aliases: [
    {
      name: distribution.domainName,
      zoneId: distribution.hostedZoneId,
      evaluateTargetHealth: false,
    },
  ],
});

if (includeWww) {
  new aws.route53.Record("site-www-alias-record", {
    zoneId: zone.zoneId,
    name: `www.${siteDomain}`,
    type: "A",
    aliases: [
      {
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  });
}

export const bucket = siteBucket.bucket;
export const distributionId = distribution.id;
export const distributionDomain = distribution.domainName;
export const siteUrl = pulumi.interpolate`https://${siteDomain}`;
