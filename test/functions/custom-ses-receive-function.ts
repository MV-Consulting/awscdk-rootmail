import { S3 } from '@aws-sdk/client-s3';
import { simpleParser } from 'mailparser';
// from https://docs.aws.amazon.com/ses/latest/dg/receiving-email-action-lambda-event.html
export interface EventRecord {
  eventSource: string;
  eventVersion: string;
  ses: Ses;
}

export interface Ses {
  mail: Mail;
  receipt: Receipt;
}

export interface Mail {
  timestamp: string;
  source: string;
  messageId: string;
  destination: string[];
  headersTruncated: boolean;
  headers: Header[];
  commonHeaders: CommonHeaders;
}

export interface Header {
  name: string;
  value: string;
}

export interface CommonHeaders {
  returnPath: string;
  from: string[];
  date: string;
  to: string[];
  messageId: string;
  subject: string;
}

export interface Receipt {
  timestamp: string;
  processingTimeMillis: number;
  recipients: string[];
  spamVerdict: Verdict;
  virusVerdict: Verdict;
  spfVerdict: Verdict;
  dkimVerdict: Verdict;
  dmarcVerdict: Verdict;
  action: Action;
}

export interface Verdict {
  status: string;
}

export interface Action {
  type: string;
  functionArn: string;
  invocationType: string;
}

export interface SESEventRecordsToLambda {
  Records: EventRecord[];
}

const emailBucket = process.env.EMAIL_BUCKET;
const emailBucketArn = process.env.EMAIL_BUCKET_ARN;
const s3 = new S3();

export const handler = async (event: SESEventRecordsToLambda) => {
  for (const record of event.Records) {

    const id = record.ses.mail.messageId;
    const key = `RootMail/${id}`;
    const response = await s3.getObject({ Bucket: emailBucket as string, Key: key });

    const msg = await simpleParser(response.Body as unknown as Buffer);

    let title = msg.subject;
    console.log(`Title: ${title} from emailBucketArn: ${emailBucketArn}`);
  }
};