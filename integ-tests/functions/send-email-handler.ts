import { SendEmailCommandInput, SES } from '@aws-sdk/client-ses';

const ses = new SES();

export const handler = async (event: any) => {
  const id = event.id || 'test-id-1';
  const text = event.text || 'test';
  const sourceMail = event.sourceMail || 'test@example.com';
  const toMail = event.toMail || 'root@example.com';

  const ruleAfter = await ses.describeReceiptRule({
    RuleSetName: 'RootMail',
    RuleName: 'Receive',
  });
  log({ message: 'Rule:', rule: ruleAfter.Rule });

  const params: SendEmailCommandInput = {
    Source: sourceMail,
    Destination: {
      ToAddresses: [toMail],
    },
    Message: {
      Subject: {
        Data: id,
      },
      Body: {
        Text: {
          Data: text,
        },
      },
    },
  };

  try {
    const res = await ses.sendEmail(params);
    if (res.$response.error) {
      log({
        message: 'Error sending email',
        params: params,
        messageId: res.MessageId,
        err: res.$response.error,
      });

      return { sendStatusCode: 500, err: res.$response.error };
    }
    log({
      message: 'Email sent',
      params: params,
      res: res,
    });

    // return { statusCode: res.$response.httpResponse.statusCode };
    return { sendStatusCode: 200 };
  } catch (err) {
    log({
      message: 'Error (catch) sending email',
      err: err,
    });
    // return { statusCode: err.statusCode, err: err };
    return { sendStatusCode: 500, err: err };
  }
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}