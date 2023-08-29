import {
  Arn,
  ArnFormat,
  Aspects,
  CfnResource,
  Duration,
  IAspect,
  RemovalPolicy,
  Stack,
  StackProps,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct, IConstruct } from 'constructs';
import { SESReceiptRuleSetActivation } from './ses-receipt-ruleset-activation';

export interface SESReceiveStackProps extends StackProps {
  /**
   * Domain used for root mail feature. Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information
   */
  readonly domain: string;

  /**
   * Subdomain used for root mail feature. Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information
   */
  readonly subdomain: string;

  /**
   * S3 bucket to store received emails
   */
  readonly emailbucket: s3.Bucket;

  /**
   * Region where the root mail feature is deployed.
   */
  readonly rootMailDeployRegion: string;

  /**
   * Time in seconds to wait for the SES receipt rule set to settle.
   *
   * The reason is that although the rule is active immediately, it takes some time for the rule to
   * really forwards incoming mails to the S3 bucket and the Lambda function. During tests 120 seconds
   * were enough to wait for the rule to settle. This propery is offered to lower it for testing purposes.
   *
   * @default 120
   */
  readonly rulesetSettleTimeSeconds?: number;

  /**
   * Whether to set all removal policies to DESTROY. This is useful for integration testing purposes.
   */
  readonly setDestroyPolicyToAllResources?: boolean;
}

export class SESReceiveStack extends Stack {
  constructor(scope: Construct, id: string, props: SESReceiveStackProps) {
    super(scope, id, props);

    const rulesetSettleTimeSeconds = props.rulesetSettleTimeSeconds ?? 120;

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
                // arn:${AWS::Partition}:ssm:${AWS::Region}:${AWS::AccountId}:parameter/superwerker/*
                // arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
                Arn.format({
                  partition: Stack.of(this).partition,
                  service: 'ssm',
                  region: props.rootMailDeployRegion,
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

    const opsSantaFunction = new NodejsFunction(this, 'ops-santa-handler', {
      handler: 'handler',
      role: opsSantaFunctionRole,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(60),
      logRetention: 3,
      environment: {
        EMAIL_BUCKET: props.emailbucket.bucketName,
        EMAIL_BUCKET_ARN: props.emailbucket.bucketArn,
        ROOTMAIL_DEPLOY_REGION: props.rootMailDeployRegion,
      },
    });

    opsSantaFunction.addPermission('OpsSantaFunctionSESPermissions', {
      principal: opsSantaFunctionSESPermissions,
      action: 'lambda:InvokeFunction',
      sourceAccount: Stack.of(this).account,
    });

    // CR to activate SES receipt rule set
    new SESReceiptRuleSetActivation(this, 'SESReceiptRuleSetActivation', {
      domain: props.domain,
      subdomain: props.subdomain,
      emailbucketName: props.emailbucket.bucketName,
      opsSantaFunctionArn: opsSantaFunction.functionArn,
      rulesetSettleTimeSeconds: rulesetSettleTimeSeconds,
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