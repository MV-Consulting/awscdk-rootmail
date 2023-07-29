import * as AWS from 'aws-sdk';

const SES = new AWS.SES({ region: 'eu-west-1' }); // this is fixed to eu-west-1 until SES supports receive more globally (see #23)

function log(msg: any) {
  console.log(JSON.stringify(msg));
}

async function backoff(msg: string, res: any, n: number) {
  const wait = Math.pow(2, n);

  log({
    level: 'info',
    msg: msg,
    res: res,
    round: n,
    waiting_in_seconds: wait,
  });

  return new Promise(resolve => setTimeout(resolve, n * 1000));
}

export async function handler(event: any, _context: any) {
  const domain = `${process.env.SUB_DOMAIN}.${process.env.DOMAIN}`;
  log({
    event: event,
    domain: domain,
    level: 'debug',
  });

  let n = 1;
  while (true) {
    const res = await SES.getAccountSendingEnabled().promise();
    if (res.Enabled) {
      break;
    }

    await backoff('sending not yet enabled', res, n);
    n++;
  }

  n = 1;
  while (true) {
    const res = await SES.getIdentityVerificationAttributes({ Identities: [domain] }).promise();
    console.log('res', res);
    console.log('res.VerificationAttributes', res.VerificationAttributes);
    if (res.VerificationAttributes[domain].VerificationStatus === 'Success') {
      break;
    }

    await backoff('verification not yet successful', res, n);
    n++;
  }

  n = 1;
  while (true) {
    const res = await SES.getIdentityDkimAttributes({ Identities: [domain] }).promise();
    if (res.DkimAttributes[domain].DkimVerificationStatus === 'Success') {
      break;
    }

    await backoff('DKIM verification not yet successful', res, n);
    n++;
  }

  n = 1;
  while (true) {
    const res = await SES.getIdentityNotificationAttributes({ Identities: [domain] }).promise();
    if (res.NotificationAttributes[domain].ForwardingEnabled) {
      break;
    } else {
      await backoff('forwarding not yet enabled', res, n);
      n++;
    }
  }
}
