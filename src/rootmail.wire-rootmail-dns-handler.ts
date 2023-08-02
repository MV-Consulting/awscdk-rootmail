import { Route53, SSM } from 'aws-sdk';

export interface wireRootmailDnsInvokeEvent {
  domain: string;
  subdomain: string;
  hostedZoneParameterName: string;
}

export interface wireRootmailDnsInvokeResponse {
  payload: string;
}

const route53 = new Route53();
const ssm = new SSM();

export const handler = async (event: wireRootmailDnsInvokeEvent): Promise<wireRootmailDnsInvokeResponse> => {
  log({
    event: event,
    level: 'debug',
  });

  const hostedZoneParameterResponse = await ssm.getParameter({
    Name: event.hostedZoneParameterName,
  }).promise();

  const hostedZoneNameServersAsString = hostedZoneParameterResponse.Parameter?.Value;
  log({
    event: hostedZoneNameServersAsString,
    level: 'debug',
  });

  if (hostedZoneNameServersAsString === undefined) {
    throw new Error(`hosted zone name servers not found in parameter store for ${event.domain}`);
  }

  const hostedZoneNameServers = hostedZoneNameServersAsString?.split(',');
  const hostedZoneResponse = await route53.listHostedZonesByName({
    DNSName: event.domain,
  }).promise();

  if (hostedZoneResponse.HostedZones?.length !== 1) {
    log({
      event: hostedZoneResponse,
      level: 'debug',
    });

    throw new Error(`expected exactly one hosted zone for ${event.domain}`);
  }

  const hostedZoneId = hostedZoneResponse.HostedZones?.[0].Id;

  // in the HZ of the domain we create the NS record for the subdomain
  const recordSetCreationResponse = await route53.changeResourceRecordSets({
    HostedZoneId: hostedZoneId,
    ChangeBatch: {
      Comment: 'rootmail-integtest',
      Changes: [
        {
          Action: 'CREATE',
          ResourceRecordSet: {
            Name: `${event.subdomain}.${event.domain}`,
            Type: 'NS',
            TTL: 60,
            ResourceRecords: [ // are always 4
              { Value: hostedZoneNameServers[0] },
              { Value: hostedZoneNameServers[1] },
              { Value: hostedZoneNameServers[2] },
              { Value: hostedZoneNameServers[3] },
            ],
          },
        },
      ],
    },
  }).promise();

  log('waiting for DNS to propagate: 5s delay, 36 attempts = 3 minutes');
  const res = await route53.waitFor('resourceRecordSetsChanged', {
    Id: recordSetCreationResponse.ChangeInfo.Id,
    $waiter: {
      delay: 5,
      maxAttempts: 36, // 3 minutes
    },
  }).promise();

  if (!res.ChangeInfo.Status || res.ChangeInfo.Status !== 'INSYNC') {
    throw new Error(`DNS propagation failed with status ${res.ChangeInfo.Status}`);
  }

  log(`DNS propagated with status ${res.ChangeInfo.Status}`);

  return {
    payload: '200',
  };
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}
