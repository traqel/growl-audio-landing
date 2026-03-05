# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Growl Audio Landing Page — a static HTML/CSS/JS landing page deployed to AWS via CDK. The project has two distinct parts with separate build systems:

1. **Frontend** (root) — Vite-based static site
2. **Infrastructure** (deploy/) — AWS CDK TypeScript app

## Commands

### Frontend

```bash
npm run dev       # Start Vite dev server
npm run build     # Build to dist/
npm run preview   # Preview production build
```

### CDK Deployment (run from deploy/)

```bash
cd deploy
npm install
npm run build     # Compile CDK TypeScript
npm run synth     # Synthesize CloudFormation template
npm run deploy    # Deploy to AWS
npm run diff      # Show infrastructure diff
npm run destroy   # Tear down the stack
```

## Architecture

### Frontend → Infrastructure Flow

1. `npm run build` (root) outputs static assets to `dist/`
2. CDK stack (`deploy/stacks/website-stack.ts`) reads `../dist` and deploys it to S3
3. CloudFront serves the S3 bucket with HTTPS redirect and cache invalidation on deploy

### CDK Stack: `WebsiteStack`

- **S3 Bucket** — public website hosting, `RETAIN` removal policy (bucket survives `cdk destroy`)
- **CloudFront Distribution** — `PRICE_CLASS_100` (US/EU/Asia), OAC origin, gzip compression, SPA fallback (403/404 → `/index.js`)
- **ACM Certificate** — conditionally created if `SUBDOMAIN` + `ZONE_NAME` env vars are set; DNS-validated via Route 53
- **Route 53 A Record** — alias to CloudFront, only created when domain config is provided

### Environment Variables (for `deploy/`)

| Variable | Required | Purpose |
|---|---|---|
| `AWS_ACCOUNT_ID` | Yes | Target AWS account |
| `AWS_REGION` | No | Default: `us-east-1` |
| `DOMAIN_NAME` | No | Full domain (informational) |
| `SUBDOMAIN` | No | Subdomain (e.g. `www`) |
| `ZONE_NAME` | No | Route 53 hosted zone (e.g. `example.com`) |

The deploy app uses `dotenv` — create a `deploy/.env` file for local deployments.

### Known Issue

The CloudFront `defaultRootObject` and SPA error responses point to `/index.js` but the actual entry point from Vite's build is `index.html`. This may need to be corrected to `index.html` when the frontend is further developed.
