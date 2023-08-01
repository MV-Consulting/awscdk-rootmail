import * as path from 'path';
import {
  Arn,
  ArnFormat,
  Duration,
  Stack,
  StackProps,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { SESReceiptRuleSetActivation } from './ses-receipt-ruleset-activation';

export interface SESReceiveStackProps extends StackProps {
  readonly domain: string;
  readonly subdomain: string;
  readonly emailbucket: s3.Bucket;
}

export class SESReceiveStack extends Stack {
  constructor(scope: Construct, id: string, props: SESReceiveStackProps) {
    super(scope, id, props);

    // custom resource to activate SES receipt rule set
    new SESReceiptRuleSetActivation(this, 'SESReceiptRuleSetActivation', {
      domain: props.domain,
      subdomain: props.subdomain,
      emailbucketName: props.emailbucket.bucketName,
    });

    const opsSantaFunctionSESPermissions = new iam.ServicePrincipal('ses.amazonaws.com');

    const opsSantaFunctionRole = new iam.Role(this, 'OpsSantaFunctionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromManagedPolicyName(this, 'OpsSantaAWSLambdaBasicExecutionRole', 'AWSLambdaBasicExecutionRole')],
      inlinePolicies: {
        OpsSantaFunctionRolePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
              ],
              resources: [
                props.emailbucket.arnForObjects('RootMail/*'),
                // ${EmailBucket.Arn}/RootMail/*
                // arn:PARTITION:s3:::NAME-OF-YOUR-BUCKET
                // arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
                // Arn.format({
                //   partition: Stack.of(this).partition,
                //   service: 's3',
                //   region: Stack.of(this).region,
                //   account: Stack.of(this).account,
                //   resource: props.emailbucketName,
                //   arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
                //   resourceName: 'RootMail/*',
                // }, Stack.of(this)),
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:CreateOpsItem',
              ],
              resources: [
                '*',
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:PutParameter',
              ],
              resources: [
                // arn:${AWS::Partition}:ssm:${AWS::Region}:${AWS::AccountId}:parameter/superwerker/*
                // arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
                Arn.format({
                  partition: Stack.of(this).partition,
                  service: 'ssm',
                  region: Stack.of(this).region,
                  account: Stack.of(this).account,
                  resource: 'parameter',
                  arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
                  resourceName: 'superwerker/*',
                }, Stack.of(this)),
              ],
            }),

          ],
        }),
      },
    });

    const opsSantaFunction = new NodejsFunction(this, 'OpsSantaFunction', {
      entry: path.join(__dirname, 'functions', 'ops-santa'),
      handler: 'handler',
      role: opsSantaFunctionRole,
      runtime: lambda.Runtime.NODEJS_16_X,
      timeout: Duration.seconds(60),
      environment: {
        AWS_REGION: Stack.of(this).region,
        EMAIL_BUCKET: props.emailbucket.bucketName,
        EMAIL_BUCKET_ARN: props.emailbucket.bucketArn,
      },
    });

    opsSantaFunction.addPermission('OpsSantaFunctionSESPermissions', {
      principal: opsSantaFunctionSESPermissions,
      action: 'lambda:InvokeFunction',
      sourceAccount: Stack.of(this).account,
    });
  }
}