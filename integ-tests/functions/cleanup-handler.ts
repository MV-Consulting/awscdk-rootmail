import * as AWS from 'aws-sdk';

const cwl = new AWS.CloudWatchLogs();
const route53 = new AWS.Route53();
const s3 = new AWS.S3();

export const handler = async (event: any) => {
  const emailBucketName = process.env.S3_EMAIL_BUCKET_NAME;
  const parentHostedZoneId = process.env.PARENT_HOSTED_ZONE_ID;
  const domain = process.env.DOMAIN;
  const subdomain = process.env.SUBDOMAIN;
  const logGroupNamePrefixesString = process.env.LOG_GROUP_NAME_PREFIXES;
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
    await deleteLogGroups(cwl, logGroupNamePrefixes);
    await emptyS3Bucket(s3, emailBucketName || '');
    await deleteRecords(route53, parentHostedZoneId || '', `${subdomain}.${domain}`, 'NS');
    return { success: 200 };
  } catch (err) {
    console.log(`Error cleaning up: ${err}`);
    return { success: 500, err: err };
  }
};

const deleteRecords = async (route53Handler: AWS.Route53, hostedZoneId: string, recordName: string, recordType: string) => {
  log({
    msg: 'Deleting records',
    hostedZoneId: hostedZoneId,
    recordName: recordName,
    recordType: recordType,
  });
  try {
    let nextRecordName: string | undefined;
    let isRecordDeleted = false;
    do {
      const recordsResponse = await route53Handler.listResourceRecordSets({
        HostedZoneId: hostedZoneId,
        StartRecordName: nextRecordName,
      }).promise();

      for (const recordSet of recordsResponse.ResourceRecordSets || []) {
        // Note the trainling dot in the name at the end
        if (recordSet.Name === `${recordName}.` && recordSet.Type === recordType) {
          console.log(`Deleting record: ${recordSet.Name} ${recordSet.Type}`);
          await route53Handler.changeResourceRecordSets({
            HostedZoneId: hostedZoneId,
            ChangeBatch: {
              Changes: [
                {
                  Action: 'DELETE',
                  ResourceRecordSet: recordSet,
                },
              ],
            },
          }).promise();
          console.log(`Deleted record: ${recordSet.Name} ${recordSet.Type}. Stopping here.`);
          isRecordDeleted = true;
          // we exit here as there should be only one record with the given name and type
          break;
        }
      }

      nextRecordName = recordsResponse.NextRecordName;
      if (isRecordDeleted) {
        console.log(`Record deleted: ${recordName} ${recordType}. Quitting.`);
        break;
      }
    } while (nextRecordName);
  } catch (err) {
    console.log(`Error deleting records: ${err}`);
  }
};

const deleteLogGroups = async (cwlHandler: AWS.CloudWatchLogs, logGroupNamePrefixes: string[]) => {
  for (const logGroupNamePrefix of logGroupNamePrefixes) {
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
  }
};

const emptyS3Bucket = async (s3Handler: AWS.S3, bucketName: string) => {
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
      }).promise();

      for (const object of objectsResponse.Contents || []) {
        if (object.Key) {
          console.log(`Deleting object: ${object.Key}`);
          await s3Handler.deleteObject({ Bucket: bucketName, Key: object.Key }).promise();
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