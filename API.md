# awscdk-rootmail

A single rootmail box for all your AWS accounts. The cdk implementation of the [superwerker](https://superwerker.cloud/) rootmail feature. See [here](https://github.com/superwerker/superwerker/blob/main/docs/adrs/rootmail.md) for a detailed Architectural Decision Record ([ADR](https://adr.github.io/))

- [awscdk-rootmail](#awscdk-rootmail)
  - [TL;DR](#tldr)
  - [Prerequisites](#prerequisites)
  - [Solution design: Version 1 - external DNS provider](#solution-design-version-1---external-dns-provider)
    - [Setup v1](#setup-v1)
    - [Verify](#verify)
  - [Solution design: Version 2 - Domain in the same AWS account](#solution-design-version-2---domain-in-the-same-aws-account)
    - [Setup v2](#setup-v2)
  - [Known issues](#known-issues)
  - [Related projects](#related-projects)

## TL;DR
Each AWS account needs one unique email address (the so-called "AWS account root user email address").

Access to these email addresses must be adequately secured since they provide privileged access to AWS accounts, such as account deletion procedures.

This is why you only need 1 mailing list for the AWS Management (formerly *root*) account, we recommend `aws-roots+<uuid>@mycompany.test` (**NOTE:** maximum 64 character are allowed for the whole address). And as you own the domain `mycompany.test` you can add a subdomain, e.g. `aws`, for which all EMails will then be received with this solution within this particular AWS Management account.

## Prerequisites
- Administrative access to an AWS account
- Access to a development environment.  It is recommended to use AWS Cloud9 to avoid having to set up the tools needed to deploy the solution.  See [Getting started with AWS Cloud9](https://aws.amazon.com/cloud9/getting-started/).
- Using Cloud9, all of the following have already been configured for you.  If you choose not to use Cloud9, you will need to install the following.
    - AWS CLI. See [Installing, updating and uninstalling the AWS CLI version 2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
    - Set up the AWS CLI with IAM access credentials. See [Configuring the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html)
    - Node.js version 10.13.0 or later
    - AWS CDK version 2.90.0 or later. For installation instructions see [Getting Started with the AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install)
    - Docker version 20.10.x or later

## Solution design: Version 1 - external DNS provider
![rootmail-solution-diagram-v1](docs/img/awscdk-rootmail-v1-min.png)

1. You own a domain, e.g., `mycompany.test`. It can be at any registrar such as `godaddy`, also `Route53` itself in another AWS account.
2. The stack creates a `Route53` public Hosted Zone for the subdomain, e.g., `aws.mycompany.test`. It also automatically adds the TXT and CNAME records (for DKIM etc.) for verifying the domain towards SES. **NOTE:** You must now add the NS server entries into the Domain provider which owns the main domain `mycompany.test`.
3. When the subdomain `aws.mycompany.test` is successfully propagated, the stack creates a verified Domain in AWS SES and adds a recipient rule for `root@aws.mycompany.test`. **NOTE:** SES support alias, so mail to `root+random-string@aws.mycompany.test` will also be catched and forwared. On a successfull propagation you will get a mail as follows to the root Email address of the account you are installing the stack
![domain-verification](docs/img/3-domain-verification-min.png)
1. Now, any mail going to `root+<any-string>@aws.mycompany.test` will be processed by OpsSanta 🎅🏽 Lambda function and also stored in the rootmail S3 bucket 🪣.
2. The OpsSanta function verifies the verdicts (DKIM etc.) of the sender, also skips AWS Account welcome EMails, and processes all other EMails. If it is a password reset link EMail it stores the link in the parameter store (and does *not* create an OpsItem for now). For all other mails, which are not skipped an OpsItem is created to have a central location for all items. Note: you can also connect your Jira to the OpsCenter.
3. The bucket where all mail to `root@aws.mycompany.test` are stored.
4. The SSM parameter store for password reset links.
5. The OpsItem which is created. It is open and shall be further processed either in the OpsCenter or any other issue tracker.

### Setup v1
1. To start a new project we recommend using [projen](https://projen.io/).
   1. Create a new projen project
   ```sh
   npx projen new awscdk-app-ts
   ```
   2. Add `@mavogel/awscdk-rootmail` as a dependency to your project in the `.projenrc.ts` file
   3. Run `npm run projen` to install it
2. In you `main.ts` file add the following
```ts
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Rootmail, SESReceiveStack } from 'awscdk-rootmail';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const domain = 'mycompany.test'; // a domain you need to own
    const subdomain = 'aws'; // subdomain which will be created
    const rootMailDeployRegion = 'eu-central-1';

    const rootmail = new Rootmail(this, 'rootmail-stack', {
      domain: domain,
      subdomain: subdomain,
      env: {
        region: rootMailDeployRegion,
      },
    });

    new SESReceiveStack(this, 'ses-receive-stack', {
      domain: domain,
      subdomain: subdomain,
      emailbucket: rootmail.emailBucket,
      rootMailDeployRegion: rootMailDeployRegion,
      // SES only supports receiving in certain regions
      // https://docs.aws.amazon.com/ses/latest/dg/regions.html#region-receive-email
      env: {
        region: 'eu-west-1',
      },
    });
  }
}
```
2. run on your commandline
```sh
docker ps # need to be running to build lambdas with esbuild
npm run deploy -- --all
```
3. watch our for the [cfn wait condition](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-waitcondition.html)
![wait-condition](docs/img/1-wait-condition-min.png) By default you have **8 hours** to wire the DNS!
4. Then create the NS record in your domain `mycompany.test` for the subdomain `aws.mycompany.test`. Here for Route53 in AWS:
![create-ns-records](docs/img/2-create-ns-records-min.png)
5. The `rootmail-ready-handler` Lambda function checks every **5 minutes** if the DNS records for the subdomain are propagated.

### Verify
You can test it yourself via
```sh
dig +short NS 8.8.8.8 aws.mycompany.test
# should return something like
ns-1111.your-dns-provider-10.org.
ns-2222.your-dns-provider-21.co.uk.
ns-33.your-dns-provider-04.com.
ns-444.your-dns-provider-12.net.
```
and also by sending an EMail, e.g. from Gmail to `root@aws.mycompany.test`

## Solution design: Version 2 - Domain in the same AWS account
![rootmail-solution-diagram-v2](docs/img/awscdk-rootmail-v2-min.png)

1. You own a domain, e.g., `mycompany.test`, registered via `Route53` in the **same** AWS account.
2. The stack creates a `Route53` public Hosted Zone for the subdomain, e.g., `aws.mycompany.test`. It also automatically adds the TXT and CNAME records for verifying the domain towards SES **and** adds the NS server entries automatically to the main domain `mycompany.test`. (**NOTE:** you can still do this manually if desired, as described in `v1` above)
3. items 3-7 are the same as in `v1`

### Setup v2
1. To start a new project we recommend using [projen](https://projen.io/).
   1. Create a new projen project
   ```sh
   npx projen new awscdk-app-ts
   ```
   2. Add `@mavogel/awscdk-rootmail` as a dependency to your project in the `.projenrc.ts` file
   3. Run `npm run projen` to install it
2. In you `main.ts` file add the following
```ts
import { App, Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Rootmail, SESReceiveStack } from 'awscdk-rootmail';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const domain = 'mycompany.test'; // a domain you need to own
    const subdomain = 'aws'; // subdomain which will be created
    const rootMailDeployRegion = 'eu-central-1';

    const rootmail = new Rootmail(this, 'rootmail-stack', {
      domain: domain,
      subdomain: subdomain,
      // NEW start (compared to v1)
      totalTimeToWireDNS: Duration.minutes(40),                    // <- NEW: time can be reduced
      autowireDNSOnAWSEnabled: true,                               // <- NEW: enable autowire
      autowireDNSOnAWSParentHostedZoneId: 'Z09999999TESTE1A2B3C4D', // <- NEW the id for 'mycompany.test'
      // NEW end
      env: {
        region: rootMailDeployRegion,
      },
    });

    new SESReceiveStack(this, 'ses-receive-stack', {
      domain: domain,
      subdomain: subdomain,
      emailbucket: rootmail.emailBucket,
      rootMailDeployRegion: rootMailDeployRegion,
      // SES only supports receiving in certain regions
      // https://docs.aws.amazon.com/ses/latest/dg/regions.html#region-receive-email
      env: {
        region: 'eu-west-1',
      },
    });
  }
}
```
2. run on your commandline
```sh
docker ps # need to be running to build lambdas with esbuild
npm run deploy -- --all
```
1. No need to do anything when you see the [cfn wait condition](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-waitcondition.html). The NS records are **automatically** propagated!
![wait-condition](docs/img/1-wait-condition-automatically-min.png)
1. The `rootmail-ready-handler` Lambda function checks every 5 minutes if the DNS for the subdomain is propagated.

## Known issues
- [jsii/2071](https://github.com/aws/jsii/issues/2071): so adding  `compilerOptions."esModuleInterop": true,` in `tsconfig.json` is not possible. See aws-cdk usage with[typescript](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/#Usage_with_TypeScript). So we needed to change import from `import AWS from 'aws-sdk';` -> `import * as AWS from 'aws-sdk';` to be able to compile.

## Related projects
- [aws-account-factory-email](https://github.com/aws-samples/aws-account-factory-email): a similar approach with SES, however you need to manually configure it upfront and also it about delivering root mails for a specific account to a specific mailing list and mainly decouples the real email address from the one of the AWS account. The main difference is that we do not *hide* or decouple the email address, but more make those as unique and unguessable/bruteforable as possible (with `uuids`).
# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### Rootmail <a name="Rootmail" id="@mavogel/awscdk-rootmail.Rootmail"></a>

#### Initializers <a name="Initializers" id="@mavogel/awscdk-rootmail.Rootmail.Initializer"></a>

```typescript
import { Rootmail } from '@mavogel/awscdk-rootmail'

new Rootmail(scope: Construct, id: string, props: RootmailProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.Rootmail.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@mavogel/awscdk-rootmail.Rootmail.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/awscdk-rootmail.Rootmail.Initializer.parameter.props">props</a></code> | <code><a href="#@mavogel/awscdk-rootmail.RootmailProps">RootmailProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@mavogel/awscdk-rootmail.Rootmail.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@mavogel/awscdk-rootmail.Rootmail.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@mavogel/awscdk-rootmail.Rootmail.Initializer.parameter.props"></a>

- *Type:* <a href="#@mavogel/awscdk-rootmail.RootmailProps">RootmailProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.Rootmail.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="@mavogel/awscdk-rootmail.Rootmail.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.Rootmail.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@mavogel/awscdk-rootmail.Rootmail.isConstruct"></a>

```typescript
import { Rootmail } from '@mavogel/awscdk-rootmail'

Rootmail.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@mavogel/awscdk-rootmail.Rootmail.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.Rootmail.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@mavogel/awscdk-rootmail.Rootmail.property.emailBucket">emailBucket</a></code> | <code>aws-cdk-lib.aws_s3.Bucket</code> | *No description.* |
| <code><a href="#@mavogel/awscdk-rootmail.Rootmail.property.hostedZoneParameterName">hostedZoneParameterName</a></code> | <code>string</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@mavogel/awscdk-rootmail.Rootmail.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `emailBucket`<sup>Required</sup> <a name="emailBucket" id="@mavogel/awscdk-rootmail.Rootmail.property.emailBucket"></a>

```typescript
public readonly emailBucket: Bucket;
```

- *Type:* aws-cdk-lib.aws_s3.Bucket

---

##### `hostedZoneParameterName`<sup>Required</sup> <a name="hostedZoneParameterName" id="@mavogel/awscdk-rootmail.Rootmail.property.hostedZoneParameterName"></a>

```typescript
public readonly hostedZoneParameterName: string;
```

- *Type:* string

---


### SESReceive <a name="SESReceive" id="@mavogel/awscdk-rootmail.SESReceive"></a>

#### Initializers <a name="Initializers" id="@mavogel/awscdk-rootmail.SESReceive.Initializer"></a>

```typescript
import { SESReceive } from '@mavogel/awscdk-rootmail'

new SESReceive(scope: Construct, id: string, props: SESReceiveProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceive.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceive.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceive.Initializer.parameter.props">props</a></code> | <code><a href="#@mavogel/awscdk-rootmail.SESReceiveProps">SESReceiveProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@mavogel/awscdk-rootmail.SESReceive.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@mavogel/awscdk-rootmail.SESReceive.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@mavogel/awscdk-rootmail.SESReceive.Initializer.parameter.props"></a>

- *Type:* <a href="#@mavogel/awscdk-rootmail.SESReceiveProps">SESReceiveProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceive.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="@mavogel/awscdk-rootmail.SESReceive.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceive.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@mavogel/awscdk-rootmail.SESReceive.isConstruct"></a>

```typescript
import { SESReceive } from '@mavogel/awscdk-rootmail'

SESReceive.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@mavogel/awscdk-rootmail.SESReceive.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceive.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |

---

##### `node`<sup>Required</sup> <a name="node" id="@mavogel/awscdk-rootmail.SESReceive.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---


## Structs <a name="Structs" id="Structs"></a>

### RootmailProps <a name="RootmailProps" id="@mavogel/awscdk-rootmail.RootmailProps"></a>

#### Initializer <a name="Initializer" id="@mavogel/awscdk-rootmail.RootmailProps.Initializer"></a>

```typescript
import { RootmailProps } from '@mavogel/awscdk-rootmail'

const rootmailProps: RootmailProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.RootmailProps.property.domain">domain</a></code> | <code>string</code> | Domain used for root mail feature. |
| <code><a href="#@mavogel/awscdk-rootmail.RootmailProps.property.autowireDNSOnAWSParentHostedZoneId">autowireDNSOnAWSParentHostedZoneId</a></code> | <code>string</code> | The ID of the hosted zone of the <domain>, which has to be in the same AWS account. |
| <code><a href="#@mavogel/awscdk-rootmail.RootmailProps.property.setDestroyPolicyToAllResources">setDestroyPolicyToAllResources</a></code> | <code>boolean</code> | Whether to set all removal policies to DESTROY. |
| <code><a href="#@mavogel/awscdk-rootmail.RootmailProps.property.subdomain">subdomain</a></code> | <code>string</code> | Subdomain used for root mail feature. |
| <code><a href="#@mavogel/awscdk-rootmail.RootmailProps.property.totalTimeToWireDNS">totalTimeToWireDNS</a></code> | <code>aws-cdk-lib.Duration</code> | The total time to wait for the DNS records to be available/wired. |

---

##### `domain`<sup>Required</sup> <a name="domain" id="@mavogel/awscdk-rootmail.RootmailProps.property.domain"></a>

```typescript
public readonly domain: string;
```

- *Type:* string

Domain used for root mail feature.

Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information

---

##### `autowireDNSOnAWSParentHostedZoneId`<sup>Optional</sup> <a name="autowireDNSOnAWSParentHostedZoneId" id="@mavogel/awscdk-rootmail.RootmailProps.property.autowireDNSOnAWSParentHostedZoneId"></a>

```typescript
public readonly autowireDNSOnAWSParentHostedZoneId: string;
```

- *Type:* string
- *Default:* undefined

The ID of the hosted zone of the <domain>, which has to be in the same AWS account.

---

##### `setDestroyPolicyToAllResources`<sup>Optional</sup> <a name="setDestroyPolicyToAllResources" id="@mavogel/awscdk-rootmail.RootmailProps.property.setDestroyPolicyToAllResources"></a>

```typescript
public readonly setDestroyPolicyToAllResources: boolean;
```

- *Type:* boolean

Whether to set all removal policies to DESTROY.

This is useful for integration testing purposes.

---

##### `subdomain`<sup>Optional</sup> <a name="subdomain" id="@mavogel/awscdk-rootmail.RootmailProps.property.subdomain"></a>

```typescript
public readonly subdomain: string;
```

- *Type:* string
- *Default:* 'aws'

Subdomain used for root mail feature.

Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information

---

##### `totalTimeToWireDNS`<sup>Optional</sup> <a name="totalTimeToWireDNS" id="@mavogel/awscdk-rootmail.RootmailProps.property.totalTimeToWireDNS"></a>

```typescript
public readonly totalTimeToWireDNS: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.hours(2)

The total time to wait for the DNS records to be available/wired.

---

### SESReceiveProps <a name="SESReceiveProps" id="@mavogel/awscdk-rootmail.SESReceiveProps"></a>

#### Initializer <a name="Initializer" id="@mavogel/awscdk-rootmail.SESReceiveProps.Initializer"></a>

```typescript
import { SESReceiveProps } from '@mavogel/awscdk-rootmail'

const sESReceiveProps: SESReceiveProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceiveProps.property.domain">domain</a></code> | <code>string</code> | Domain used for root mail feature. |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceiveProps.property.emailbucket">emailbucket</a></code> | <code>aws-cdk-lib.aws_s3.Bucket</code> | S3 bucket to store received emails. |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceiveProps.property.subdomain">subdomain</a></code> | <code>string</code> | Subdomain used for root mail feature. |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceiveProps.property.rulesetSettleTimeSeconds">rulesetSettleTimeSeconds</a></code> | <code>number</code> | Time in seconds to wait for the SES receipt rule set to settle. |
| <code><a href="#@mavogel/awscdk-rootmail.SESReceiveProps.property.setDestroyPolicyToAllResources">setDestroyPolicyToAllResources</a></code> | <code>boolean</code> | Whether to set all removal policies to DESTROY. |

---

##### `domain`<sup>Required</sup> <a name="domain" id="@mavogel/awscdk-rootmail.SESReceiveProps.property.domain"></a>

```typescript
public readonly domain: string;
```

- *Type:* string

Domain used for root mail feature.

Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information

---

##### `emailbucket`<sup>Required</sup> <a name="emailbucket" id="@mavogel/awscdk-rootmail.SESReceiveProps.property.emailbucket"></a>

```typescript
public readonly emailbucket: Bucket;
```

- *Type:* aws-cdk-lib.aws_s3.Bucket

S3 bucket to store received emails.

---

##### `subdomain`<sup>Required</sup> <a name="subdomain" id="@mavogel/awscdk-rootmail.SESReceiveProps.property.subdomain"></a>

```typescript
public readonly subdomain: string;
```

- *Type:* string

Subdomain used for root mail feature.

Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information

---

##### `rulesetSettleTimeSeconds`<sup>Optional</sup> <a name="rulesetSettleTimeSeconds" id="@mavogel/awscdk-rootmail.SESReceiveProps.property.rulesetSettleTimeSeconds"></a>

```typescript
public readonly rulesetSettleTimeSeconds: number;
```

- *Type:* number
- *Default:* 120

Time in seconds to wait for the SES receipt rule set to settle.

The reason is that although the rule is active immediately, it takes some time for the rule to
really forwards incoming mails to the S3 bucket and the Lambda function. During tests 120 seconds
were enough to wait for the rule to settle. This propery is offered to lower it for testing purposes.

---

##### `setDestroyPolicyToAllResources`<sup>Optional</sup> <a name="setDestroyPolicyToAllResources" id="@mavogel/awscdk-rootmail.SESReceiveProps.property.setDestroyPolicyToAllResources"></a>

```typescript
public readonly setDestroyPolicyToAllResources: boolean;
```

- *Type:* boolean

Whether to set all removal policies to DESTROY.

This is useful for integration testing purposes.

---



