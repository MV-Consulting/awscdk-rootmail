import * as AWS from 'aws-sdk';

const SSM = new AWS.SSM();

export const handler = async (event: any) => {
  const title = event.title || 'test';
  log({ message: 'Closing opsItem with title:', title: title });

  try {
    // 1 get opsItem
    const res = await SSM.getOpsSummary({
      Filters: [
        {
          Key: 'AWS:OpsItem.Title',
          Values: [title],
          Type: 'Equal',
        },
        {
          Key: 'AWS:OpsItem.Status',
          Values: ['Open'],
          Type: 'Equal',
        },
      ],
    }).promise();
    if (res.$response.error) {
      log({
        message: 'Error getOpsSummary',
        title: title,
        err: res.$response.error,
      });

      return { closeStatusCode: 500, err: res.$response.error };
    }
    log({
      message: 'Got opsItem',
      title: title,
      res: res,
    });

    const opsItemId = res.Entities![0].Id!;

    // 2 close opsItem
    const resUpdate = await SSM.updateOpsItem({
      OpsItemId: opsItemId,
      Status: 'Resolved',
    }).promise();

    if (resUpdate.$response.error) {
      log({
        message: 'Error updateOpsItem',
        title: title,
        err: res.$response.error,
      });

      return { closeStatusCode: 500, err: res.$response.error };
    }

    log({
      message: 'Updated opsItem',
      title: title,
      id: opsItemId,
      res: resUpdate,
    });

    // return { statusCode: res.$response.httpResponse.statusCode };
    return { closeStatusCode: 200 };
  } catch (err) {
    log({
      message: 'Error (catch) getting and closing opsItem',
      err: err,
    });
    // return { statusCode: err.statusCode, err: err };
    return { closeStatusCode: 500, err: err };
  }
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}