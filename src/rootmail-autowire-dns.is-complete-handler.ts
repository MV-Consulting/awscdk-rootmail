// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import { Route53, SSM } from 'aws-sdk';
export const PROP_DOMAIN = 'Domain';
export const PROP_SUB_DOMAIN = 'Subdomain';
export const PROP_R53_HANGEINFO_ID_PARAMETER_NAME = 'R53ChangeInfoIdParameterName'; // TODO DRY with interface
export const PROP_PARENT_HOSTED_ZONE_ID = 'ParentHostedZoneId';

const route53 = new Route53();
const ssm = new SSM();

export interface IsCompleteHandlerResponse {
  IsComplete: boolean;
}

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<IsCompleteHandlerResponse> {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  const subdomain = event.ResourceProperties[PROP_SUB_DOMAIN];
  const hostedZoneParameterName = event.ResourceProperties[PROP_R53_HANGEINFO_ID_PARAMETER_NAME];
  const parentHostedZoneId = event.ResourceProperties[PROP_PARENT_HOSTED_ZONE_ID];

  if (parentHostedZoneId === undefined || parentHostedZoneId === '') {
    log(`Skipping autoDNS wiring on DELETE for domain '${subdomain}.${domain}' as no parentHostedZoneId is given!`);
    return {
      IsComplete: true,
    };
  }

  const recordSetCreationResponseChangeInfoIdParam = await ssm.getParameter({
    Name: hostedZoneParameterName,
  }).promise();
  const recordSetCreationResponseChangeInfoId = recordSetCreationResponseChangeInfoIdParam.Parameter?.Value as string;

  log(`got R53 change info id: ${recordSetCreationResponseChangeInfoId} for event type ${event.RequestType}`);
  log({
    msg: 'event',
    event,
  });

  switch (event.RequestType) {
    case 'Create':
      log('waiting for DNS to propagate');
      try {
        const res = await route53.waitFor('resourceRecordSetsChanged', {
          Id: recordSetCreationResponseChangeInfoId,
          // Note: the default is 30s delay and 60 attempts
          $waiter: {
            delay: 2,
            maxAttempts: 1,
          },
        }).promise();

        if (res.ChangeInfo.Status !== 'INSYNC') {
          log(`DNS propagation not in sync yet. Has status ${res.ChangeInfo.Status}`);
          return { IsComplete: false };
        }

        log(`DNS propagated with status ${res.ChangeInfo.Status}`);
        return { IsComplete: true };
      } catch (e) {
        log(`DNS propagation errored. Has message ${e}`);
        return { IsComplete: false };
      }
    case 'Update':
    case 'Delete':
      return {
        IsComplete: true,
      };
  }
}

function log(msg: any) {
  console.log(JSON.stringify(msg));
}