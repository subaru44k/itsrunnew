import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

export class ItsRunProductionDnsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const hostedZone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: 'itsrun.info',
      comment: 'Production DNS for ItsRun. Do not delegate until all existing records are copied.',
    });
    hostedZone.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    cdk.Tags.of(this).add('Project', 'ItsRun');
    cdk.Tags.of(this).add('Environment', 'Production');

    new cdk.CfnOutput(this, 'HostedZoneId', { value: hostedZone.hostedZoneId });
    new cdk.CfnOutput(this, 'NameServers', { value: cdk.Fn.join(',', hostedZone.hostedZoneNameServers ?? []) });
  }
}
