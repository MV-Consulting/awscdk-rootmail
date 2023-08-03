import { Route53, SSM } from 'aws-sdk';

const route53 = new Route53();
const ssm = new SSM();

export const handler = async () => {
  const domain = process.env.DOMAIN;
  const subdomain = process.env.SUB_DOMAIN;
  const hostedZoneParameterName = process.env.HOSTED_ZONE_PARAMETER_NAME as string;
  const parentHostedZoneId = process.env.PARENT_HOSTED_ZONE_ID;

  const hostedZoneParameterResponse = await ssm.getParameter({
    Name: hostedZoneParameterName,
  }).promise();

  const hostedZoneNameServersAsString = hostedZoneParameterResponse.Parameter?.Value;
  log({
    event: hostedZoneNameServersAsString,
    level: 'debug',
  });

  if (hostedZoneNameServersAsString === undefined || hostedZoneNameServersAsString === '') {
    throw new Error(`hosted zone name servers not found or empty in parameter store for ${domain}: ${hostedZoneNameServersAsString}`);
  }

  const hostedZoneNameServers = hostedZoneNameServersAsString?.split(',');
  if (hostedZoneNameServers.length !== 4) {
    throw new Error(`expected exactly 4 hosted zone name servers for ${domain}. Got ${hostedZoneNameServers.length}: ${hostedZoneNameServers}`);
  }

  const hostedZoneResponse = await route53.listHostedZonesByName({
    DNSName: domain,
  }).promise();

  if (hostedZoneResponse.HostedZones === undefined || hostedZoneResponse.HostedZones?.length === 0) {
    log({
      event: hostedZoneResponse,
      level: 'debug',
    });

    throw new Error(`expected to find at least one hosted zone for ${domain}`);
  }

  const filteredHostedZones = hostedZoneResponse.HostedZones?.filter((hostedZone) => {
    // the response prefix is /hostedzone/ but the input parameter is without the prefix
    return hostedZone.Id === `/hostedzone/${parentHostedZoneId}`;
  });

  if (filteredHostedZones.length !== 1) {
    log({
      event: hostedZoneResponse,
      level: 'debug',
    });

    throw new Error(`expected to find & filter exactly one hosted zone for ${domain}`);
  }

  const hostedZoneId = filteredHostedZones[0].Id;

  // iterate over hosted zone records
  const listResourceRecordSetsResponse = await route53.listResourceRecordSets({
    // remove the prefix for using it as parameter
    HostedZoneId: hostedZoneId.replace('/hostedzone/', ''),
  }).promise();

  if (listResourceRecordSetsResponse.ResourceRecordSets === undefined) {
    log({
      event: listResourceRecordSetsResponse,
      level: 'debug',
    });

    throw new Error(`expected to find at least one resource record set for ${domain}`);
  }

  const existingNSRecordSet = listResourceRecordSetsResponse.ResourceRecordSets?.find((recordSet) => {
    return recordSet.Name === `${subdomain}.${domain}` && recordSet.Type === 'NS';
  });

  if (existingNSRecordSet !== undefined) {
    log({
      event: existingNSRecordSet,
      level: 'debug',
    });

    log(`NS record for Name '${subdomain}.${domain}' and type NS already exists. Skipping.`);
    return;
  }

  log(`NS record for Name '${subdomain}.${domain}' and type NS does not exist. Creating.`);
  // in the HZ of the domain we create the NS record for the subdomain
  const recordSetCreationResponse = await route53.changeResourceRecordSets({
    HostedZoneId: hostedZoneId,
    ChangeBatch: {
      Comment: 'rootmail-integtest',
      Changes: [
        {
          Action: 'CREATE',
          ResourceRecordSet: {
            Name: `${subdomain}.${domain}`,
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
      maxAttempts: 24, // 2 minutes
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
