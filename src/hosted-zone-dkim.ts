import {
  Fn,
  Duration,
  aws_route53 as r53,
  aws_ssm as ssm,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HostedZoneDKIMPropagation } from './hosted-zone-dkim-propagation';
import { HostedZoneDKIMAndVerificationRecords } from './hosted-zone-dkim-verification-records';
import { RootmailAutowireDns } from './rootmail-autowire-dns';

export interface HostedZoneDkimProps {
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
   * The hosted zone of the <domain>, which has to be in the same AWS account.
   */
  readonly hostedZone: r53.IHostedZone;

  /**
   * The ID of the hosted zone of the <domain>, which has to be in the same AWS account.
   *
   * @default undefined
   */
  readonly autowireDNSOnAWSParentHostedZoneId?: string;
  readonly hostedZoneSSMParameter: ssm.StringListParameter;
  readonly totalTimeToWireDNS?: Duration;
}

export class HostedZoneDkim extends Construct {
  constructor(scope: Construct, id: string, props: HostedZoneDkimProps) {
    super(scope, id);

    const domain = props.domain;
    const subdomain = props.subdomain ?? 'aws';
    const hostedZone = props.hostedZone;
    const autowireDNSOnAWSParentHostedZoneId = props.autowireDNSOnAWSParentHostedZoneId ?? '';
    const hostedZoneSSMParameter = props.hostedZoneSSMParameter;

    // 1: trigger SNS DKIM verification
    const hostedZoneDKIMAndVerificationRecords = new HostedZoneDKIMAndVerificationRecords(this, 'HostedZoneDKIMAndVerificationRecords', {
      domain: `${subdomain}.${domain}`,
    });

    const hostedZoneDKIMTokens = hostedZoneDKIMAndVerificationRecords.dkimTokens;

    // 2: set the records in the hosted zone
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

    // 3: do autowire of manual DNS records entry. Wait until DNS is propagated
    if (isAutowireDNSOnAWSParentHostedZoneIdSet(autowireDNSOnAWSParentHostedZoneId)) {
      new RootmailAutowireDns(this, 'RootmailAutowireDns', {
        domain: domain,
        subdomain: subdomain,
        autowireDNSOnAWSParentHostedZoneId: autowireDNSOnAWSParentHostedZoneId,
        hostedZoneSSMParameter: hostedZoneSSMParameter,
      });
    }

    // 4: trigger SES DKIM propagation polling
    new HostedZoneDKIMPropagation(this, 'HostedZoneDKIMPropagation', {
      domain: `${subdomain}.${domain}`,
    });
  }
}

function isAutowireDNSOnAWSParentHostedZoneIdSet(autowireDNSOnAWSParentHostedZoneId: string): boolean {
  return autowireDNSOnAWSParentHostedZoneId !== undefined && autowireDNSOnAWSParentHostedZoneId !== '';
}