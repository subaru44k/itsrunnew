import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

interface ItsRunProductionAutomationStackProps extends cdk.StackProps {
  githubOidcProviderArn: string;
  productionBucketName: string;
  productionDistributionId: string;
}

export class ItsRunProductionAutomationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ItsRunProductionAutomationStackProps) {
    super(scope, id, props);

    const deployRole = new iam.Role(this, 'GitHubProductionDeployRole', {
      roleName: 'itsrun-production-content-deploy',
      description: 'Content-only deployment of ItsRun production from the protected master branch.',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(props.githubOidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': 'repo:subaru44k/itsrunnew:ref:refs/heads/master',
        },
      }),
    });

    const bucketArn = `arn:${cdk.Aws.PARTITION}:s3:::${props.productionBucketName}`;
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ProductionBucketMetadata',
      actions: ['s3:GetBucketLocation', 's3:GetBucketTagging', 's3:ListBucket'],
      resources: [bucketArn],
    }));
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ProductionContentDeployment',
      actions: ['s3:DeleteObject', 's3:GetObject', 's3:PutObject'],
      resources: [`${bucketArn}/*`],
    }));
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ProductionCloudFrontInvalidation',
      actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetDistribution', 'cloudfront:GetInvalidation'],
      resources: [`arn:${cdk.Aws.PARTITION}:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${props.productionDistributionId}`],
    }));

    cdk.Tags.of(this).add('Project', 'ItsRun');
    cdk.Tags.of(this).add('Environment', 'Production');
    cdk.Tags.of(this).add('Purpose', 'GitHub content deployment');
    new cdk.CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
  }
}
