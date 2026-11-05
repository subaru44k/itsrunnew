import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';

export class ItsRunSchedulerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    const state = new cdk.CfnParameter(this, 'SchedulerState', { type: 'String', default: 'DISABLED', allowedValues: ['DISABLED', 'ENABLED'] });
    const secret = new secretsmanager.Secret(this, 'GitHubAppSecret', {
      secretName: 'itsrun/availability-scheduler/github-app',
      description: 'Existing ItsRun GitHub App identity; populated only by protected-master OIDC setup workflow',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const logGroup = new logs.LogGroup(this, 'DispatchLogs', { logGroupName: '/aws/lambda/itsrun-availability-dispatch', retention: logs.RetentionDays.ONE_WEEK, removalPolicy: cdk.RemovalPolicy.DESTROY });
    const dispatch = new lambda.Function(this, 'Dispatch', {
      functionName: 'itsrun-availability-dispatch', runtime: lambda.Runtime.NODEJS_24_X,
      code: lambda.Code.fromAsset(fileURLToPath(new URL('../scripts/scheduler', import.meta.url)), { exclude: ['*.test.ts'] }),
      handler: 'index.handler', memorySize: 128, timeout: cdk.Duration.seconds(45), logGroup,
      environment: { GITHUB_APP_SECRET_ARN: secret.secretArn },
    });
    secret.grantRead(dispatch);
    dispatch.configureAsyncInvoke({ maxEventAge: cdk.Duration.minutes(15), retryAttempts: 2 });
    const group = new scheduler.CfnScheduleGroup(this, 'Schedules', { name: 'itsrun-availability' });
    const invokeRole = new iam.Role(this, 'SchedulerInvokeRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com', { conditions: { StringEquals: { 'aws:SourceAccount': this.account }, ArnEquals: { 'aws:SourceArn': group.attrArn } } }),
    });
    dispatch.grantInvoke(invokeRole);
    for (const [name, expression, eventType] of [
      ['morning', 'cron(30 5 * * ? *)', 'availability-refresh'],
      ['same-day', 'cron(15 8 * * ? *)', 'availability-refresh'],
      ['monitor', 'cron(15 9 * * ? *)', 'availability-monitor'],
    ]) new scheduler.CfnSchedule(this, `${name}Schedule`, {
      name: `itsrun-${name}`, groupName: group.ref, state: state.valueAsString,
      scheduleExpression: expression, scheduleExpressionTimezone: 'Asia/Tokyo', flexibleTimeWindow: { mode: 'OFF' },
      target: { arn: dispatch.functionArn, roleArn: invokeRole.roleArn,
        input: JSON.stringify({ eventType, scheduledTime: '<aws.scheduler.scheduled-time>' }),
        retryPolicy: { maximumEventAgeInSeconds: 900, maximumRetryAttempts: 2 },
      },
    });
    const setup = new iam.Role(this, 'GitHubSetupRole', {
      roleName: 'itsrun-availability-scheduler-configure', maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(`arn:${this.partition}:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`, { StringEquals: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        'token.actions.githubusercontent.com:sub': 'repo:subaru44k/itsrunnew:ref:refs/heads/master',
      } }),
    });
    setup.addToPolicy(new iam.PolicyStatement({ actions: ['secretsmanager:PutSecretValue'], resources: [secret.secretArn] }));
    dispatch.grantInvoke(setup);
    cdk.Tags.of(this).add('Project', 'ItsRun');
    cdk.Tags.of(this).add('Environment', 'Production');
    new cdk.CfnOutput(this, 'SetupRoleArn', { value: setup.roleArn });
    new cdk.CfnOutput(this, 'SecretArn', { value: secret.secretArn });
    new cdk.CfnOutput(this, 'FunctionName', { value: dispatch.functionName });
    new cdk.CfnOutput(this, 'InvokeRoleArn', { value: invokeRole.roleArn });
    new cdk.CfnOutput(this, 'ScheduleGroup', { value: group.ref });
  }
}
