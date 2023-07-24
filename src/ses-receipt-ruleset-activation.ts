import * as path from 'path';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import {
  CustomResource,
  Duration,
  Stack,
  aws_lambda as lambda,
  aws_iam as iam,
} from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct, Node } from 'constructs';
// NOTE: keep in sync with src/functions/ses_receipt_rule_set_activation_cr.py
export const PROP_DOMAIN = 'Domain';
export const PROP_SUBDOMAIN = 'Subdomain';
export const PROP_EMAILBUCKET = 'EmailBucket';
export const PROP_OPS_SANTA_FUNCTION_ARN = 'OpsSantaFunctionArn';

export interface SESReceiptRuleSetActivationProps {
  readonly domain: string;
  readonly subdomain: string;
  readonly emailbucketName: string;
  readonly sesReceiptRuleSetActivationCustomResourceRole: iam.IRole;
}

export class SESReceiptRuleSetActivation extends Construct {
  // public readonly email: string;
  constructor(scope: Construct, id: string, props: SESReceiptRuleSetActivationProps) {
    super(scope, id);

    new CustomResource(this, 'Resource', {
      serviceToken: SESReceiptRuleSetActivationProvider.getOrCreate(this, {
        sesReceiptRuleSetActivationCustomResourceRole: props.sesReceiptRuleSetActivationCustomResourceRole,
      }),
      resourceType: 'Custom::SESReceiptRuleSetActivation',
      properties: {
        [PROP_DOMAIN]: props.domain,
        [PROP_SUBDOMAIN]: props.subdomain,
        [PROP_EMAILBUCKET]: props.emailbucketName,
      },
    });

    // Note: We do not have any return values
    // this.email = resource.getAttString(ATTR_EMAIL);
  }
}

interface SESReceiptRuleSetActivationProviderProps {
  sesReceiptRuleSetActivationCustomResourceRole: iam.IRole;
}

class SESReceiptRuleSetActivationProvider extends Construct {

  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct, props: SESReceiptRuleSetActivationProviderProps) {
    const stack = Stack.of(scope);
    const id = 'superwerker.ses-receipt-ruleset-activation-provider';
    const x = Node.of(stack).tryFindChild(id) as SESReceiptRuleSetActivationProvider || new SESReceiptRuleSetActivationProvider(stack, id, props);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string, props: SESReceiptRuleSetActivationProviderProps) {
    super(scope, id);

    this.provider = new cr.Provider(this, 'ses-receipt-ruleset-activation-provider', {
      onEventHandler: new PythonFunction(this, 'SESReceiptRulesetActivationOnEvent', {
        entry: path.join(__dirname, 'functions', 'ses_receipt_rule_set_activation_cr'),
        handler: 'handler',
        // TODO maybe use 'addToRolePolicy' as well?
        role: props.sesReceiptRuleSetActivationCustomResourceRole,
        runtime: lambda.Runtime.PYTHON_3_10,
        timeout: Duration.seconds(10),
        //  Note: we use the resource properties from above as it is a CustomResource
        environment: {},
        bundling: {
          assetExcludes: [
            '__pycache__',
            '.pytest_cache',
            'venv',
          ],
        },
      }),
    });
  }
}