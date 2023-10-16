import {
  Duration,
  Stack,
  aws_iam as iam,
  aws_route53 as r53,
  aws_s3 as s3,
  aws_ssm as ssm,
  CfnResource,
  IAspect,
  RemovalPolicy,
  Aspects,
} from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { Construct, IConstruct } from 'constructs';
import { isSESEnabledRegion, sesEnabledRegions } from './common';
import { HostedZoneDkim } from './hosted-zone-dkim';
import { SESReceive } from './ses-receive';

export interface RootmailProps {
  /**
   * Domain used for root mail feature.
   */
  readonly domain: string;

  /**
   * Subdomain used for root mail feature.
   *
   * @default 'aws'
   */
  readonly subdomain?: string;

  /**
   * The total time to wait for the DNS records to be available/wired.
   *
   * @default Duration.hours(2)
   */
  readonly totalTimeToWireDNS?: Duration;

  /**
   * Set the HostedZone ID of the domain above from Route53 (in the same AWS account)
   * to enable autowiring of the DNS records.
   * 
   * Leave empty if you have your domain at an external DNS provider!
   *
   * @default ''
   */
  readonly autowireDNSParentHostedZoneID?: string;

  /**
   * Whether to set all removal policies to DESTROY. This is useful for integration testing purposes.
   * 
   * @default false
   */
  readonly setDestroyPolicyToAllResources?: boolean;
}

export class Rootmail extends Construct {
  public readonly hostedZoneParameterName: string;
  public readonly emailBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: RootmailProps) {
    super(scope, id);
    this.hostedZoneParameterName = '/rootmail/domain_name_servers';

    const domain = props.domain;
    const subdomain = props.subdomain ?? 'aws';
    const totalTimeToWireDNS = props.totalTimeToWireDNS ?? Duration.hours(2);
    const autowireDNSParentHostedZoneID = props.autowireDNSParentHostedZoneID ?? '';
    const setDestroyPolicyToAllResources = props.setDestroyPolicyToAllResources ?? false;

    const deployRegion = Stack.of(this).region;
    console.log(`Deploy region is ${deployRegion}`);
    if (!isSESEnabledRegion(deployRegion)) {
      throw new Error(`SES is not available in region ${deployRegion}. Use one of the following regions: ${sesEnabledRegions.join(', ')}`);
    }

    /**
     * EMAIL Bucket
     */
    this.emailBucket = new s3.Bucket(this, 'EmailBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    NagSuppressions.addResourceSuppressions([
      this.emailBucket,
    ], [
      { id: 'AwsSolutions-S1', reason: 'no server access logs needed' },
      { id: 'AwsSolutions-S10', reason: 'no SSL access needed' },
    ], true);
    this.emailBucket.grantPut(new iam.ServicePrincipal('ses.amazonaws.com'), 'RootMail/*');

    NagSuppressions.addResourceSuppressions([
      this.emailBucket.policy!,
    ], [
      { id: 'AwsSolutions-S10', reason: 'no SSL access needed' },
    ], true);

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
      autowireDNSParentHostedZoneID: autowireDNSParentHostedZoneID,
      hostedZoneSSMParameter: hostedZoneSSMParameter,
      totalTimeToWireDNS: totalTimeToWireDNS,
    });

    new SESReceive(this, 'SESReceive', {
      domain: domain,
      subdomain: subdomain,
      emailbucket: this.emailBucket,
    });

    // If Destroy Policy Aspect is present:
    if (setDestroyPolicyToAllResources) {
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