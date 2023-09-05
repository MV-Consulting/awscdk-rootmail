import {
  Duration,
  Stack,
  aws_iam as iam,
  aws_route53 as r53,
  aws_s3 as s3,
  aws_ssm as ssm,
  StackProps,
  CfnResource,
  IAspect,
  RemovalPolicy,
  Aspects,
} from 'aws-cdk-lib';
import { Construct, IConstruct } from 'constructs';
import { HostedZoneDkim } from './hosted-zone-dkim';

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
   * @default Duration.hours(2)
   */
  readonly totalTimeToWireDNS?: Duration;

  /**
   * The ID of the hosted zone of the <domain>, which has to be in the same AWS account.
   *
   * @default undefined
   */
  readonly autowireDNSOnAWSParentHostedZoneId?: string;

  /**
   * Whether to set all removal policies to DESTROY. This is useful for integration testing purposes.
   */
  readonly setDestroyPolicyToAllResources?: boolean;
}

export class Rootmail extends Stack {
  public readonly hostedZoneParameterName: string;
  public readonly emailBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: RootmailProps) {
    super(scope, id);
    this.hostedZoneParameterName = '/superwerker/domain_name_servers';

    const domain = props.domain;
    const subdomain = props.subdomain ?? 'aws';
    const emailBucketName = props.emailBucketName ?? `${Stack.of(this).account}-rootmail-bucket`;
    const totalTimeToWireDNS = props.totalTimeToWireDNS ?? Duration.hours(2);
    const autowireDNSOnAWSParentHostedZoneId = props.autowireDNSOnAWSParentHostedZoneId ?? '';

    if (autowireDNSOnAWSParentHostedZoneId !== undefined && autowireDNSOnAWSParentHostedZoneId === '') {
      throw new Error('autowireDNSOnAWSParentHostedZoneId is set but empty');
    }

    /**
     * EMAIL Bucket
     */
    this.emailBucket = new s3.Bucket(this, 'EmailBucket', {
      bucketName: emailBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    this.emailBucket.grantPut(new iam.ServicePrincipal('ses.amazonaws.com'), 'RootMail/*');

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

    new HostedZoneDkim(this, 'HostedZoneDkim', {
      domain: domain,
      subdomain: subdomain,
      hostedZone: hostedZone,
      autowireDNSOnAWSParentHostedZoneId: autowireDNSOnAWSParentHostedZoneId,
      hostedZoneSSMParameter: hostedZoneSSMParameter,
      totalTimeToWireDNS: totalTimeToWireDNS,
    });

    // TODO add ses receive construct

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