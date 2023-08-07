import * as AWS from 'aws-sdk';

const SES = new AWS.SES({ region: 'eu-west-1' });

export const handler = async (event: any) => {
  const id = event.id || 'test-id-1';
  const text = event.text || 'test';
  const sourceMail = event.sourceMail || 'test@example.com';
  const toMail = event.toMail || 'root@example.com';

  const params: AWS.SES.SendEmailRequest = {
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
    const res = await SES.sendEmail(params).promise();
    log({
      message: 'Email sent',
      params: params,
      res: res,
    });
    // return { statusCode: res.$response.httpResponse.statusCode };
    return { statusCode: 200 };
  } catch (err) {
    log({
      message: 'Error sending email',
      err: err,
    });
    // return { statusCode: err.statusCode, err: err };
    return { statusCode: 500, err: err };
  }
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}