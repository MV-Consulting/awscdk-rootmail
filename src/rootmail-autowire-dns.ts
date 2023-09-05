import {
  Arn,
  ArnFormat,
  CustomResource,
  Duration,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_ssm as ssm,
  Stack,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct, Node } from 'constructs';
import {
  PROP_DOMAIN,
  PROP_SUB_DOMAIN,
  PROP_HOSTED_ZONE_PARAMETER_NAME,
  PROP_PARENT_HOSTED_ZONE_ID,
  PROP_R53_CHANGEINFO_ID_PARAMETER_NAME,
} from './rootmail-autowire-dns.on-event-handler';

export interface RootmailAutowireDnsProps {
  /**
   * Domain used for root mail feature. Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information
   */
  readonly domain: string;

  /**
   * Subdomain used for root mail feature. Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information
   *
   * @default 'aws'
   */
  readonly subdomain?: string;

  readonly autowireDNSOnAWSParentHostedZoneId: string;
  readonly hostedZoneSSMParameter: ssm.StringListParameter;
  readonly autoWireR53ChangeInfoIdParameter?: ssm.StringParameter; // TODO make internal
}

export class RootmailAutowireDns extends Construct {

  constructor(scope: Construct, id: string, props: RootmailAutowireDnsProps) {
    super(scope, id);

    const subdomain = props.subdomain ?? 'aws';
    const autoWireR53ChangeInfoIdParameterName = '/superwerker/auto_wire_r53_changeinfo_id';

    const autoWireR53ChangeInfoId = new ssm.StringParameter(this, 'AutoWireR53ChangeInfoId', {
      parameterName: autoWireR53ChangeInfoIdParameterName,
      stringValue: 'dummy',
    });

    new CustomResource(this, 'Resource', {
      serviceToken: RootmailAutowireDnsProvider.getOrCreate(this, {
        autoWireR53ChangeInfoIdParameter: autoWireR53ChangeInfoId,
        ...props,
      }),
      resourceType: 'Custom::RootmailAutowireDnsProvider',
      properties: {
        [PROP_DOMAIN]: props.domain,
        [PROP_SUB_DOMAIN]: subdomain,
        [PROP_HOSTED_ZONE_PARAMETER_NAME]: props.hostedZoneSSMParameter.parameterName,
        [PROP_PARENT_HOSTED_ZONE_ID]: props.autowireDNSOnAWSParentHostedZoneId,
        [PROP_R53_CHANGEINFO_ID_PARAMETER_NAME]: autoWireR53ChangeInfoId.parameterName,
      },
    });

  }
}

class RootmailAutowireDnsProvider extends Construct {
  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct, props: RootmailAutowireDnsProps) {
    const stack = Stack.of(scope);
    const id = 'superwerker.rootmail-autowire-dns-provider';
    const x = Node.of(stack).tryFindChild(id) as RootmailAutowireDnsProvider
      || new RootmailAutowireDnsProvider(stack, id, props);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string, props: RootmailAutowireDnsProps) {
    super(scope, id);

    const isCompleteHandlerFunc = new NodejsFunction(this, 'is-complete-handler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(120),
      logRetention: 3,
    });

    isCompleteHandlerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'route53:ListHostedZonesByName',
          'route53:GetChange',
        ],
        effect: iam.Effect.ALLOW,
        resources: ['*'],
      }),
    );

    if (props.autoWireR53ChangeInfoIdParameter !== undefined) {
      props.autoWireR53ChangeInfoIdParameter.grantRead(isCompleteHandlerFunc);
    }

    const onEventHandlerFunc = new NodejsFunction(this, 'on-event-handler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(160), // 2m40s
      logRetention: 3,
      environment: {},
    });

    props.hostedZoneSSMParameter.grantRead(onEventHandlerFunc);
    if (props.autoWireR53ChangeInfoIdParameter !== undefined) {
      props.autoWireR53ChangeInfoIdParameter.grantWrite(onEventHandlerFunc);
    }

    onEventHandlerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'route53:ListHostedZonesByName',
          'route53:GetChange',
        ],
        effect: iam.Effect.ALLOW,
        resources: ['*'],
      }),
    );

    onEventHandlerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'route53:ListResourceRecordSets',
          'route53:ChangeResourceRecordSets',
        ],
        effect: iam.Effect.ALLOW,
        resources: [
          // arn:aws:route53:::hostedzone/H12345
          // arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
          Arn.format({
            partition: 'aws',
            service: 'route53',
            region: '',
            account: '',
            resource: 'hostedzone',
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            resourceName: props.autowireDNSOnAWSParentHostedZoneId,
          }),
        ],
      }),
    );

    this.provider = new cr.Provider(this, 'rootmail-autowire-dns-provider', {
      isCompleteHandler: isCompleteHandlerFunc,
      queryInterval: Duration.seconds(5),
      onEventHandler: onEventHandlerFunc,
    });
  };
}