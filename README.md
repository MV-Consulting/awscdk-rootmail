# awscdk-rootmail

See the ADR from superwerker about the rootmail feature [here](https://github.com/superwerker/superwerker/blob/main/docs/adrs/rootmail.md)

## Setup
```ts
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Rootmail } from 'awscdk-rootmail';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // define resources here...
    new Rootmail(this, 'mavogelRootmail', {
      subdomain: 'aws', // which is the default
      domain: 'example.com',
    });
  }
}
```

```sh
# projen
npm run deploy -- --all
# plain cdk
npx cdk deploy --all
```

## Known issues
- https://github.com/aws/jsii/issues/2071: so adding  `compilerOptions."esModuleInterop": true,` in `tsconfig.json` is not possble. See [aws-sdk](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/#Usage_with_TypeScript). So change from `import AWS from 'aws-sdk';` to `import * as AWS from 'aws-sdk';`

## Docs
- activate opscenter via [url](https://eu-central-1.console.aws.amazon.com/systems-manager/opsitems/?region=eu-central-1&onboarded=true#activeTab=OPS_ITEMS&list_ops_items_filters=Status:Equal:Open_InProgress)