import {
  Arn,
  ArnFormat,
  Aspects,
  CfnResource,
  Duration,
  IAspect,
  RemovalPolicy,
  Stack,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { NagSuppressions } from 'cdk-nag';
import { Construct, IConstruct } from 'constructs';
import { isSESEnabledRegion, sesEnabledRegions } from './common';
import { SESReceiptRuleSetActivation } from './ses-receipt-ruleset-activation';

/**
 * Properties for the SESReceive construct
 */
export interface SESReceiveProps {
  /**
   * Domain used for root mail feature.
   */
  readonly domain: string;

  /**
   * Subdomain used for root mail feature.
   */
  readonly subdomain: string;

  /**
   * S3 bucket to store received emails
   */
  readonly emailbucket: s3.Bucket;

  /**
   * The custom SES receive function to use
   *
   * @default the provided functions within the construct
   */
  readonly customSesReceiveFunction?: lambda.Function;

  /**
   * Filtered email subjects. NOTE: must not contain commas.
   *
   * @default 2 subjects: 'Your AWS Account is Ready - Get Started Now' and 'Welcome to Amazon Web Services'
   */
  readonly filteredEmailSubjects?: string[];

  /**
   * Whether to set all removal policies to DESTROY. This is useful for integration testing purposes.
   *
   * @default false
   */
  readonly setDestroyPolicyToAllResources?: boolean;
}

/**
 * SES Receive construct
 */
export class SESReceive extends Construct {
  constructor(scope: Construct, id: string, props: SESReceiveProps) {
    super(scope, id);

    const filteredEmailSubjects = props.filteredEmailSubjects || [];

    const deployRegion = Stack.of(this).region;
    if (!isSESEnabledRegion(deployRegion)) {
      throw new Error(`SES is not available in region ${deployRegion}. Use one of the following regions: ${sesEnabledRegions.join(', ')}`);
    }

    const opsSantaFunctionSESPermissions = new iam.ServicePrincipal('ses.amazonaws.com');
    const opsSantaFunctionRole = new iam.Role(this, 'OpsSantaFunctionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
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
                // arn:${AWS::Partition}:ssm:${AWS::Region}:${AWS::AccountId}:parameter/rootmail/*
                // arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
                Arn.format({
                  partition: Stack.of(this).partition,
                  service: 'ssm',
                  region: Stack.of(this).region,
                  account: Stack.of(this).account,
                  resource: 'parameter',
                  arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
                  resourceName: 'rootmail/*',
                }, Stack.of(this)),
              ],
            }),
          ],
        }),
      },
    });
    NagSuppressions.addResourceSuppressions(
      [
        opsSantaFunctionRole,
      ],
      [
        { id: 'AwsSolutions-IAM4', reason: 'no service role restriction needed' },
        { id: 'AwsSolutions-IAM5', reason: 'wildcards are ok as we allow every opsitem to be created' },
      ], true);

    let opsSantaFunction: lambda.Function;
    if (props.customSesReceiveFunction) {
      opsSantaFunction = props.customSesReceiveFunction;
      opsSantaFunction.role?.attachInlinePolicy(new iam.Policy(this, 'CustomSesReceiveFunctionPolicy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              's3:GetObject',
            ],
            resources: [
              props.emailbucket.arnForObjects('RootMail/*'),
            ],
          }),
        ],
      }));
      opsSantaFunction.addEnvironment('EMAIL_BUCKET', props.emailbucket.bucketName);
      opsSantaFunction.addEnvironment('EMAIL_BUCKET_ARN', props.emailbucket.bucketArn);
    } else {
      opsSantaFunction = new NodejsFunction(this, 'ops-santa-handler', {
        handler: 'handler',
        role: opsSantaFunctionRole,
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: Duration.seconds(60),
        logRetention: 3,
        environment: {
          EMAIL_BUCKET: props.emailbucket.bucketName,
          EMAIL_BUCKET_ARN: props.emailbucket.bucketArn,
          ROOTMAIL_DEPLOY_REGION: Stack.of(this).region,
          FILTERED_EMAIL_SUBJECTS: filteredEmailSubjects.join(','),
        },
      });
    }
    // will be added in both ways
    opsSantaFunction.addPermission('OpsSantaFunctionSESPermissions', {
      principal: opsSantaFunctionSESPermissions,
      action: 'lambda:InvokeFunction',
      sourceAccount: Stack.of(this).account,
    });

    // CR to activate SES receipt rule set
    new SESReceiptRuleSetActivation(this, 'SESReceiptRuleSetActivation', {
      domain: props.domain,
      subdomain: props.subdomain,
      emailbucket: props.emailbucket,
      opsSantaFunctionArn: opsSantaFunction.functionArn,
      filteredEmailSubjects: filteredEmailSubjects,
    });

    // If Destroy Policy Aspect is present:
    if (props.setDestroyPolicyToAllResources) {
      Aspects.of(this).add(new ApplyDestroyPolicyAspect());
    }
  }
}

/**
 * Aspect for setting all removal policies to DESTROY
 */
class ApplyDestroyPolicyAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof CfnResource) {
      node.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }
  }
}