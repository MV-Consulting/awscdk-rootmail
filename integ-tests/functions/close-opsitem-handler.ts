import * as AWS from 'aws-sdk';

const SSM = new AWS.SSM();

async function getOpsItem(title: string): Promise<AWS.SSM.OpsEntity | undefined> {
  // get opsItem n times with 5s interval
  for (let i = 1; i <= 30; i++) {
    log({
      message: `Getting opsItem with title ${title} at try ${i}`,
      title: title,
    });

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

      return undefined;
    }

    if (res.Entities === undefined || res.Entities.length === 0) {
      log({
        message: 'No opsItem entities. Next try in 5s',
        title: title,
        res: res,
      });

      // delay 5s and try again
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }


    if (res.Entities.length > 1) {
      log({
        message: `Too many opsItems: ${res.Entities!.length}`,
        title: title,
        res: res,
      });
      return undefined;
    }

    // 1 ops item found
    return res.Entities[0];
  }

  log({
    message: 'No opsItem entities at all',
    title: title,
  });
  return undefined;
}

export const handler = async (event: any) => {
  const title = event.title || 'test';
  const source = event.source || 'source';
  const description = event.description || 'description';

  log({
    message: 'Closing opsItem',
    event: event,
    title: title,
    source: source,
    description: description,
  });

  try {
    // 1 get opsItem
    const opsEntity = await getOpsItem(title);
    if (opsEntity === undefined) {
      log({
        message: 'opsItem undefined',
      });
      return { closeStatusCode: 500 };
    }
    log({
      message: 'Got opsItem',
      title: title,
    });


    const opsItemId = opsEntity!.Id!;
    const opsItemContent = opsEntity!.Data!['AWS:OpsItem'].Content![0];
    const opsItemTitle = opsItemContent.Title;
    const opsItemSource = opsItemContent.Source;
    const opsItemDescription = opsItemContent.Description;

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
        err: resUpdate.$response.error,
      });

      return { closeStatusCode: 500, err: resUpdate.$response.error };
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