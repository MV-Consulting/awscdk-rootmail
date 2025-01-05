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
import { PROP_DOMAIN } from './hosted-zone-dkim-propagation.on-event-handler';

export interface HostedZoneDKIMPropagationProps {
  readonly domain: string;
  readonly totalTimeToWireDNS?: Duration;
}

export class HostedZoneDKIMPropagation extends Construct {
  constructor(scope: Construct, id: string, props: HostedZoneDKIMPropagationProps) {
    super(scope, id);

    // TODO can we pass in custom cloudwatch log groups? so they are deleted on destroy

    new CustomResource(this, 'Resource', {
      serviceToken: HostedZoneDKIMPropagationProvider.getOrCreate(this, { totalTimeToWireDNS: props.totalTimeToWireDNS }),
      resourceType: 'Custom::HostedZoneDKIMPropagation',
      properties: {
        [PROP_DOMAIN]: props.domain,
      },
    });
  }
}

interface HostedZoneDKIMPropagationProviderProps {
  readonly totalTimeToWireDNS?: Duration;
}

class HostedZoneDKIMPropagationProvider extends Construct {

  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct, props: HostedZoneDKIMPropagationProviderProps) {
    const stack = Stack.of(scope);
    const id = 'rootmail.hosted-zone-dkim-propagation-provider';
    const x = Node.of(stack).tryFindChild(id) as HostedZoneDKIMPropagationProvider
      || new HostedZoneDKIMPropagationProvider(stack, id, props);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string, props: HostedZoneDKIMPropagationProviderProps) {
    super(scope, id);

    const isCompleteHandlerFunc = new NodejsFunction(this, 'is-complete-handler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      logRetention: 3,
      timeout: Duration.seconds(30),
      bundling: {
        esbuildArgs: {
          '--packages': 'bundle',
        },
      },
    });

    isCompleteHandlerFunc.addToRolePolicy(
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
    );
    NagSuppressions.addResourceSuppressions(isCompleteHandlerFunc, [
      { id: 'AwsSolutions-IAM4', reason: 'no service role restriction needed' },
      { id: 'AwsSolutions-IAM5', reason: 'wildcards are ok for the ses mail verification' },
    ], true);

    const onEventHandlerFunc = new NodejsFunction(this, 'on-event-handler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      logRetention: 3,
      timeout: Duration.seconds(10),
      bundling: {
        esbuildArgs: {
          '--packages': 'bundle',
        },
      },
    });
    NagSuppressions.addResourceSuppressions(onEventHandlerFunc, [
      { id: 'AwsSolutions-IAM4', reason: 'no service role restriction needed' },
      { id: 'AwsSolutions-IAM5', reason: 'wildcards are ok as the function by itself does nothing' },
    ], true);

    this.provider = new cr.Provider(this, 'hosted-zone-dkim-propagation-provider', {
      isCompleteHandler: isCompleteHandlerFunc,
      queryInterval: Duration.seconds(10),
      totalTimeout: props.totalTimeToWireDNS,
      onEventHandler: onEventHandlerFunc,
    });
    NagSuppressions.addResourceSuppressions(this.provider, [
      { id: 'AwsSolutions-IAM4', reason: 'no service role restriction needed' },
      { id: 'AwsSolutions-IAM5', reason: 'wildcards are ok for the provider as the function has restrictions' },
    ], true);
  };
}

