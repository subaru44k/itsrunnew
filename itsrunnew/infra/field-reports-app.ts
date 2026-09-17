import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

const app = new cdk.App();
const environment = app.node.tryGetContext('environment');
if (!['preview','production'].includes(environment)) throw new Error('Pass -c environment=preview or production');
const origins = environment === 'production' ? ['https://itsrun.info'] : ['https://d2xryux7a95b54.cloudfront.net','http://127.0.0.1:4173'];
const stack = new cdk.Stack(app, `ItsRunFieldReports${environment === 'production' ? 'Production' : 'Preview'}Stack`, {env:{account:process.env.CDK_DEFAULT_ACCOUNT,region:'ap-northeast-1'}});
const table = new dynamodb.Table(stack,'Reports',{
  partitionKey:{name:'pk',type:dynamodb.AttributeType.STRING},sortKey:{name:'sk',type:dynamodb.AttributeType.STRING},
  billingMode:dynamodb.BillingMode.PAY_PER_REQUEST,timeToLiveAttribute:'expiresAt',
  pointInTimeRecoverySpecification:{pointInTimeRecoveryEnabled:true},removalPolicy:cdk.RemovalPolicy.RETAIN,
});
const secret = new secretsmanager.Secret(stack,'AbuseSecret',{generateSecretString:{passwordLength:64,excludePunctuation:true}});
const logGroup = new logs.LogGroup(stack,'ApiLogs',{retention:logs.RetentionDays.ONE_WEEK,removalPolicy:cdk.RemovalPolicy.DESTROY});
const handler = new lambda.Function(stack,'ApiHandler',{
  runtime:lambda.Runtime.NODEJS_22_X,handler:'index.handler',code:lambda.Code.fromAsset(path.resolve('backend/field-reports'),{exclude:['*.test.mjs','package-lock.json']}),
  timeout:cdk.Duration.seconds(10),memorySize:256,reservedConcurrentExecutions:5,logGroup,
  environment:{TABLE_NAME:table.tableName,ALLOWED_ORIGINS:JSON.stringify(origins),ABUSE_SECRET:secret.secretValue.unsafeUnwrap()},
});
table.grant(handler,'dynamodb:Query','dynamodb:PutItem','dynamodb:UpdateItem');
const api = new apigateway.HttpApi(stack,'Api',{corsPreflight:{allowOrigins:origins,allowMethods:[apigateway.CorsHttpMethod.GET,apigateway.CorsHttpMethod.POST,apigateway.CorsHttpMethod.OPTIONS],allowHeaders:['content-type'],maxAge:cdk.Duration.hours(1)}});
api.addRoutes({path:'/reports',methods:[apigateway.HttpMethod.GET,apigateway.HttpMethod.POST],integration:new HttpLambdaIntegration('ReportsIntegration',handler)});
const stage = api.defaultStage!.node.defaultChild as apigateway.CfnStage;
stage.defaultRouteSettings = {throttlingBurstLimit:40,throttlingRateLimit:20};
cdk.Tags.of(stack).add('Project','ItsRun');
cdk.Tags.of(stack).add('Environment',environment === 'production' ? 'Production' : 'Preview');
new cdk.CfnOutput(stack,'ApiUrl',{value:api.apiEndpoint});
new cdk.CfnOutput(stack,'TableName',{value:table.tableName});
