import {
  Arn,
  ArnFormat,
  CfnWaitCondition,
  CfnWaitConditionHandle,
  Duration,
  Stack,
  aws_cloudwatch as cw,
  aws_events as events,
  aws_lambda as lambda,
  aws_iam as iam,
  aws_route53 as r53,
  aws_s3 as s3,
  aws_ssm as ssm,
  Fn,
  StackProps,
  CfnResource,
  IAspect,
  RemovalPolicy,
  Aspects,
} from 'aws-cdk-lib';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct, IConstruct } from 'constructs';
import { HostedZoneDKIMAndVerificationRecords } from './hosted-zone-dkim-verification-records';

export interface RootmailProps extends StackProps {
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

  /**
   * The name of the S3 bucket that will be used to store the emails for 'root@<subdomain>.<domain>'
   *
   * @default '<accountId>-rootmail-bucket'
   */
  readonly emailBucketName?: string;

  /**
   * The total time to wait for the DNS records to be available/wired.
   *
   * @default Duration.hours(8)
   */
  readonly totalTimeToWireDNS?: Duration;

  /**
   * Whether to autowire the DNS records for the root mail feature.
   *
   * @default false
   */
  readonly autowireDNSOnAWSEnabled?: boolean;

  /**
   * The ID of the hosted zone of the <domain>, which has to be in the same AWS account.
   * Cannot be '' if autowireDNSOnAWSEnabled is true.
   *
   * @default ''
   */
  readonly autowireDNSOnAWSParentHostedZoneId?: string;

  /**
   * Whether to set all removal policies to DESTROY. This is useful for integration testing purposes.
   */
  readonly setDestroyPolicyToAllResources?: boolean;
}

export class Rootmail extends Stack {
  public readonly hostedZoneParameterName: string;
  public readonly rootMailReadyEventRule: events.Rule;
  public readonly emailBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: RootmailProps) {
    super(scope, id);
    this.hostedZoneParameterName = '/superwerker/domain_name_servers';

    const domain = props.domain;
    const subdomain = props.subdomain || 'aws';
    const emailBucketName = props.emailBucketName || `${Stack.of(this).account}-rootmail-bucket`;
    const totalTimeToWireDNS = props.totalTimeToWireDNS || Duration.hours(8);
    const autowireDNSOnAWSEnabled = props.autowireDNSOnAWSEnabled || false;
    const autowireDNSOnAWSParentHostedZoneId = props.autowireDNSOnAWSParentHostedZoneId || '';

    if (autowireDNSOnAWSEnabled && autowireDNSOnAWSParentHostedZoneId === '') {
      throw new Error('autowireDNSOnAWSEnabled is true but autowireDNSOnAWSParentHostedZoneId is empty');
    }

    /**
     * EMAIL Bucket
     */
    this.emailBucket = new s3.Bucket(this, 'EmailBucket', {
      bucketName: emailBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const emailBucketPolicyStatement = new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      conditions: {
        StringEquals: {
          'aws:Referer': Stack.of(this).account,
        },
      },
      effect: iam.Effect.ALLOW,
      principals: [
        new iam.ServicePrincipal('ses.amazonaws.com'),
      ],
      resources: [
        // arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
        Arn.format({
          partition: Stack.of(this).partition,
          service: 's3',
          region: '',
          account: '',
          resource: this.emailBucket.bucketName,
          arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: 'RootMail/*',
        }, Stack.of(this)),
      ],
      sid: 'EnableSESReceive',
    });

    this.emailBucket.addToResourcePolicy(emailBucketPolicyStatement);

    /**
     * HOSTED ZONE
     */
    const hostedZone = new r53.HostedZone(this, 'HostedZone', {
      zoneName: `${subdomain}.${domain}`,
    });

    const hostedZoneSSMParameter = new ssm.StringListParameter(this, 'HostedZoneSSMParameter', {
      parameterName: this.hostedZoneParameterName,
      stringListValue: hostedZone.hostedZoneNameServers || [],
    });

    const hostedZoneDKIMAndVerificationRecords = new HostedZoneDKIMAndVerificationRecords(this, 'HostedZoneDKIMAndVerificationRecords', {
      domain: `${subdomain}.${domain}`,
    });

    const hostedZoneDKIMTokens = hostedZoneDKIMAndVerificationRecords.dkimTokens;

    new r53.RecordSet(this, 'HostedZoneDKIMTokenRecord0', {
      deleteExisting: false,
      zone: hostedZone,
      target: r53.RecordTarget.fromValues(`${Fn.select(0, hostedZoneDKIMTokens)}.dkim.amazonses.com`),
      recordName: `${Fn.select(0, hostedZoneDKIMTokens)}._domainkey.${subdomain}.${domain}`,
      ttl: Duration.seconds(60),
      recordType: r53.RecordType.CNAME,
    });

    new r53.RecordSet(this, 'HostedZoneDKIMTokenRecord1', {
      deleteExisting: false,
      zone: hostedZone,
      target: r53.RecordTarget.fromValues(`${Fn.select(1, hostedZoneDKIMTokens)}.dkim.amazonses.com`),
      recordName: `${Fn.select(1, hostedZoneDKIMTokens)}._domainkey.${subdomain}.${domain}`,
      ttl: Duration.seconds(60),
      recordType: r53.RecordType.CNAME,
    });

    new r53.RecordSet(this, 'HostedZoneDKIMTokenRecord2', {
      deleteExisting: false,
      zone: hostedZone,
      target: r53.RecordTarget.fromValues(`${Fn.select(2, hostedZoneDKIMTokens)}.dkim.amazonses.com`),
      recordName: `${Fn.select(2, hostedZoneDKIMTokens)}._domainkey.${subdomain}.${domain}`,
      ttl: Duration.seconds(60),
      recordType: r53.RecordType.CNAME,
    });

    new r53.RecordSet(this, 'HostedZoneMXRecord', {
      recordType: r53.RecordType.MX,
      zone: hostedZone,
      // Note: this is fixed to eu-west-1 until SES supports receive more globally
      target: r53.RecordTarget.fromValues('10 inbound-smtp.eu-west-1.amazonaws.com'),
      recordName: `${subdomain}.${domain}`,
      deleteExisting: false,
      ttl: Duration.seconds(60),
    });

    new r53.RecordSet(this, 'HostedZoneVerificationTokenRecord', {
      recordType: r53.RecordType.TXT,
      zone: hostedZone,
      recordName: `_amazonses.${subdomain}.${domain}`,
      // Note: needs to be wrapped in quotes
      target: r53.RecordTarget.fromValues(`"${hostedZoneDKIMAndVerificationRecords.verificationToken}"`),
      deleteExisting: false,
      ttl: Duration.seconds(60),
    });

    let autowireDNSEventRuleName: string = '';
    let autowireDNSEventRuleArn: string = '';
    if (autowireDNSOnAWSEnabled) {
      const autowireDNSHandler = new NodejsFunction(this, 'wire-rootmail-dns-handler', {
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: Duration.seconds(160), // 2m40s
        logRetention: 3,
        environment: {
          DOMAIN: domain,
          SUB_DOMAIN: subdomain,
          HOSTED_ZONE_PARAMETER_NAME: this.hostedZoneParameterName,
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
      autowireDNSEventRuleName = autowireDNSEventRule.ruleName;
      autowireDNSEventRuleArn = autowireDNSEventRule.ruleArn;

      autowireDNSEventRule.addTarget(new LambdaFunction(autowireDNSHandler));

    }

    /**
     * Wait until R53 records are set and the rootmail is ready
     */
    const rootMailReady = new NodejsFunction(this, 'ready-handler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      // # the timeout effectivly limits retries to 2^(n+1) - 1 = 9 attempts with backup
      //  as the function is called every 5 minutes from the event rule
      timeout: Duration.seconds(260),
      logRetention: 3,
      environment: {
        DOMAIN: domain,
        SUB_DOMAIN: subdomain,
      },
    });

    rootMailReady.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ses:GetIdentityVerificationAttributes',
        'ses:GetAccountSendingEnabled',
        'ses:GetIdentityDkimAttributes',
        'ses:GetIdentityNotificationAttributes',
      ],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
    }));

    this.rootMailReadyEventRule = new events.Rule(this, 'RootMailReadyEventRule', {
      schedule: events.Schedule.rate(Duration.minutes(5)),
    });

    this.rootMailReadyEventRule.addTarget(new LambdaFunction(rootMailReady));

    const rootMailReadyAlert = new cw.Alarm(this, 'Errors', {
      alarmName: 'superwerker-RootMailReady',
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      metric: new cw.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        period: Duration.seconds(180),
        statistic: 'Sum',
        dimensionsMap: {
          FunctionName: rootMailReady.functionName,
        },
      }),
      evaluationPeriods: 1,
      threshold: 1,
    });

    const rootMailReadyHandle = new CfnWaitConditionHandle(this, 'RootMailReadyHandle');

    new CfnWaitCondition(this, 'RootMailReadyHandleWaitCondition', {
      handle: rootMailReadyHandle.ref,
      timeout: totalTimeToWireDNS.toSeconds().toString(),
    });

    const rootMailReadyTrigger = new NodejsFunction(this, 'ready-trigger-handler', {
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(10),
      logRetention: 3,
      environment: {
        SIGNAL_URL: rootMailReadyHandle.ref,
        ROOTMAIL_READY_EVENTRULE_NAME: this.rootMailReadyEventRule.ruleName,
        AUTOWIRE_DNS_EVENTRULE_NAME: autowireDNSEventRuleName,
      },
    });

    // dynamicaly add the event rule arn to the role policy
    const rootMailReadyTriggerRoleResources = autowireDNSOnAWSEnabled
      ? [this.rootMailReadyEventRule.ruleArn, autowireDNSEventRuleArn]
      : [this.rootMailReadyEventRule.ruleArn];
    rootMailReadyTrigger.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'events:DisableRule',
      ],
      effect: iam.Effect.ALLOW,
      resources: rootMailReadyTriggerRoleResources,
    }));

    // when the RootMailReady CR / lamdbda passes successfully the RootMailReadyTrigger function is called
    // by the alarm state change event. It signals the RootMailReadyHandle to continue the stack creation
    const rootMailReadyTriggerEventPattern = new events.Rule(this, 'RootMailReadyTriggerEventPattern', {
      eventPattern: {
        detailType: ['CloudWatch Alarm State Change'],
        source: ['aws.cloudwatch'],
        detail: {
          alarmName: [rootMailReadyAlert.alarmName],
          state: {
            value: ['OK'],
          },
        },
      },
    });

    rootMailReadyTriggerEventPattern.addTarget(new LambdaFunction(rootMailReadyTrigger));

    // If Destroy Policy Aspect is present:
    if (props.setDestroyPolicyToAllResources) {
      Aspects.of(this).add(new ApplyDestroyPolicyAspect());
    }
  }

}

/**
 * Aspect for setting all removal policies to DESTROY
 */
class ApplyDestroyPolicyAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof CfnResource) {
      node.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }
  }
}