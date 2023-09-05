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
import { PROP_DOMAIN } from './hosted-zone-dkim-propagation.on-event-handler';

export interface HostedZoneDKIMPropagationProps {
  readonly domain: string;
}

export class HostedZoneDKIMPropagation extends Construct {
  constructor(scope: Construct, id: string, props: HostedZoneDKIMPropagationProps) {
    super(scope, id);

    new CustomResource(this, 'Resource', {
      serviceToken: HostedZoneDKIMPropagationProvider.getOrCreate(this),
      resourceType: 'Custom::HostedZoneDKIMPropagation',
      properties: {
        [PROP_DOMAIN]: props.domain,
      },
    });
  }
}

class HostedZoneDKIMPropagationProvider extends Construct {

  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct) {
    const stack = Stack.of(scope);
    const id = 'superwerker.hosted-zone-dkim-propagation-provider';
    const x = Node.of(stack).tryFindChild(id) as HostedZoneDKIMPropagationProvider
      || new HostedZoneDKIMPropagationProvider(stack, id);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.provider = new cr.Provider(this, 'hosted-zone-dkim-propagation-provider', {
      isCompleteHandler: new NodejsFunction(this, 'is-complete-handler', {
        runtime: lambda.Runtime.NODEJS_18_X,
        logRetention: 3, // TODO
        timeout: Duration.seconds(30), // TODO
        initialPolicy: [
          new iam.PolicyStatement({
            actions: [
              'ses:GetIdentityVerificationAttributes',
              'ses:GetAccountSendingEnabled',
              'ses:GetIdentityDkimAttributes',
              'ses:GetIdentityNotificationAttributes',
            ],
            effect: iam.Effect.ALLOW,
            resources: ['*'],
          }),
        ],
      }),
      queryInterval: Duration.seconds(10), // TODO
      totalTimeout: Duration.hours(2), // TODO make configurable
      onEventHandler: new NodejsFunction(this, 'on-event-handler', {
        runtime: lambda.Runtime.NODEJS_18_X,
        logRetention: 3,
        timeout: Duration.seconds(10),
      }),
    });
  };
}

