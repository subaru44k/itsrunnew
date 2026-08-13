import test from 'node:test'
import assert from 'node:assert/strict'
import { App, assertions } from 'aws-cdk-lib'
import { GitHubDeployStack } from '../bin/app.mjs'

const template = () => {
  const app = new App()
  new GitHubDeployStack(app, 'TestGitHubDeploy')
  return assertions.Template.fromStack(app.node.findChild('TestGitHubDeploy'))
}

test('GitHub deploy stack has only the fixed OIDC provider, role, and outputs', () => {
  const result = template()
  const json = result.toJSON()
  const providers = Object.values(result.findResources('AWS::IAM::OIDCProvider'))
  assert.equal(providers.length, 1)
  assert.deepEqual(providers[0].Properties, {
    ClientIdList: ['sts.amazonaws.com'],
    Tags: [{ Key: 'Purpose', Value: 'ItsRun preview web deployment' }],
    Url: 'https://token.actions.githubusercontent.com',
  })
  const roles = Object.values(result.findResources('AWS::IAM::Role'))
  assert.equal(roles.length, 1)
  const role = roles[0]
  assert.equal(role.Properties.RoleName, 'itsrun-preview-github-web-deploy')
  assert.equal(role.Properties.MaxSessionDuration, 3600)
  assert.equal(role.Properties.Description, 'OIDC role for the reviewed ItsRun preview web deployment workflow.')
  assert.equal(role.DeletionPolicy, 'Retain')
  assert.equal(role.UpdateReplacePolicy, 'Retain')
  assert.deepEqual(role.Properties.Tags, [{ Key: 'Purpose', Value: 'ItsRun preview web deployment' }])
  assert.deepEqual(role.Properties.AssumeRolePolicyDocument.Statement, [{
    Action: 'sts:AssumeRoleWithWebIdentity',
    Condition: { StringEquals: {
      'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
      'token.actions.githubusercontent.com:sub': 'repo:subaru44k/itsrunnew:ref:refs/heads/master',
    } },
    Effect: 'Allow',
    Principal: { Federated: { Ref: Object.keys(result.findResources('AWS::IAM::OIDCProvider'))[0] } },
  }])
  const policy = role.Properties.Policies
  assert.equal(policy.length, 1)
  assert.equal(policy[0].PolicyName, 'PreviewWebDeployment')
  assert.deepEqual(policy[0].PolicyDocument.Statement, [
    {
      Action: 'cloudformation:DescribeStacks',
      Effect: 'Allow',
      Resource: 'arn:aws:cloudformation:ap-northeast-1:470447451992:stack/ItsRunPreviewHosting/*',
    },
    {
      Action: 's3:PutObject',
      Effect: 'Allow',
      Resource: 'arn:aws:s3:::itsrun-preview-web-470447451992-ap-northeast-1/*',
    },
  ])
  assert.equal(json.Resources[Object.keys(result.findResources('AWS::IAM::Role'))[0]].Properties.ManagedPolicyArns, undefined)
  assert.deepEqual(Object.keys(json.Resources).map((key) => json.Resources[key].Type).sort(), ['AWS::IAM::OIDCProvider', 'AWS::IAM::Role'])
})

test('GitHub provider and role outputs are stable references', () => {
  const result = template()
  const outputs = result.findOutputs('*')
  const values = Object.values(outputs)
  assert.equal(values.length, 2)
  assert.ok(values.some((output) => output.Description === undefined && JSON.stringify(output.Value).includes('GetAtt')))
  assert.ok(values.some((output) => output.Description === undefined && JSON.stringify(output.Value).includes('Arn')))
})
