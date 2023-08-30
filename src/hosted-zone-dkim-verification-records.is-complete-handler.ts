// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import * as AWS from 'aws-sdk';
export const PROP_DOMAIN = 'Domain';
export const ATTR_VERIFICATION_TOKEN = 'VerificationToken';
export const ATTR_DKIM_TOKENS = 'DkimTokens';

// this is fixed to eu-west-1 until SES supports receive more globally (see #23)
const SES = new AWS.SES({ region: 'eu-west-1' });

export interface IsCompleteHandlerResponse {
  IsComplete: boolean;
}

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<IsCompleteHandlerResponse> {
  const domain = event.ResourceProperties[PROP_DOMAIN];
  let isReady = true;

  console.log(domain);
  console.log(SES);

  return {
    IsComplete: isReady,
  };
}

