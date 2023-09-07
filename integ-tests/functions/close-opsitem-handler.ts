import * as AWS from 'aws-sdk';

const SSM = new AWS.SSM();

export const handler = async (event: any) => {
  const title = event.title || 'test';
  const source = event.source || 'source';
  const description = event.description || 'description';

  log({
    message: 'Closing opsItem',
    title: title,
    source: source,
    description: description,
  });

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
    // validate
    if (!res.Entities || res.Entities.length !== 1) {
      log({
        message: `No or too many opsItems: ${res.Entities!.length}`,
        title: title,
        res: res,
      });
      return { closeStatusCode: 500 };
    }

    log({
      message: 'Got opsItem',
      title: title,
      res: res,
    });


    const opsItemId = res.Entities![0].Id!;
    const opsItem = res.Entities![0].Data!['AWS:OpsItem'].Content![0];
    const opsItemTitle = opsItem.Title;
    const opsItemSource = opsItem.Source;
    const opsItemDescription = opsItem.Description;

    if (
      opsItemTitle !== title ||
      opsItemSource !== source ||
      opsItemDescription !== description
    ) {
      log({
        message: 'OpsItem did not match',
        expected: `title: '${title}', source: '${source}', description: '${description}'`,
        got: `title: '${opsItemTitle}', source: '${opsItemSource}', description: '${opsItemDescription}'`,
      });
      return { closeStatusCode: 500 };
    }

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