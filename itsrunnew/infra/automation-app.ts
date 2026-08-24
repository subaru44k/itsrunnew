#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ItsRunPreviewAutomationStack } from './itsrun-preview-automation-stack';

const account = '470447451992';
const region = 'ap-northeast-1';
const app = new cdk.App();

new ItsRunPreviewAutomationStack(app, 'ItsRunPreviewAutomationStack', {
  env: { account, region },
  description: 'GitHub OIDC role for content-only deployment to the isolated ItsRun Preview',
  githubOidcProviderArn: `arn:aws:iam::${account}:oidc-provider/token.actions.githubusercontent.com`,
  previewBucketName: 'itsrunpreviewstack-sitebucket397a1860-khjbgxk7mmdb',
  previewDistributionId: 'E2F8WYHWRDA3NS',
});
