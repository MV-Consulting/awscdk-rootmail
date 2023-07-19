import * as path from 'path';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import { Construct } from 'constructs';

export interface RootmailProps {
  /**
   * Domain used for root mail feature. Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information
   */
  readonly domain: string;

  /**
   * Subdomain used for root mail feature. Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information
   *
   * @default 'aws'
   */
  readonly subdomain: string;
}

export class Rootmail extends Construct {
  constructor(scope: Construct, id: string, props: RootmailProps) {
    super(scope, id);

    const domain = props.domain;
    const subdomain = props.subdomain || 'aws';

    new CfnInclude(this, 'RootmailTemplate', {
      templateFile: path.join(__dirname, 'templates', 'rootmail.yaml'),
      parameters: {
        Domain: domain,
        Subdomain: subdomain,
      },
    });
  }
}
