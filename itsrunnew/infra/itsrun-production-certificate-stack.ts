import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

interface ItsRunProductionCertificateStackProps extends cdk.StackProps {
  hostedZoneId: string;
}

export class ItsRunProductionCertificateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ItsRunProductionCertificateStackProps) {
    super(scope, id, props);
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: 'itsrun.info',
    });
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: 'itsrun.info',
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
    cdk.Tags.of(this).add('Project', 'ItsRun');
    cdk.Tags.of(this).add('Environment', 'Production');
    new cdk.CfnOutput(this, 'CertificateArn', { value: certificate.certificateArn });
  }
}
