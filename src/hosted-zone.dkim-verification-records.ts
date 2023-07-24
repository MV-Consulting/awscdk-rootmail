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
// NOTE: keep in sync with src/functions/hosted_zone_dkim_verification_records_cr.py
export const PROP_DOMAIN = 'Domain';
export const ATTR_VERIFICATION_TOKEN = 'VerificationToken';
export const ATTR_DKIM_TOKENS = 'DkimTokens';

export interface HostedZoneDKIMAndVerificationRecordsProps {
  readonly domain: string;
}

export class HostedZoneDKIMAndVerificationRecords extends Construct {
  public readonly verificationToken: string;
  public readonly dkimTokens: string[];

  constructor(scope: Construct, id: string, props: HostedZoneDKIMAndVerificationRecordsProps) {
    super(scope, id);

    const resource = new CustomResource(this, 'Resource', {
      serviceToken: HostedZoneDKIMAndVerificationRecordsProvider.getOrCreate(this),
      resourceType: 'Custom::HostedZoneDKIMAndVerificationRecords',
      properties: {
        [PROP_DOMAIN]: props.domain,
      },
    });

    this.verificationToken = resource.getAttString(ATTR_VERIFICATION_TOKEN);
    this.dkimTokens = resource.getAtt(ATTR_DKIM_TOKENS).toStringList();
  }
}

class HostedZoneDKIMAndVerificationRecordsProvider extends Construct {

  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct) {
    const stack = Stack.of(scope);
    const id = 'superwerker.ses-receipt-ruleset-activation-provider';
    const x = Node.of(stack).tryFindChild(id) as HostedZoneDKIMAndVerificationRecordsProvider
      || new HostedZoneDKIMAndVerificationRecordsProvider(stack, id);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const hostedZoneDKIMAndVerificationRecordsCustomResource = new PythonFunction(this, 'HostedZoneDKIMAndVerificationRecordsCustomResource', {
      entry: path.join(__dirname, 'functions', 'hosted_zone_dkim_verification_records_cr'),
      handler: 'handler',
      runtime: lambda.Runtime.PYTHON_3_10,
      timeout: Duration.seconds(200),
      environment: {},
      bundling: {
        assetExcludes: [
          '__pycache__',
          '.pytest_cache',
          'venv',
        ],
      },
    });

    hostedZoneDKIMAndVerificationRecordsCustomResource.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ses:VerifyDomainDkim',
        'ses:VerifyDomainIdentity',
      ],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
    }));

    this.provider = new cr.Provider(this, 'ses-receipt-ruleset-activation-provider', {
      onEventHandler: hostedZoneDKIMAndVerificationRecordsCustomResource,
    });
  };
}