import * as AWS from 'aws-sdk';

const cwl = new AWS.CloudWatchLogs();

export const handler = async (event: any) => {
  console.log('Cleanup handler called');
  await deleteLogGroups(cwl, '/aws/lambda/RootmailTestStack');
};

const deleteLogGroups = async (cwlHandler: AWS.CloudWatchLogs, logGroupNamePrefix: string) => {
  try {
    let nextToken: string | undefined;
    do {
      const logGroupsResponse = await cwl.describeLogGroups({
        logGroupNamePrefix: logGroupNamePrefix,
        nextToken: nextToken,
      }).promise();

      for (const logGroup of logGroupsResponse.logGroups || []) {
        if (logGroup.logGroupName) {
          console.log(`Deleting log group: ${logGroup.logGroupName}`);
          await cwlHandler.deleteLogGroup({ logGroupName: logGroup.logGroupName }).promise();
          console.log(`Deleted log group: ${logGroup.logGroupName}`);
        }
      }

      nextToken = logGroupsResponse.nextToken;
    } while (nextToken);
  } catch (err) {
    console.log(`Error deleting log groups: ${err}`);
  }
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}