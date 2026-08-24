#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ItsRunPreviewStack } from './itsrun-preview-stack';

const app = new cdk.App();
new ItsRunPreviewStack(app, 'ItsRunPreviewStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  description: 'Isolated preview hosting for the modernized ItsRun static website',
});
