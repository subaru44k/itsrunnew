import * as cdk from 'aws-cdk-lib';
import { ItsRunSchedulerStack } from './itsrun-scheduler-stack';
new ItsRunSchedulerStack(new cdk.App(), 'ItsRunSchedulerStack', { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1' } });
