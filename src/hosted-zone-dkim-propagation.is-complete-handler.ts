// eslint-disable-next-line import/no-unresolved
import * as AWSCDKAsyncCustomResource from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import { SES } from '@aws-sdk/client-ses';
export const PROP_DOMAIN = 'Domain';

const ses = new SES();

export interface IsCompleteHandlerResponse {
  IsComplete: boolean;
}

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest): Promise<IsCompleteHandlerResponse> {
  const domain = event.ResourceProperties[PROP_DOMAIN];

  switch (event.RequestType) {
    case 'Create':
      const isReady = await internalHandler(domain);
      return { IsComplete: isReady };
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

async function internalHandler(domain: string): Promise<boolean> {

  log({
    domain: domain,
    level: 'debug',
  });

  const sendingResponse = await ses.getAccountSendingEnabled();
  if (!sendingResponse.Enabled) {
    return false;
  }
  log('sending enabled');

  const identityVerificationResponse = await ses.getIdentityVerificationAttributes({ Identities: [domain] });
  if (identityVerificationResponse.VerificationAttributes[domain].VerificationStatus !== 'Success') {
    return false;
  }
  log('identiity verification successful');

  const identityDkimRes = await ses.getIdentityDkimAttributes({ Identities: [domain] });
  if (identityDkimRes.DkimAttributes[domain].DkimVerificationStatus !== 'Success') {
    return false;
  }
  log('DKIM verification successful');

  const identityNotificationRes = await ses.getIdentityNotificationAttributes({ Identities: [domain] });
  if (!identityNotificationRes.NotificationAttributes[domain].ForwardingEnabled) {
    return false;
  }
  log('forwarding enabled');
  return true;
}

