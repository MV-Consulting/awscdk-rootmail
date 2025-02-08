![Source](https://img.shields.io/github/stars/MV-Consulting/awscdk-rootmail?logo=github&label=GitHub%20Stars)
[![Build Status](https://github.com/MV-Consulting/awscdk-rootmail/actions/workflows/build.yml/badge.svg)](https://github.com/MV-Consulting/awscdk-rootmail/actions/workflows/build.yml)
[![ESLint Code Formatting](https://img.shields.io/badge/code_style-eslint-brightgreen.svg)](https://eslint.org)
[![Latest release](https://img.shields.io/github/release/MV-Consulting/awscdk-rootmail.svg)](https://github.com/MV-Consulting/awscdk-rootmail/releases)
![GitHub](https://img.shields.io/github/license/MV-Consulting/awscdk-rootmail)
[![npm](https://img.shields.io/npm/dt/@mavogel/awscdk-rootmail?label=npm&color=orange)](https://www.npmjs.com/package/@mavogel/awscdk-rootmail)
[![typescript](https://img.shields.io/badge/jsii-typescript-blueviolet.svg)](https://www.npmjs.com/package/@mavogel/cdk-vscode-server)

# awscdk-rootmail

A single email box for all your root user emails in all AWS accounts of the organization. 
- The cdk implementation and **adaption** of the [superwerker](https://superwerker.cloud/) rootmail feature. 
- See [here](docs/adrs/rootmail.md) for a detailed Architectural Decision Record ([ADR](https://adr.github.io/))

## TL;DR ⚡
Each AWS account needs one unique email address (the so-called "AWS account root user email address").

Access to these email addresses must be adequately secured since they provide privileged access to AWS accounts, such as account deletion procedures.

This is why you only need 1 mailing list for the AWS Management (formerly *root*) account, 
we recommend the following pattern `aws-roots+<uuid>@mycompany.test` 

> [!NOTE]
> Maximum **64** characters are allowed for the whole address. 

And as you own the domain `mycompany.test` you can add a subdomain, e.g. `aws`, for which all EMails will then be received with this solution within this particular AWS Management account.

Feel free to take a look at the design 
![rootmail-solution-diagram-v1](docs/img/awscdk-rootmail-v1-min.png)

## Usage ✨

Install the dependencies:
```sh
brew install aws-cli node@18 esbuild
```

You can chose via embedding the construct in your cdk-app or use is directly via Cloudformation.
### cdk 🤖
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

### cdk with your own receiver function 🏗️
You might also want to pass in you own function on what to do when an EMail is received

> [!TIP]
> You can add any custom code as receiver function you want.

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


> [!TIP]
> Take a look at the solution design for external DNS [here](docs/adrs/solution-design-external-dns-provider.md) for more details.

</details>

### Cloudformation 📦
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

## 🚀 Unlock the Full Potential of Your AWS Cloud Infrastructure  

Hi, I’m Manuel, an AWS expert passionate about empowering businesses with **scalable, resilient, and cost-optimized cloud solutions**. With **MV Consulting**, I specialize in crafting **tailored AWS architectures** and **DevOps-driven workflows** that not only meet your current needs but grow with you.  

---

### 🌟 Why Work With Me?  

✔️ **Tailored AWS Solutions:** Every business is unique, so I design custom solutions that fit your goals and challenges.  
✔️ **Well-Architected Designs:** From scalability to security, my solutions align with AWS Well-Architected Framework.  
✔️ **Cloud-Native Focus:** I specialize in modern, cloud-native systems that embrace the full potential of AWS.  
✔️ **Business-Driven Tech:** Technology should serve your business, not the other way around.  

---

### 🛠 What I Bring to the Table  

🔑 **12x AWS Certifications**  
I’m **AWS Certified Solutions Architect and DevOps – Professional** and hold numerous additional certifications, so you can trust I’ll bring industry best practices to your projects. Feel free to explose by [badges](https://www.credly.com/users/manuel-vogel)

⚙️ **Infrastructure as Code (IaC)**  
With deep expertise in **AWS CDK** and **Terraform**, I ensure your infrastructure is automated, maintainable, and scalable.  

📦 **DevOps Expertise**  
From CI/CD pipelines with **GitHub Actions** and **GitLab CI** to container orchestration **Kubernetes** and others, I deliver workflows that are smooth and efficient.  

🌐 **Hands-On Experience**  
With over **7 years of AWS experience** and a decade in the tech world, I’ve delivered solutions for companies large and small. My open-source contributions showcase my commitment to transparency and innovation. Feel free to explore my [GitHub profile](https://github.com/mavogel)

---

### 💼 Let’s Build Something Great Together  

I know that choosing the right partner is critical to your success. When you work with me, you’re not just contracting an engineer – you’re gaining a trusted advisor and hands-on expert who cares about your business as much as you do.  

✔️ **Direct Collaboration**: No middlemen or red tape – you work with me directly.  
✔️ **Transparent Process**: Expect open communication, clear timelines, and visible results.  
✔️ **Real Value**: My solutions focus on delivering measurable impact for your business.  


<a href="https://tinyurl.com/mvc-15min"><img alt="Schedule your call" src="https://img.shields.io/badge/schedule%20your%20call-success.svg?style=for-the-badge"/></a>  

---

## 🙌 Acknowledgements

Big shoutout to the amazing team behind [Projen](https://github.com/projen/projen)!  
Their groundbreaking work simplifies cloud infrastructure projects and inspires us every day. 💡

## Author

[Manuel Vogel](https://manuel-vogel.de/about/)

[![](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/manuel-vogel)
[![](https://img.shields.io/badge/GitHub-2b3137?style=for-the-badge&logo=github&logoColor=white)](https://github.com/mavogel)