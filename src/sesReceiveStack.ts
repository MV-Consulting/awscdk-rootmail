import * as path from 'path';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
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

    const sesReceiptRuleSetActivationCustomResourceRole = new iam.Role(this, 'SesReceiptRuleSetActivationCustomResourceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromManagedPolicyName(this, 'SesReceiptAWSLambdaBasicExecutionRole', 'AWSLambdaBasicExecutionRole')],
      inlinePolicies: {
        AllowSesAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['ses:*'], // TODO: least privilege
              resources: ['*'],
            }),

          ],
        }),
      },
    });

    // custom resource to activate SES receipt rule set
    new SESReceiptRuleSetActivation(this, 'SESReceiptRuleSetActivation', {
      domain: props.domain,
      subdomain: props.subdomain,
      emailbucketName: props.emailbucket.bucketName,
      sesReceiptRuleSetActivationCustomResourceRole: sesReceiptRuleSetActivationCustomResourceRole,
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

    const opsSantaFunction = new PythonFunction(this, 'OpsSantaFunction', {
      entry: path.join(__dirname, 'functions', 'ops_santa_function'),
      handler: 'handler',
      role: opsSantaFunctionRole,
      runtime: lambda.Runtime.PYTHON_3_9,
      timeout: Duration.seconds(60),
      environment: {
      },
      bundling: {
        assetExcludes: [
          '__pycache__',
          '.pytest_cache',
          'venv',
        ],
      },
    });

    opsSantaFunction.addPermission('OpsSantaFunctionSESPermissions', {
      principal: opsSantaFunctionSESPermissions,
      action: 'lambda:InvokeFunction',
      sourceAccount: Stack.of(this).account,
    });
  }
}