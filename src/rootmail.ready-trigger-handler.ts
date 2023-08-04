import { CloudWatchEvents } from 'aws-sdk';
import axios from 'axios';
import * as uuid from 'uuid';

const cwe = new CloudWatchEvents();

export const handler = async () => {
  const signalUrl = process.env.SIGNAL_URL;
  const rootMailReadyEventRuleArn = process.env.ROOTMAIL_READY_EVENTRULE_ARN as string;
  const autowireDNSEventRuleArn = process.env.AUTOWIRE_DNS_EVENTRULE_ARN as string;

  console.log(`RootMail Setup completed. Triggering signal to ${signalUrl}`);

  await axios.put(signalUrl!, {
    Status: 'SUCCESS',
    Reason: 'RootMail Setup completed',
    UniqueId: uuid.v4(),
    Data: 'RootMail Setup completed',
  });

  // Disable event rule triggers
  const disableRootMailReadyEventRule = await cwe.disableRule({
    Name: rootMailReadyEventRuleArn,
  }).promise();

  if (disableRootMailReadyEventRule.$response.error) {
    throw new Error(`Failed to disable RootMail Ready event rule: ${disableRootMailReadyEventRule.$response.error}`);
  }

  // as we pass an non-empty string to the env var, if the autowireDNS feature is activated
  if (autowireDNSEventRuleArn !== '') {
    const disableAutowireDNSEventRule = await cwe.disableRule({
      Name: autowireDNSEventRuleArn,
    }).promise();

    if (disableAutowireDNSEventRule.$response.error) {
      throw new Error(`Failed to disable Autowire DNS event rule: ${disableAutowireDNSEventRule.$response.error}`);
    }
  }
};
