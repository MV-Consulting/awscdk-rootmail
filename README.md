# awscdk-rootmail

A single email box for all your root user emails in all AWS accounts of the organization. 
- The cdk implementation and **adaption** of the [superwerker](https://superwerker.cloud/) rootmail feature. 
- See [here](docs/adrs/rootmail.md) for a detailed Architectural Decision Record ([ADR](https://adr.github.io/))

## TL;DR
Each AWS account needs one unique email address (the so-called "AWS account root user email address").

Access to these email addresses must be adequately secured since they provide privileged access to AWS accounts, such as account deletion procedures.

This is why you only need 1 mailing list for the AWS Management (formerly *root*) account, 
we recommend the following pattern `aws-roots+<uuid>@mycompany.test` 

> [!NOTE]
> Maximum **64** characters are allowed for the whole address. 

And as you own the domain `mycompany.test` you can add a subdomain, e.g. `aws`, for which all EMails will then be received with this solution within this particular AWS Management account.

## Usage

Install the dependencies:
```sh
brew install aws-cli node@18 esbuild
```

You can chose via embedding the construct in your cdk-app or use is directly via Cloudformation.
### cdk
1. To start a new project we recommend using [projen](https://projen.io/).
   1. Create a new projen project
   ```sh
   npx projen new awscdk-app-ts
   ```
   2. Add `@mavogel/awscdk-rootmail` as a dependency to your project in the `.projenrc.ts` file
   3. Run `yarn run projen` to install it
2. In you `main.ts` file add the following code
```ts
import { Rootmail } from '@mavogel/awscdk-rootmail';
import {
  App,
  Stack,
  StackProps,
  aws_route53 as r53,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const domain = 'mycompany.com' // registered via Route53 in the SAME account

    const hostedZone = r53.HostedZone.fromLookup(this, 'rootmail-parent-hosted-zone', {
      domainName: domain,
    });

    new Rootmail(this, 'rootmail', {
      // 1. a domain you own, registered via Route53 in the SAME account
      domain: domain,
      // 2. so the subdomain will be aws.mycompany.test and
      subdomain: 'aws',
      // 3. wired / delegated automatically to
      wireDNSToHostedZoneID: hostedZone.hostedZoneId,
    });
  }
}
```
2. run on your commandline
```sh
yarn run deploy
```
1. No need to do anything, the NS records are **automatically** propagated as the parent Hosted Zone is in the same account!
2. The `hosted-zone-dkim-propagation-provider.is-complete-handler` Lambda function checks every 10 seconds if the DNS for the subdomain is propagated. Details are in the Cloudwatch log group.

> [!TIP]
> Take a look at the solution design [here](docs/adrs/solution-design-domain-same-aws-account.md) for more details.

### cdk with your own receiver function
You might also want to pass in you own function on what to do when an EMail is received

<details>
  <summary>... click here for the details</summary>

file `functions/custom-ses-receive-function.ts` which gets the 2 environment variables populated
- `EMAIL_BUCKET`
- `EMAIL_BUCKET_ARN`

as well as `s3:GetObject` on the `RootMail/*` objects in the created Rootmail `S3` bucket. 

```ts
import { S3 } from '@aws-sdk/client-s3';
import { ParsedMail, simpleParser } from 'mailparser';
// populated by default
const emailBucket = process.env.EMAIL_BUCKET;
const emailBucketArn = process.env.EMAIL_BUCKET_ARN;
const s3 = new S3();

// SESEventRecordsToLambda
// from https://docs.aws.amazon.com/ses/latest/dg/receiving-email-action-lambda-event.html
export const handler = async (event: SESEventRecordsToLambda) => {
    for (const record of event.Records) {
        
        const id = record.ses.mail.messageId;
        const key = `RootMail/${id}`;
        const response = await s3.getObject({ Bucket: emailBucket as string, Key: key });
        
        const msg: ParsedMail = await simpleParser(response.Body as unknown as Buffer);
        
        let title = msg.subject;
        console.log(`Title: ${title} from emailBucketArn: ${emailBucketArn}`);
        // use the content of the email body 
        const body = msg.html;
        // add your custom code here ...

        // dummy example: list s3 buckets
        const buckets = await s3.listBuckets({});
        if (!buckets.Buckets) {
            console.log('No buckets found');
            return;
        }
        console.log('Buckets:');
        for (const bucket of buckets.Buckets || []) {
            console.log(bucket.Name);
        }
    }

};
```
and you create a separate `NodejsFunction` as follows with the additionally needed IAM permissions:
```ts
const customSesReceiveFunction = new NodejsFunction(stackUnderTest, 'custom-ses-receive-function', {
  functionName: PhysicalName.GENERATE_IF_NEEDED,
  entry: path.join(__dirname, 'functions', 'custom-ses-receive-function.ts'),
  runtime: lambda.Runtime.NODEJS_18_X,
  logRetention: 1,
  timeout: Duration.seconds(30),
});

// Note: any additional permissions you need to add to the function yourself!
customSesReceiveFunction.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    's3:List*',
  ],
  resources: ['*'],
}))
```
and then pass it into the `Rootmail` Stack
```ts
export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const domain = 'mycompany.test'
    const hostedZone = r53.HostedZone.fromLookup(this, 'rootmail-parent-hosted-zone', {
      domainName: domain,
    });

    const rootmail = new Rootmail(this, 'rootmail-stack', {
      domain: domain;
      autowireDNSParentHostedZoneID: hostedZone.hostedZoneId,
      env: {
        region: 'eu-west-1',
      },
      customSesReceiveFunction: customSesReceiveFunction, // <- pass it in here
    }); 
  }
}
```

</details>

> [!TIP]
> Take a look at the solution design for external DNS [here](docs/adrs/solution-design-external-dns-provider.md) for more details.

### Cloudformation
or use it directly a Cloudformation template `yaml` from the URL [here](https://mvc-prod-releases.s3.eu-central-1.amazonaws.com/rootmail/v0.0.258/awscdk-rootmail.template.yaml).


<details>
  <summary>... click here for the details</summary>

and fill out the parameters
![cloudformation-template](docs/img/cloudformation-tpl-min.png)

</details>


## Known issues
- [jsii/2071](https://github.com/aws/jsii/issues/2071): so adding  `compilerOptions."esModuleInterop": true,` in `tsconfig.json` is not possible. See aws-cdk usage with[typescript](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/#Usage_with_TypeScript). So we needed to change import from `import AWS from 'aws-sdk';` -> `import * as AWS from 'aws-sdk';` to be able to compile.

## Related projects / questions
- [aws-account-factory-email](https://github.com/aws-samples/aws-account-factory-email): a similar approach with SES, however you need to manually configure it upfront and also it about delivering root mails for a specific account to a specific mailing list and mainly decouples the real email address from the one of the AWS account. The main difference is that we do not *hide* or decouple the email address, but more make those as unique and unguessable/bruteforable as possible (with `uuids`).
- The question `Is it best practise to use a shared mailbox as AWS root user address?` from [stackoverflow](https://stackoverflow.com/questions/76739635/is-it-best-practise-to-use-a-shared-mailbox-as-aws-root-user-address): yes of course you can also use `root+alias-1@mycompany.com` and `root+alias-2@mycompany.com` etc. for your
root EMail boxes.

## Unlock the full potention of your infrastructure - Partner with us!

> [!TIP]
> Bring your AWS Infrastructure with [MV Consulting](https://manuel-vogel.de/) to the next level. We ship well-architected, resilient, and cost-optimized AWS solutions designed to scale using Infrastructure as Code (IaC), tailoring cloud-native systems for businesses of all sizes.
>
> Our Approach:
>
> - **Tailored AWS Solutions**: Custom-built for your unique business needs
> - **Future-Proof Architecture**: Scalable designs that grow with you
> - **Empowerment Through Ownership**: Your vision, your infrastructure, our expertise
>
> Why Choose Us:
> - 7+ Years of AWS Experience
> - 12x AWS Certified, including DevOps Engineer & Solutions Architect Professional
> - Proven Track Record and Testimonials
>
> Ready to elevate your AWS CDK Infrastructure?
>
> <a href="https://manuel-vogel.de/contact"><img alt="Schedule your call" src="https://img.shields.io/badge/schedule%20your%20call-success.svg?style=for-the-badge"/></a>
> <details><summary>☁️ <strong>Discover more about my one-person business: MV Consulting</strong></summary>
>
> <br/>
>
> Hi, I'm Manuel – AWS expert and founder of [MV Consulting](https://manuel-vogel.de). With over a decade of hands-on experience, I specialized myself in deploying well-architected, highly scalable and cost-effective AWS Solutions using Infrastructure as Code (IaC).
>
> #### When you work with me, you're getting a package deal of expertise and personalized service:
>
> - **AWS CDK Proficiency**: I bring deep AWS CDK knowledge to the table, ensuring your infrastructure is not just maintainable and scalable, but also fully automated.
> - **AWS Certified**: [Equipped with 12 AWS Certifications](https://www.credly.com/users/manuel-vogel/badges), including DevOps Engineer & Solutions Architect Professional, to ensure best practices across diverse cloud scenarios.
> - **Direct Access**: You work with me, not a team of managers. Expect quick decisions and high-quality work.
> - **Tailored Solutions**: Understanding that no two businesses are alike, I Custom-fit cloud infrastructure for your unique needs.
> - **Cost-Effective**: I'll optimize your AWS spending without cutting corners on performance or security.
> - **Seamless CI/CD**: I'll set up smooth CI/CD processes using GitHub Actions, making changes a breeze through Pull Requests.
>
> *My mission is simple: I'll free you from infrastructure headaches so you can focus on what truly matters – your core business.*
>
> Ready to unlock the full potential of AWS Cloud?
>
> <a href="https://manuel-vogel.de/contact"><img alt="Schedule your call" src="https://img.shields.io/badge/schedule%20your%20call-success.svg?style=for-the-badge"/></a>
> </details>

## Acknowledgements

Big thank you to the creators of [projen](https://github.com/projen/projen). This project stands on the shoulders of giants, made possible by their pioneering work in simplifying cloud infrastructure projects!

## Author

[Manuel Vogel](https://manuel-vogel.de/about/)

[![](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/manuel-vogel)
[![](https://img.shields.io/badge/GitHub-2b3137?style=for-the-badge&logo=github&logoColor=white)](https://github.com/mavogel)