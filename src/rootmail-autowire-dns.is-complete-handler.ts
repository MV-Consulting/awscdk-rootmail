// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import { Route53, SSM } from 'aws-sdk';
export const PROP_DOMAIN = 'Domain';
export const PROP_R53_HANGEINFO_ID_PARAMETER_NAME = 'R53ChangeInfoIdParameterName'; // TODO DRY

const route53 = new Route53();
const ssm = new SSM();

export interface IsCompleteHandlerResponse {
  IsComplete: boolean;
}

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<IsCompleteHandlerResponse> {
  const hostedZoneParameterName = event.ResourceProperties[PROP_R53_HANGEINFO_ID_PARAMETER_NAME];

  const recordSetCreationResponseChangeInfoIdParam = await ssm.getParameter({
    Name: hostedZoneParameterName,
  }).promise();
  const recordSetCreationResponseChangeInfoId = recordSetCreationResponseChangeInfoIdParam.Parameter?.Value as string;

  log(`got R53 change info id: ${recordSetCreationResponseChangeInfoId}`);

  switch (event.RequestType) {
    case 'Create':
      log('waiting for DNS to propagate');
      const res = await route53.waitFor('resourceRecordSetsChanged', {
        Id: recordSetCreationResponseChangeInfoId,
      }).promise();

      if (!res.ChangeInfo.Status || res.ChangeInfo.Status !== 'INSYNC') {
        log(`DNS propagation not in sync yet. Has status ${res.ChangeInfo.Status}`);
        return { IsComplete: false };
      }

      log(`DNS propagated with status ${res.ChangeInfo.Status}`);
      return { IsComplete: true };
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