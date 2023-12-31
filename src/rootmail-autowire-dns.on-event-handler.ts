import { Route53, SSM } from 'aws-sdk';
export const PROP_DOMAIN = 'Domain';
export const PROP_SUB_DOMAIN = 'Subdomain';
export const PROP_HOSTED_ZONE_PARAMETER_NAME = 'HostedZoneParameterName';
export const PROP_R53_CHANGEINFO_ID_PARAMETER_NAME = 'R53ChangeInfoIdParameterName';
export const PROP_PARENT_HOSTED_ZONE_ID = 'ParentHostedZoneId';

const route53 = new Route53();
const ssm = new SSM();

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  const subdomain = event.ResourceProperties[PROP_SUB_DOMAIN];
  const hostedZoneParameterName = event.ResourceProperties[PROP_HOSTED_ZONE_PARAMETER_NAME];
  const parentHostedZoneId = event.ResourceProperties[PROP_PARENT_HOSTED_ZONE_ID];
  const r53ChangeInfoIdParameterName = event.ResourceProperties[PROP_R53_CHANGEINFO_ID_PARAMETER_NAME];

  switch (event.RequestType) {
    case 'Create':
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

        throw new Error(`expected to find & filter exactly 1 hosted zone for ${domain}. Got ${filteredHostedZones.length}`);
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
        // Note the trainling dot in the name at the end
        return recordSet.Name === `${subdomain}.${domain}.` && recordSet.Type === 'NS';
      });

      if (existingNSRecordSet !== undefined) {
        log({
          event: existingNSRecordSet,
          level: 'debug',
        });

        log(`NS record for Name '${subdomain}.${domain}' and type NS already exists. Skipping.`);
        return {};
      }

      log(`NS record for Name '${subdomain}.${domain}' and type NS does not exist. Creating.`);
      // in the HZ of the domain (parentHostedZone) we create the NS record for the subdomain
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

      // we add the change info id to the parameter store so we use it in the is-complete-handler
      await ssm.putParameter({
        Name: r53ChangeInfoIdParameterName,
        Value: recordSetCreationResponse.ChangeInfo.Id,
        Overwrite: true,
      }).promise();

      return {
        PhysicalResourceId: event.PhysicalResourceId,
      };

    case 'Update':
      log(`Skipping update for NS record for Name '${subdomain}.${domain}'`);
      return {};
    case 'Delete':
      log(`Deleting NS record for Name '${subdomain}.${domain}'`);
      const recordName = `${subdomain}.${domain}`;
      try {
        let nextRecordName: string | undefined;
        let isRecordDeleted = false;
        do {
          const recordsResponse = await route53.listResourceRecordSets({
            HostedZoneId: parentHostedZoneId,
            StartRecordName: nextRecordName,
          }).promise();

          for (const recordSet of recordsResponse.ResourceRecordSets || []) {
            // Note the trainling dot in the name at the end
            if (recordSet.Name === `${recordName}.` && recordSet.Type === 'NS') {
              console.log(`Deleting record: ${recordSet.Name} ${recordSet.Type}`);
              await route53.changeResourceRecordSets({
                HostedZoneId: parentHostedZoneId,
                ChangeBatch: {
                  Changes: [
                    {
                      Action: 'DELETE',
                      ResourceRecordSet: recordSet,
                    },
                  ],
                },
              }).promise();
              console.log(`Deleted record: ${recordSet.Name} ${recordSet.Type}. Stopping here.`);
              isRecordDeleted = true;
              // we exit here as there should be only one record with the given name and type
              break;
            }
          }

          nextRecordName = recordsResponse.NextRecordName;
          if (isRecordDeleted) {
            console.log(`Record deleted: ${recordName} type 'NS'. Quitting.`);
            break;
          }
        } while (nextRecordName);
      } catch (err) {
        console.log(`Error deleting records: ${err}`);
        throw err;
      }
      return {};
  }
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}
