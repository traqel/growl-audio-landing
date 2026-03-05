# Deploy

AWS CDK infrastructure for the Growl Audio Landing page.

## Prerequisites

- Node.js 18+
- AWS credentials configured
- AWS CDK CLI (`npm install -g aws-cdk`)

## Setup

1. Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

2. Edit `.env` with your AWS account details:

```env
AWS_ACCOUNT_ID=your-account-id
AWS_REGION=us-east-1
DOMAIN_NAME=example.com
SUBDOMAIN=www
ZONE_NAME=example.com
```

**Note:** `DOMAIN_NAME`, `SUBDOMAIN`, and `ZONE_NAME` are optional. If not provided, the site will be deployed without a custom domain.

## Install Dependencies

```bash
npm install
```

## Build

```bash
npm run build
```

## Deploy

```bash
npm run deploy
```

Or with a specific AWS profile (set in `.env`):

```bash
export AWS_PROFILE=your-profile && npm run deploy
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch for changes and rebuild |
| `npm run deploy` | Deploy the stack to AWS |
| `npm run destroy` | Delete the stack from AWS |
| `npm run synth` | Synthesize CloudFormation template |
| `npm run diff` | Show differences between deployed stack and local changes |

## Bootstrap (First Time Only)

If deploying for the first time, you need to bootstrap your AWS environment:

```bash
npx cdk bootstrap
```

## Architecture

- **S3 Bucket**: Stores static website files
- **CloudFront Distribution**: CDN for fast content delivery
- **ACM Certificate**: SSL/TLS certificate (if using custom domain)
- **Route53 Record**: DNS alias to CloudFront (if using custom domain)

## Notes

- The deployment reads from the `../dist` folder, so make sure to build your main project first (`npm run build` in the project root)
- CloudFront distribution may take 5-15 minutes to propagate after first deployment
