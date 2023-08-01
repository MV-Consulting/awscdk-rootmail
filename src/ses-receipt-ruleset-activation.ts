import {
  CustomResource,
  Duration,
  Stack,
  aws_iam as iam,
  aws_lambda as lambda,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct, Node } from 'constructs';
// TODO from func
export const PROP_DOMAIN = 'Domain';
export const PROP_SUBDOMAIN = 'Subdomain';
export const PROP_EMAILBUCKET = 'EmailBucket';
export const PROP_OPS_SANTA_FUNCTION_ARN = 'OpsSantaFunctionArn';

export interface SESReceiptRuleSetActivationProps {
  readonly domain: string;
  readonly subdomain: string;
  readonly emailbucketName: string;
}

export class SESReceiptRuleSetActivation extends Construct {
  constructor(scope: Construct, id: string, props: SESReceiptRuleSetActivationProps) {
    super(scope, id);

    new CustomResource(this, 'Resource', {
      serviceToken: SESReceiptRuleSetActivationProvider.getOrCreate(this),
      resourceType: 'Custom::SESReceiptRuleSetActivation',
      properties: {
        [PROP_DOMAIN]: props.domain,
        [PROP_SUBDOMAIN]: props.subdomain,
        [PROP_EMAILBUCKET]: props.emailbucketName,
      },
    });
  }
}

class SESReceiptRuleSetActivationProvider extends Construct {

  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct) {
    const stack = Stack.of(scope);
    const id = 'superwerker.ses-receipt-ruleset-activation-provider';
    const x = Node.of(stack).tryFindChild(id) as SESReceiptRuleSetActivationProvider
      || new SESReceiptRuleSetActivationProvider(stack, id);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.provider = new cr.Provider(this, 'ses-receipt-ruleset-activation-provider', {
      onEventHandler: new NodejsFunction(this, 'on-event-handler', {
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_18_X,
        role: new iam.Role(this, 'SesReceiptRuleSetActivationCustomResourceRole', {
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
        }),
        timeout: Duration.seconds(10),
        //  Note: we use the resource properties from above as it is a CustomResource
        environment: {},
      }),
    });
  }
}