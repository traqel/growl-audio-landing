import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import {WebsiteStack, WebsiteStackProps} from './stacks/website-stack';

const app = new cdk.App();

const env: WebsiteStackProps = {
    env: {
        account: process.env.AWS_ACCOUNT_ID,
        region: process.env.AWS_REGION || 'us-east-1',
    },
};

const domainName = process.env.DOMAIN_NAME;
const subdomain = process.env.SUBDOMAIN;
const zoneName = process.env.ZONE_NAME;

const props: WebsiteStackProps = {
    ...env,
    description: 'Growl Audio Landing Page',
    domainName: domainName || undefined,
    subdomain: subdomain || undefined,
    zoneName: zoneName || undefined,
};

new WebsiteStack(app, 'GrowlAudioLanding', props);

app.synth();
