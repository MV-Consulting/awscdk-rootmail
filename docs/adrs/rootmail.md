# RootMail (_RML_)

Based on the initial [ADR](https://github.com/superwerker/superwerker/blob/main/docs/adrs/rootmail.md) from the superwerker project which is used as a baseline.

## Context

Each AWS account needs one unique email address (the so-called "AWS account root user email address").

Access to these email addresses must be adequately secured since they provide privileged access to AWS accounts, such as account deletion procedures.

Antipatterns to such implementation include:

- Using the CTOs private mailbox to handle root mails
- Using no convention / arbitrary root mails, controlled by various users (sometimes using private mailboxes that are not controlled by the company owning the accounts)
- Using mailing lists with an uncontrollable number of recipients
- Using no strong keys as unphishable MFA tokens
- Using non-existent / invalid / no longer controlled email addresses

The `awscdk-rootmail` secure setup includes the following considerations:

- Mailboxes should enjoy at least the same level of security as the associated AWS account - this makes it easier to leverage existing security controls (such as CloudTrail audit logs or SSO MFA authentication) instead of recreating them for e.g. a third-party email solution
- Mailboxes should be used exclusively for one purpose - this avoids phishing and spearphishing risks and reduces the chance of missing important mails
- Mailboxes should not be shared (e.g., not be mailing lists) to identify principals in audit trails
- Root emails should be generated uniformly to avoid operator error that could result in the address being not controlled
- Root emails must be collision-free

## Decision

- The RootMail feature is useful because:
  - if you install ControlTower, RootMail provides two email addresses for the audit and log archive acccounts, which are necessary for the Control Tower setup.
  - (future) automations, such as automated AWS account creation for workloads.
- A subdomain associated Route53 DNS hosted zone is setup (e.g. `aws.mycompany.test`) that contains the necessary configurations of AWS SES for receiving root emails - this style is chosen to make it convenient to delegate from a company domain and to enable continuous integration testing that does not require a new domain for every build
- This subdomain handles all root emails for all superwerker provisioned member accounts
- Email address are generated using random aliases (e.g. `root+22c29f9d33ad@aws.mycompany.test`)
- Emails sent to such aliases automatically create AWS SSM OpsCenter Ops Items
- Emails are partially classified as e.g. "Password Reset Requested" etc.
- KMS encryption is currently not implemented

### Mail Receiving

- Receiving emails with SES **was** only available in the following [regions](https://docs.aws.amazon.com/ses/latest/dg/regions.html) `eu-west-1`, `us-east-1` and `us-west-2`, however has expanded in [09/2023](https://aws.amazon.com/de/about-aws/whats-new/2023/09/amazon-ses-email-service-7-regions/): Asia Pacific (Sydney), Asia Pacific (Tokyo), Asia Pacific (Singapore), Europe (Frankfurt), Europe (London), Canada (Central), and US East (Ohio). Still not all regions, but a progress. This results  in the following options:
```ts
'us-east-1', // US East (N. Virginia),
'eu-west-1', // Europe (Ireland),
'us-west-2', // US West (Oregon),
// new regions since 2023-09
'eu-central-1', // Europe (Frankfurt),
'eu-west-2', // Europe (London),
'us-east-2', // US East (Ohio),
'ca-central-1', // Canada (Central),
'ap-northeast-1', // Asia Pacific (Tokyo),
'ap-southeast-1', // Asia Pacific (Singapore),
'ap-southeast-2', // Asia Pacific (Sydney),
```
- An [OpsItems](https://docs.aws.amazon.com/systems-manager/latest/userguide/OpsCenter-create-OpsItems.html) will be created in the configured region for receiving emails.

## Consequences

- Users have to control a domain (e.g. `mycompany.test`) and configure their subdomain delegation (e.g. `aws.mycompany.test`)
- All received emails are processed in the region the stack is deployed to.