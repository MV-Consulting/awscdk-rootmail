import {
  CustomResource,
  Duration,
  Stack,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';
import { Construct, Node } from 'constructs';
import {
  PROP_DOMAIN,
  PROP_SUBDOMAIN,
  PROP_EMAILBUCKET_NAME,
  PROP_OPS_SANTA_FUNCTION_ARN,
  FILTERED_EMAIL_SUBJECTS,
} from './ses-receipt-ruleset-activation.on-event-handler';

export interface SESReceiptRuleSetActivationProps {
  readonly domain: string;
  readonly subdomain: string;
  readonly emailbucket: s3.Bucket;
  readonly opsSantaFunctionArn: string;
  readonly filteredEmailSubjects: string[];
}

export class SESReceiptRuleSetActivation extends Construct {
  constructor(scope: Construct,
    id: string, props: SESReceiptRuleSetActivationProps) {
    super(scope, id);

    new CustomResource(this, 'Resource', {
      serviceToken: SESReceiptRuleSetActivationProvider.getOrCreate(this, { emailbucket: props.emailbucket }),
      resourceType: 'Custom::SESReceiptRuleSetActivation',
      properties: {
        [PROP_DOMAIN]: props.domain,
        [PROP_SUBDOMAIN]: props.subdomain,
        [PROP_EMAILBUCKET_NAME]: props.emailbucket.bucketName,
        [PROP_OPS_SANTA_FUNCTION_ARN]: props.opsSantaFunctionArn,
        [FILTERED_EMAIL_SUBJECTS]: props.filteredEmailSubjects.join(','), // as we can only pass in strings
      },
    });
  }
}

interface SESReceiptRuleSetActivationProviderProps {
  readonly emailbucket: s3.Bucket;
}

class SESReceiptRuleSetActivationProvider extends Construct {

  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct, props: SESReceiptRuleSetActivationProviderProps) {
    const stack = Stack.of(scope);
    const id = 'rootmail.ses-receipt-ruleset-activation-provider';
    const x = Node.of(stack).tryFindChild(id) as SESReceiptRuleSetActivationProvider
      || new SESReceiptRuleSetActivationProvider(stack, id, props);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string, props: SESReceiptRuleSetActivationProviderProps) {
    super(scope, id);

    const onEventHandlerFuncRole = new iam.Role(this, 'SesReceiptRuleSetActivationCustomResourceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    onEventHandlerFuncRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
    onEventHandlerFuncRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ses:CreateReceiptRuleSet',
          'ses:CreateReceiptRule',
          'ses:SetActiveReceiptRuleSet',
          'ses:DeleteReceiptRule',
          'ses:DeleteReceiptRuleSet',
        ],
        resources: ['*'],
      }),
    );

    const onEventHandlerFunc = new NodejsFunction(this, 'on-event-handler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      logRetention: 1,
      role: onEventHandlerFuncRole,
      timeout: Duration.seconds(30),
      //  Note: we use the resource properties from above as it is a CustomResource
      environment: {},
    });

    const isCompleteHandlerFunc = new NodejsFunction(this, 'is-complete-handler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      logRetention: 1,
      timeout: Duration.seconds(30),
      //  Note: we use the resource properties from above as it is a CustomResource
      environment: {},
    });
    props.emailbucket.grantRead(isCompleteHandlerFunc, 'RootMail/*');

    this.provider = new cr.Provider(this, 'ses-receipt-ruleset-activation-provider', {
      onEventHandler: onEventHandlerFunc,
      isCompleteHandler: isCompleteHandlerFunc,
      queryInterval: Duration.seconds(10),
      totalTimeout: Duration.minutes(2), // TODO: make this configurable
      logRetention: 1,
    });
    NagSuppressions.addResourceSuppressions(
      [
        this.provider,
        this.provider.onEventHandler,
        this.provider.onEventHandler.role!,
        this.provider.isCompleteHandler!,
        this.provider.isCompleteHandler!.role!,
      ],
      [
        { id: 'AwsSolutions-IAM4', reason: 'no service role restriction needed' },
        { id: 'AwsSolutions-IAM5', reason: 'wildcards are ok for the provider as the function has restrictions' },
      ], true);
  }
}