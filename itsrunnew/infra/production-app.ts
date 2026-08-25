#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ItsRunProductionStack } from './itsrun-production-stack';

const app = new cdk.App();
new ItsRunProductionStack(app, 'ItsRunProductionStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  description: 'Production S3 and CloudFront hosting for ItsRun',
  domainName: process.env.ITSRUN_PRODUCTION_DOMAIN,
  certificateArn: process.env.ITSRUN_PRODUCTION_CERTIFICATE_ARN,
});
