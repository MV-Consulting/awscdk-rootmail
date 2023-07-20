import * as path from 'path';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { aws_lambda as lambda } from 'aws-cdk-lib';
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
  readonly subdomain?: string;
}

export class Rootmail extends Construct {
  constructor(scope: Construct, id: string, props: RootmailProps) {
    super(scope, id);

    const domain = props.domain;
    const subdomain = props.subdomain || 'aws';

    new PythonFunction(this, 'DummyFunction', {
      entry: path.join(__dirname, 'functions', 'dummy_python_func'),
      handler: 'handler',
      runtime: lambda.Runtime.PYTHON_3_10,
      environment: {
        FOO: 'bar',
      },
      bundling: {
        assetExcludes: [
          '__pycache__',
          '.pytest_cache',
          'venv',
        ],
      },
    });

    new CfnInclude(this, 'RootmailTemplate', {
      templateFile: path.join(__dirname, 'templates', 'rootmail.yaml'),
      parameters: {
        Domain: domain,
        Subdomain: subdomain,
      },
    });
  }
}
