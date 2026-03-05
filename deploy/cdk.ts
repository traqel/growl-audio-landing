#!/usr/bin/env node
import "dotenv/config";
import * as cdk from "aws-cdk-lib";
import { WebsiteStack } from "./stacks/website-stack";

const app = new cdk.App();

new WebsiteStack(app, "GrowlAudioWebsite", {
  env: {
    account: process.env.AWS_ACCOUNT_ID,
    region: process.env.AWS_REGION || "us-east-1",
  },
  domainName: process.env.DOMAIN_NAME,
  subdomain: process.env.SUBDOMAIN,
  zoneName: process.env.ZONE_NAME,
});
