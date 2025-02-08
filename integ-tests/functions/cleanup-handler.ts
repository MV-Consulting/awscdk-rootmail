import { CloudWatchLogs } from '@aws-sdk/client-cloudwatch-logs';
import { S3 } from '@aws-sdk/client-s3';

const cwl = new CloudWatchLogs();
const s3 = new S3();

export const handler = async (event: any) => {
  const emailBucketName = event.s3EmailBucketName;
  const parentHostedZoneId = event.parentHostedZoneId;
  const domain = event.domain;
  const subdomain = event.subdomain;
  const logGroupNamePrefixesString = event.logGroupNamePrefixes;
  const logGroupNamePrefixes = logGroupNamePrefixesString?.split(',') || [];

  console.log({
    msg: 'Cleanup handler called',
    emailBucketName: emailBucketName,
    parentHostedZoneId: parentHostedZoneId,
    domain: domain,
    subdomain: subdomain,
    logGroupNamePrefixes: logGroupNamePrefixes,
  });

  try {
    await emptyS3Bucket(s3, emailBucketName || '');
    // await deleteLogGroups(cwl, logGroupNamePrefixes);
    return 'OK';
  } catch (err) {
    console.log(`Error cleaning up: ${err}`);
    return 'NOK';
  }
};

const deleteLogGroups = async (cwlHandler: CloudWatchLogs, logGroupNamePrefixes: string[]) => {
  for (const logGroupNamePrefix of logGroupNamePrefixes) {
    try {
      let nextToken: string | undefined;
      do {
        const logGroupsResponse = await cwl.describeLogGroups({
          logGroupNamePrefix: logGroupNamePrefix,
          nextToken: nextToken,
        });

        for (const logGroup of logGroupsResponse.logGroups || []) {
          if (logGroup.logGroupName) {
            console.log(`Deleting log group: ${logGroup.logGroupName}`);
            await cwlHandler.deleteLogGroup({ logGroupName: logGroup.logGroupName });
            console.log(`Deleted log group: ${logGroup.logGroupName}`);
          }
        }

        nextToken = logGroupsResponse.nextToken;
      } while (nextToken);
    } catch (err) {
      console.log(`Error deleting log groups: ${err}`);
    }
  }
};

const emptyS3Bucket = async (s3Handler: S3, bucketName: string) => {
  if (!bucketName || bucketName === '') {
    console.log('Empty s3 bucket name: aborting');
    return;
  }

  try {
    let nextToken: string | undefined;
    do {
      const objectsResponse = await s3Handler.listObjectsV2({
        Bucket: bucketName,
        ContinuationToken: nextToken,
      });

      for (const object of objectsResponse.Contents || []) {
        if (object.Key) {
          console.log(`Deleting object: ${object.Key}`);
          await s3Handler.deleteObject({ Bucket: bucketName, Key: object.Key });
          console.log(`Deleted object: ${object.Key}`);
        }
      }

      nextToken = objectsResponse.NextContinuationToken;
    } while (nextToken);
  } catch (err) {
    console.log(`Error deleting objects: ${err}`);
  }
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}