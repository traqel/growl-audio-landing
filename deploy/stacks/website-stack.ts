import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import * as path from "path";

interface WebsiteStackProps extends cdk.StackProps {
  domainName?: string;
  subdomain?: string;
  zoneName?: string;
}

export class WebsiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebsiteStackProps) {
    super(scope, id, props);

    const useCustomDomain = !!props.zoneName;

    // S3 bucket — private, accessed only through CloudFront
    const bucket = new s3.Bucket(this, "WebsiteBucket", {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Certificate + hosted zone (only if domain is configured)
    let certificate: acm.ICertificate | undefined;
    let hostedZone: route53.IHostedZone | undefined;
    const domainNames: string[] = [];

    if (useCustomDomain) {
      // Always include the apex domain
      domainNames.push(props.zoneName!);

      // Optionally include subdomain (e.g. www)
      if (props.subdomain) {
        domainNames.push(`${props.subdomain}.${props.zoneName}`);
      }

      hostedZone = route53.HostedZone.fromLookup(this, "Zone", {
        domainName: props.zoneName!,
      });

      certificate = new acm.Certificate(this, "Certificate", {
        domainName: props.zoneName!,
        subjectAlternativeNames: props.subdomain
          ? [`${props.subdomain}.${props.zoneName}`]
          : undefined,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      defaultRootObject: "index.html",
      domainNames: domainNames.length > 0 ? domainNames : undefined,
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // Deploy site contents to S3 + invalidate CloudFront
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../dist"))],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // Route 53 records
    if (useCustomDomain && hostedZone) {
      // Apex domain → CloudFront
      new route53.ARecord(this, "ApexRecord", {
        zone: hostedZone,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(distribution)
        ),
      });

      // Subdomain → CloudFront (e.g. www)
      // Keep logical ID "AliasRecord" to match the previously deployed resource
      if (props.subdomain) {
        new route53.ARecord(this, "AliasRecord", {
          zone: hostedZone,
          recordName: props.subdomain,
          target: route53.RecordTarget.fromAlias(
            new targets.CloudFrontTarget(distribution)
          ),
        });
      }
    }

    // Outputs
    new cdk.CfnOutput(this, "DistributionDomainName", {
      value: distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "BucketName", {
      value: bucket.bucketName,
    });

    if (useCustomDomain) {
      new cdk.CfnOutput(this, "SiteUrl", {
        value: `https://${props.zoneName}`,
      });
    }
  }
}
