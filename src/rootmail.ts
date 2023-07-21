import * as path from 'path';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { Arn, ArnFormat, CfnWaitCondition, CfnWaitConditionHandle, Duration, Stack, aws_lambda as lambda } from 'aws-cdk-lib';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { HostedZone, RecordSet, RecordTarget, RecordType } from 'aws-cdk-lib/aws-route53';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { StringListParameter } from 'aws-cdk-lib/aws-ssm';
import { CfnCustomResource } from 'aws-cdk-lib/aws-cloudformation';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Alarm, ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import { Construct } from 'constructs';

export interface RootmailProps {
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
}

export class Rootmail extends Construct {
  constructor(scope: Construct, id: string, props: RootmailProps) {
    super(scope, id);

    const domain = props.domain;
    const subdomain = props.subdomain || 'aws';

    new CfnInclude(this, 'RootmailTemplate', {
      templateFile: path.join(__dirname, 'templates', 'rootmail.yaml'),
      parameters: {
        Domain: domain,
        Subdomain: subdomain,
      },
    });

    const emailBucket = new Bucket(this, 'EmailBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    const emailBucketPolicyStatement = new PolicyStatement({
      actions: ['s3:PutObject'],
      conditions: {
        StringEquals: {
          'aws:Referer': Stack.of(this).account,
        },
      },
      effect: Effect.ALLOW,
      principals: [
        new ServicePrincipal('ses.amazonaws.com'),
      ],
      resources: [
        // arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
        Arn.format({
          partition: Stack.of(this).partition,
          service: 's3',
          region: '',
          account: '',
          resource: emailBucket.bucketName, // TODO check
          arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: 'RootMail/*',
        }, Stack.of(this)),
      ],
      sid: 'EnableSESReceive',
    });

    emailBucket.addToResourcePolicy(emailBucketPolicyStatement);

    const hostedZone = new HostedZone(this, 'HostedZone', {
      zoneName: `${subdomain}.${domain}`,
    });

    const hostedZoneSSMParameter = new StringListParameter(this, 'mySsmParameter', {
      parameterName: '/superwerker/domain_name_servers',
      stringListValue: hostedZone.hostedZoneNameServers || [], // TODO can we error here or wait until present?
    });

    const hostedZoneDKIMAndVerificationRecordsCustomResource = new PythonFunction(this, 'HostedZoneDKIMAndVerificationRecordsCustomResource', {
      entry: path.join(__dirname, 'functions', 'hosted_zone_dkim_verification_records_cr'),
      handler: 'handler',
      runtime: lambda.Runtime.PYTHON_3_10,
      timeout: Duration.seconds(200),
      environment: {
        DOMAIN: domain,
      },
      bundling: {
        assetExcludes: [
          '__pycache__',
          '.pytest_cache',
          'venv',
        ],
      },
    });

    hostedZoneDKIMAndVerificationRecordsCustomResource.addToRolePolicy(new PolicyStatement({
      actions: [
        'ses:VerifyDomainDkim',
        'ses:VerifyDomainIdentity',
      ],
      effect: Effect.ALLOW,
      resources: ['*'],
    }));

    const hostedZoneDKIMAndVerificationRecords = new CfnCustomResource(this, 'HostedZoneDKIMAndVerificationRecords', {
      serviceToken: hostedZoneDKIMAndVerificationRecordsCustomResource.functionArn,
      // TODO no resource properties possible here
    });

    // TODO add 0-2
    const hostedZoneDKIMTokenRecord0 = new RecordSet(this, 'HostedZoneDKIMTokenRecord0', {
      recordType: RecordType.CNAME,
      zone: hostedZone,
      recordName: `TOKEN_domainkey.${subdomain}.${domain}`, // TODO fix TOKEN
      target: RecordTarget.fromValues('TOKEN.dkim.amazonses.com'), // TODO fix TOKEN
      deleteExisting: false,
      ttl: Duration.seconds(60),
    });

    const hostedZoneMXRecord = new RecordSet(this, 'HostedZoneMXRecord', {
      recordType: RecordType.MX,
      zone: hostedZone,
      recordName: `${subdomain}.${domain}`,
      // # this is fixed to eu-west-1 until SES supports receive more globally (see #23)
      target: RecordTarget.fromValues('10 inbound-smtp.eu-west-1.amazonaws.com'),
      deleteExisting: false,
      ttl: Duration.seconds(60),
    });

    const hostedZoneVerificationTokenRecord = new RecordSet(this, 'HostedZoneVerificationTokenRecord', {
      recordType: RecordType.TXT,
      zone: hostedZone,
      recordName: `_amazonses.${subdomain}.${domain}`,
      // # this is fixed to eu-west-1 until SES supports receive more globally (see #23)
      target: RecordTarget.fromValues('"HostedZoneDKIMAndVerificationRecords.VerificationToken"'), // TODO fix TOKEN
      deleteExisting: false,
      ttl: Duration.seconds(60),
    });

    const rootMailReady = new PythonFunction(this, 'RootMailReady', {
      entry: path.join(__dirname, 'functions', 'root_mail_ready'),
      handler: 'handler',
      runtime: lambda.Runtime.PYTHON_3_10,
      // # the timeout effectivly limits retries to 2^(n+1) - 1 = 9 attempts with backup
      timeout: Duration.seconds(260),
      environment: {
        DOMAIN: domain,
        SUB_DOMAIN: subdomain,
      },
      bundling: {
        assetExcludes: [
          '__pycache__',
          '.pytest_cache',
          'venv',
        ],
      },
    });

    rootMailReady.addToRolePolicy(new PolicyStatement({
      actions: [
        'ses:GetIdentityVerificationAttributes',
        'ses:GetAccountSendingEnabled',
        'ses:GetIdentityDkimAttributes',
        'ses:GetIdentityNotificationAttributes',
      ],
      effect: Effect.ALLOW,
      resources: ['*'],
    }));

    const rootMailReadyEventRule = new Rule(this, 'RootMailReadyEventRule', {
      schedule: Schedule.cron({ minute: '5' }),
    });

    rootMailReadyEventRule.addTarget(new LambdaFunction(rootMailReady));

    // TODO check and see https://bobbyhadz.com/blog/cloudwatch-alarm-aws-cdk
    const rootMailReadyAlertMetric = new Metric({
      namespace: 'AWS/Lambda',
      metricName: 'Errors',
      period: Duration.seconds(180),
      statistic: 'Sum',
      dimensionsMap: {
        FunctionName: rootMailReady.functionName,
      },
    });

    const rootMailReadyAlert = new Alarm(this, 'Errors', {
      alarmName: 'superwerker-RootMailReady',
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      metric: rootMailReady.metricErrors(), // TODO check
      // dimensions √
      evaluationPeriods: 1,
      // metricName √
      // namespace √
      // period √
      // statistic √
      threshold: 1,
    });

    const rootMailReadyHandle = new CfnWaitConditionHandle(this, 'RootMailReadyHandle');

    const rootMailReadyHandleWaitCondition = new CfnWaitCondition(this, 'RootMailReadyHandleWaitCondition', /* all optional props */ {
      handle: rootMailReadyHandle.ref,
      // # 8 hours time to wire DNS
      timeout: Duration.hours(8).toSeconds().toString(),
    });

    // TODO CloudWatchEvent
    const rootMailReadyTrigger = new PythonFunction(this, 'RootMailReadyTrigger', {
      entry: path.join(__dirname, 'functions', 'root_mail_ready_trigger'),
      handler: 'handler',
      runtime: lambda.Runtime.PYTHON_3_10,
      // # the timeout effectivly limits retries to 2^(n+1) - 1 = 9 attempts with backup
      timeout: Duration.seconds(10),
      environment: {
        SIGNAL_URL: rootMailReadyHandle.ref,
      },
      bundling: {
        assetExcludes: [
          '__pycache__',
          '.pytest_cache',
          'venv',
        ],
      },
    });

    const rootMailReadyTriggerEventPattern = new Rule(this, 'RootMailReadyEventRule', {
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

    // TOOD SESReceiveStack: why a stackset?
  }
}
