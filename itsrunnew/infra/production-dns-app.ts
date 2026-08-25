#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ItsRunProductionDnsStack } from './itsrun-production-dns-stack';

const app = new cdk.App();
new ItsRunProductionDnsStack(app, 'ItsRunProductionDnsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  description: 'Route 53 public hosted zone for the ItsRun production domain',
});
