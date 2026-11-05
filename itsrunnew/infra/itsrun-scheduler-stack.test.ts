import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ItsRunSchedulerStack } from './itsrun-scheduler-stack';
describe('availability scheduler infrastructure', () => {
  it('starts disabled and uses JST schedules, bounded retries and scoped credentials', () => {
    const template = Template.fromStack(new ItsRunSchedulerStack(new App(), 'SchedulerTest', { env: { account: '470447451992', region: 'ap-northeast-1' } }));
    const schedules = Object.values(template.findResources('AWS::Scheduler::Schedule'));
    expect(schedules).toHaveLength(3);
    for (const resource of schedules) {
      expect(resource.Properties.ScheduleExpressionTimezone).toBe('Asia/Tokyo');
      expect(resource.Properties.State).toEqual({ Ref: 'SchedulerState' });
      expect(resource.Properties.FlexibleTimeWindow.Mode).toBe('OFF');
      expect(resource.Properties.Target.RetryPolicy.MaximumEventAgeInSeconds).toBe(900);
    }
    const json = template.toJSON();
    expect(json.Parameters.SchedulerState.Default).toBe('DISABLED');
    const functions = Object.values(template.findResources('AWS::Lambda::Function'));
    expect(functions[0].Properties.Runtime).toBe('nodejs24.x');
    expect(functions[0].Properties.MemorySize).toBe(128);
    template.resourceCountIs('AWS::Route53::RecordSet', 0);
    template.resourceCountIs('AWS::EC2::VPC', 0);
    const policies = JSON.stringify(template.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('secretsmanager:PutSecretValue');
    expect(policies).toContain('secretsmanager:GetSecretValue');
    expect(policies).not.toContain('secretsmanager:*');
    const roles = JSON.stringify(template.findResources('AWS::IAM::Role'));
    expect(roles).toContain('repo:subaru44k/itsrunnew:ref:refs/heads/master');
    expect(roles).toContain('aws:SourceArn');
  }, 20_000);
});
