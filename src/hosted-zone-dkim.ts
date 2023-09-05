import {
  Fn,
  Duration,
  aws_route53 as r53,
  aws_ssm as ssm,
  Stack,
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
    for (let i = 0; i < hostedZoneDKIMTokens.length; i++) {
      new r53.RecordSet(this, `HostedZoneDKIMTokenRecord${i}`, {
        deleteExisting: false,
        zone: hostedZone,
        target: r53.RecordTarget.fromValues(`${Fn.select(i, hostedZoneDKIMTokens)}.dkim.amazonses.com`),
        recordName: `${Fn.select(i, hostedZoneDKIMTokens)}._domainkey.${subdomain}.${domain}`,
        ttl: Duration.seconds(60),
        recordType: r53.RecordType.CNAME,
      });
    }

    new r53.MxRecord(this, 'HostedZoneMXRecord', {
      zone: hostedZone,
      values: [
        {
          priority: 10,
          hostName: `inbound-smtp.${Stack.of(this).region}.amazonaws.com`,
        },
      ],
      deleteExisting: false,
      recordName: `${subdomain}.${domain}`,
      ttl: Duration.seconds(60),
    });

    new r53.TxtRecord(this, 'HostedZoneVerificationTokenRecord', {
      zone: hostedZone,
      // Note: needs to be wrapped in quotes
      values: [
        `"${hostedZoneDKIMAndVerificationRecords.verificationToken}"`,
      ],
      deleteExisting: false,
      recordName: `_amazonses.${subdomain}.${domain}`,
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