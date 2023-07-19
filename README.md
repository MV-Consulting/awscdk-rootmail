# awscdk-rootmail

See the ADR from superwerker about the rootmail feature [here](https://github.com/superwerker/superwerker/blob/main/docs/adrs/rootmail.md)

## Known issues
- https://github.com/aws/jsii/issues/2071: so adding  `compilerOptions."esModuleInterop": true,` in `tsconfig.json` is not possble. See [aws-sdk](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/#Usage_with_TypeScript). So change from `import AWS from 'aws-sdk';` to `import * as AWS from 'aws-sdk';`