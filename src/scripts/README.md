# publish assets

## setup
1. install tools
```bash
brew install cfn-flip
```
2. create a publicly read accessible s3 bucket
```bash
export MY_PUBLISH_BUCKET="mvc-public-bucket-test"

# Step 1: Create the bucket
aws s3 mb s3://$MY_PUBLISH_BUCKET --region eu-west-1

# Step 2: change the public access block
aws s3api put-public-access-block --bucket $MY_PUBLISH_BUCKET --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Step 3: Apply a bucket policy granting public read access
aws s3api put-bucket-policy --bucket $MY_PUBLISH_BUCKET --policy '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AddPublicReadAccess",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$MY_PUBLISH_BUCKET/*"
        }
    ]
}'
```

## publish

1. synth and publish
```bash
ROOTMAIL_VERSION="0.0.10-DEVELOPMENT" npx cdk synth
npm run publish-assets
```

2. flip json to yaml
```bash
cfn-flip cdk.out/RootmailStack.template.json cdk.out/rootmailStack.template.yaml
```
3. push it to a general release bucket
```bash
aws s3 cp cdk.out/rootmailStack.template.yaml s3://$MY_PUBLISH_BUCKET/$ROOTMAIL_VERSION/templates/
aws s3 cp cdk.out/RootmailStack.template.json s3://$MY_PUBLISH_BUCKET/$ROOTMAIL_VERSION/templates/
```