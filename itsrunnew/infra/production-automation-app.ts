#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ItsRunProductionAutomationStack } from './itsrun-production-automation-stack';

const account = process.env.CDK_DEFAULT_ACCOUNT;
const productionBucketName = process.env.ITSRUN_PRODUCTION_BUCKET;
const productionDistributionId = process.env.ITSRUN_PRODUCTION_DISTRIBUTION_ID;
if (!account || !productionBucketName || !productionDistributionId) {
  throw new Error('CDK_DEFAULT_ACCOUNT, ITSRUN_PRODUCTION_BUCKET, and ITSRUN_PRODUCTION_DISTRIBUTION_ID are required.');
}

const app = new cdk.App();
new ItsRunProductionAutomationStack(app, 'ItsRunProductionAutomationStack', {
  env: { account, region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1' },
  description: 'GitHub OIDC role for content-only deployment to ItsRun production',
  githubOidcProviderArn: `arn:aws:iam::${account}:oidc-provider/token.actions.githubusercontent.com`,
  productionBucketName,
  productionDistributionId,
});
