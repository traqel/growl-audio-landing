import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import {Construct} from 'constructs';

export interface WebsiteStackProps extends cdk.StackProps {
    domainName?: string;
    subdomain?: string;
    zoneName?: string;
}

export class WebsiteStack extends cdk.Stack {
    public readonly distribution: cloudfront.Distribution;
    public readonly bucket: s3.IBucket;

    constructor(scope: Construct, id: string, props: WebsiteStackProps) {
        super(scope, id, props);

        // If subdomain is 'www' or unset, the canonical site lives at the apex.
        // A real subdomain (e.g. 'app') is the only case where we use subdomain.zoneName.
        const siteDomain = props.zoneName
            ? (props.subdomain && props.subdomain !== 'www'
                ? `${props.subdomain}.${props.zoneName}`
                : props.zoneName)
            : undefined;

        // Look up hosted zone once and reuse across all records
        const hostedZone = props.zoneName
            ? route53.HostedZone.fromLookup(this, 'HostedZone', {
                domainName: props.zoneName,
              })
            : undefined;

        this.bucket = siteDomain
            ? s3.Bucket.fromBucketName(this, 'SiteBucket', siteDomain)
            : new s3.Bucket(this, 'SiteBucket', {
                blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
                removalPolicy: cdk.RemovalPolicy.RETAIN,
                encryption: s3.BucketEncryption.S3_MANAGED,
              });

        let certificate: acm.Certificate | undefined;
        if (siteDomain && hostedZone) {
            certificate = new acm.Certificate(this, 'SiteCertificate', {
                domainName: siteDomain,
                validation: acm.CertificateValidation.fromDns(hostedZone),
            });
        }

        this.distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
                compress: true,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            domainNames: siteDomain ? [siteDomain] : undefined,
            certificate: certificate,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        });

        // For imported buckets, CDK cannot auto-grant OAC access — add the policy explicitly.
        if (siteDomain) {
            this.bucket.addToResourcePolicy(new iam.PolicyStatement({
                actions: ['s3:GetObject'],
                principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
                resources: [this.bucket.arnForObjects('*')],
                conditions: {
                    StringEquals: {
                        'AWS:SourceArn': this.distribution.distributionArn,
                    },
                },
            }));
        }

        // Phase 1: upload all hashed assets first (JS, CSS, images, fonts).
        // These are safe to coexist with old assets because Vite fingerprints filenames.
        // No cache invalidation needed — new filenames are cache-miss by definition.
        const assetsDeployment = new s3deploy.BucketDeployment(this, 'SiteAssetsDeployment', {
            sources: [s3deploy.Source.asset('../dist')],
            destinationBucket: this.bucket,
            exclude: ['index.html'],
            prune: false,
            memoryLimit: 256,
        });

        // Phase 2: swap index.html only after all assets are live, then invalidate.
        // Old users still see old index.html → old hashed assets (still in S3).
        // New users get new index.html → new hashed assets (already uploaded).
        const indexDeployment = new s3deploy.BucketDeployment(this, 'SiteIndexDeployment', {
            sources: [s3deploy.Source.asset('../dist')],
            destinationBucket: this.bucket,
            include: ['index.html'],
            distribution: this.distribution,
            distributionPaths: ['/index.html'],
            prune: true,
            memoryLimit: 256,
        });
        indexDeployment.node.addDependency(assetsDeployment);

        if (siteDomain && hostedZone) {
            new route53.RecordSet(this, 'SiteRecord', {
                recordName: siteDomain,
                recordType: route53.RecordType.A,
                target: route53.RecordTarget.fromAlias(
                    new route53Targets.CloudFrontTarget(this.distribution)
                ),
                zone: hostedZone,
            });
        }

        // www → apex redirect
        if (props.zoneName && hostedZone) {
            const wwwDomain = `www.${props.zoneName}`;

            // Redirect-only bucket — S3 returns 301 to apex via HTTP website endpoint
            new s3.Bucket(this, 'WwwBucket', {
                bucketName: wwwDomain,
                websiteRedirect: {
                    hostName: props.zoneName,
                    protocol: s3.RedirectProtocol.HTTPS,
                },
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });

            const wwwCertificate = new acm.Certificate(this, 'WwwCertificate', {
                domainName: wwwDomain,
                validation: acm.CertificateValidation.fromDns(hostedZone),
            });

            // CloudFront must use HTTP_ONLY to the S3 website endpoint (no OAC support for redirect buckets)
            const wwwDistribution = new cloudfront.Distribution(this, 'WwwDistribution', {
                defaultBehavior: {
                    origin: new origins.HttpOrigin(
                        `${wwwDomain}.s3-website-${this.region}.amazonaws.com`,
                        { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }
                    ),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                },
                domainNames: [wwwDomain],
                certificate: wwwCertificate,
                priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            });

            new route53.RecordSet(this, 'WwwRecord', {
                recordName: wwwDomain,
                recordType: route53.RecordType.A,
                target: route53.RecordTarget.fromAlias(
                    new route53Targets.CloudFrontTarget(wwwDistribution)
                ),
                zone: hostedZone,
            });

            new cdk.CfnOutput(this, 'WwwRedirectUrl', {
                value: wwwDomain,
                description: 'www domain (redirects to apex)',
            });
        }

        new cdk.CfnOutput(this, 'SiteUrl', {
            value: this.distribution.domainName,
            description: 'CloudFront distribution URL',
        });

        if (siteDomain) {
            new cdk.CfnOutput(this, 'SiteDomain', {
                value: siteDomain,
                description: 'Site domain name',
            });
        }
    }
}
