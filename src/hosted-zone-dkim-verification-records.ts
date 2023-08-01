import {
  CustomResource,
  Duration,
  Stack,
  aws_iam as iam,
} from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct, Node } from 'constructs';
import { ATTR_VERIFICATION_TOKEN, ATTR_DKIM_TOKENS, PROP_DOMAIN } from './hosted-zone-dkim-verification-records.on-event-handler';

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
    const id = 'superwerker.hosted-zone-dkim-verification-records-provider';
    const x = Node.of(stack).tryFindChild(id) as HostedZoneDKIMAndVerificationRecordsProvider
      || new HostedZoneDKIMAndVerificationRecordsProvider(stack, id);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.provider = new cr.Provider(this, 'hosted-zone-dkim-verification-records-provider', {
      onEventHandler: new lambda.NodejsFunction(this, 'on-event-handler', {
        timeout: Duration.seconds(200),
        initialPolicy: [
          new iam.PolicyStatement({
            resources: ['*'],
            actions: [
              'ses:VerifyDomainDkim',
              'ses:VerifyDomainIdentity',
            ],
          }),
        ],
      }),
    });
  };
}