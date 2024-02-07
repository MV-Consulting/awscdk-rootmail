# publish assets

```bash
brew install cfn-flip
```

1. synth and publish
```bash
npm run synth
export ROOTMAIL_VERSION=v0.0.10
npm run publish-assets
```

2. flip json to yaml
```bash
cfn-flip cdk.out/RootmailStack.template.json cdk.out/rootmailStack.assets.yaml
```
3. push it to a general release bucket
```bash
aws s3 cp cdk.out/rootmail.template.yaml s3://rootmail-releases/${ROOTMAIL_VERSION}/templates/
aws s3 cp cdk.out/RootmailStack.template.json s3://rootmail-releases/${ROOTMAIL_VERSION}/templates/
```