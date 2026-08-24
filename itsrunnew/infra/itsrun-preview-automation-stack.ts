import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

interface ItsRunPreviewAutomationStackProps extends cdk.StackProps {
  githubOidcProviderArn: string;
  previewBucketName: string;
  previewDistributionId: string;
}

export class ItsRunPreviewAutomationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ItsRunPreviewAutomationStackProps) {
    super(scope, id, props);

    const deployRole = new iam.Role(this, 'GitHubPreviewDeployRole', {
      roleName: 'itsrun-track-preview-deploy',
      description: 'Content-only deployment of the ItsRun Track Search Preview from GitHub Actions.',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(props.githubOidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': 'repo:subaru44k/itsrunnew:ref:refs/heads/master',
        },
      }),
    });

    const bucketArn = `arn:${cdk.Aws.PARTITION}:s3:::${props.previewBucketName}`;
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'PreviewBucketMetadata',
      actions: ['s3:GetBucketLocation', 's3:GetBucketTagging', 's3:ListBucket'],
      resources: [bucketArn],
    }));
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'PreviewContentDeployment',
      actions: ['s3:DeleteObject', 's3:GetObject', 's3:PutObject'],
      resources: [`${bucketArn}/*`],
    }));
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'PreviewCloudFrontInvalidation',
      actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetDistribution', 'cloudfront:GetInvalidation'],
      resources: [`arn:${cdk.Aws.PARTITION}:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${props.previewDistributionId}`],
    }));

    cdk.Tags.of(this).add('Project', 'ItsRun');
    cdk.Tags.of(this).add('Environment', 'Preview');
    cdk.Tags.of(this).add('Purpose', 'GitHub content deployment');

    new cdk.CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
  }
}
