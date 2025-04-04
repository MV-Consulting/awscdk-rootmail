import {
  CustomResource,
  Duration,
  Stack,
  aws_iam as iam,
  aws_lambda as lambda,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';
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
    const id = 'rootmail.hosted-zone-dkim-verification-records-provider';
    const x = Node.of(stack).tryFindChild(id) as HostedZoneDKIMAndVerificationRecordsProvider
      || new HostedZoneDKIMAndVerificationRecordsProvider(stack, id);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandlerFunc = new NodejsFunction(this, 'on-event-handler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      logRetention: 1,
      timeout: Duration.seconds(200),
    });

    onEventHandlerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'ses:VerifyDomainDkim',
          'ses:VerifyDomainIdentity',
          'ses:DeleteIdentity',
        ],
        resources: ['*'],
      }),
    );

    this.provider = new cr.Provider(this, 'hosted-zone-dkim-verification-records-provider', {
      onEventHandler: onEventHandlerFunc,
      logRetention: 1,
    });
    NagSuppressions.addResourceSuppressions(
      [
        this.provider,
        this.provider.onEventHandler,
        this.provider.onEventHandler.role!,
      ],
      [
        { id: 'AwsSolutions-IAM4', reason: 'no service role restriction needed' },
        { id: 'AwsSolutions-IAM5', reason: 'wildcards are ok for the provider as the function has restrictions' },
      ], true);
  };
}