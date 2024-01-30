# publish assets

1. synth and publish
```bash
npm run synth
npm run publish-assets
```

2. flip json to yaml
```bash
cfn-flip cdk.out/RootmailStack.template.json cdk.out/rootmailStack.assets.yaml
```
3. push it to general release bucket
```bash
aws s3 cp cdk.out/rootmail.template.yaml s3://rootmail-releases/${ROOTMAIL_VERSION}/templates/
aws s3 cp cdk.out/RootmailStack.template.json s3://rootmail-releases/${ROOTMAIL_VERSION}/templates/
```