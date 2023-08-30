import {
  Arn,
  ArnFormat,
  Duration,
  aws_events as events,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_ssm as ssm,
} from 'aws-cdk-lib';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

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
}

export class RootmailAutowireDns extends Construct {
  public readonly autowireDNSEventRuleName: string;
  public readonly autowireDNSEventRuleArn: string;

  constructor(scope: Construct, id: string, props: RootmailAutowireDnsProps) {
    super(scope, id);

    const domain = props.domain;
    const subdomain = props.subdomain ?? 'aws';
    const autowireDNSOnAWSParentHostedZoneId = props.autowireDNSOnAWSParentHostedZoneId;
    const hostedZoneSSMParameter = props.hostedZoneSSMParameter;

    const autowireDNSHandler = new NodejsFunction(this, 'wire-handler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(160), // 2m40s
      logRetention: 3,
      environment: {
        DOMAIN: domain,
        SUB_DOMAIN: subdomain,
        HOSTED_ZONE_PARAMETER_NAME: hostedZoneSSMParameter.parameterName,
        PARENT_HOSTED_ZONE_ID: autowireDNSOnAWSParentHostedZoneId,
      },
    });

    autowireDNSHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ssm:GetParameter',
      ],
      effect: iam.Effect.ALLOW,
      resources: [
        hostedZoneSSMParameter.parameterArn,
      ],
    }));

    autowireDNSHandler.addToRolePolicy(
      // NOTE: not possible to limit to NS records only
      new iam.PolicyStatement({
        actions: [
          'route53:ListHostedZonesByName',
          'route53:GetChange',
        ],
        effect: iam.Effect.ALLOW,
        resources: ['*'],
      }));

    autowireDNSHandler.addToRolePolicy(
      // NOTE: not possible to limit to NS records only
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
            resourceName: autowireDNSOnAWSParentHostedZoneId,
          }),
        ],
      }));

    const autowireDNSEventRule = new events.Rule(this, 'AutowireDNSEventRule', {
      schedule: events.Schedule.rate(Duration.minutes(3)),
    });
    this.autowireDNSEventRuleName = autowireDNSEventRule.ruleName;
    this.autowireDNSEventRuleArn = autowireDNSEventRule.ruleArn;

    autowireDNSEventRule.addTarget(new LambdaFunction(autowireDNSHandler));

  }
}