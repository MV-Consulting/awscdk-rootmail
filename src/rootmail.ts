import * as path from 'path';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { Arn, ArnFormat, Duration, Stack, aws_lambda as lambda } from 'aws-cdk-lib';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { HostedZone, RecordSet, RecordType } from 'aws-cdk-lib/aws-route53';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import { Construct } from 'constructs';
import { StringListParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { CfnCustomResource } from 'aws-cdk-lib/aws-cloudformation';

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

    const hostedZoneDKIMTokenRecord0 = new RecordSet(this, 'HostedZoneDKIMTokenRecord0', {
      recordType: RecordType.A,
      target: recordTarget,
      zone: hostedZone,

      // the properties below are optional
      deleteExisting: false,
      recordName: hostedZoneDKIMAndVerificationRecords.,
      ttl: Duration.seconds(60),
    });
  }
}
