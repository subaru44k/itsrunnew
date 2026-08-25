#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ItsRunProductionCertificateStack } from './itsrun-production-certificate-stack';

const hostedZoneId = process.env.ITSRUN_PRODUCTION_HOSTED_ZONE_ID;
if (!hostedZoneId) throw new Error('ITSRUN_PRODUCTION_HOSTED_ZONE_ID is required.');

const app = new cdk.App();
new ItsRunProductionCertificateStack(app, 'ItsRunProductionCertificateStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  hostedZoneId,
  description: 'CloudFront TLS certificate for itsrun.info',
});
