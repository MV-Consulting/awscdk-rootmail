#!/bin/bash

RELEASE_VERSION=$1
if [ -z "$RELEASE_VERSION" ]; then
    echo "Please provide the release version as the first argument."
    exit 1
fi
echo "Using release version: '$RELEASE_VERSION'"

# test if there is already a stack with the name rootmail-cfn-test
STACK_EXISTS=$(aws cloudformation describe-stacks --stack-name rootmail-cfn-test --region eu-central-1 --no-cli-pager 2>&1)
if [ ! -z "$STACK_EXISTS" ]; then
    echo "Stack with the name rootmail-cfn-test already exists. Please delete it first."
    exit 1
fi

echo "Running E2E test for CloudFormation template."
aws cloudformation create-stack \
    --stack-name rootmail-cfn-test \
    --template-url https://mvc-dev-releases.s3.eu-central-1.amazonaws.com/rootmail/${RELEASE_VERSION}/awscdk-rootmail.template.json \
    --parameters ParameterKey=Domain,ParameterValue=rootmail-test.mavogel.xyz ParameterKey=Subdomain,ParameterValue=zft23-eu-central-1 ParameterKey=WireDNSToHostedZoneID,ParameterValue=Z01336592122MNIWKOZSV \
    --disable-rollback \
    --capabilities CAPABILITY_AUTO_EXPAND CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --no-cli-pager \
    --region eu-central-1

# get the status of the stack
count=0
max_create_count=60 # 10min
while [[ ! "$STACK_STATUS" == *"_FAILED" ]] && [[ ! "$STACK_STATUS" == *"_COMPLETE" ]]; do
    sleep 10
    count=$((count+1))
    STACK_STATUS=$(aws cloudformation describe-stacks --stack-name rootmail-cfn-test --query 'Stacks[0].StackStatus' --output text --region eu-central-1)
    echo "($count/$max_create_count) Stack status: $STACK_STATUS at $(date)"
    if [ $count -eq $max_create_count ]; then
        echo "Max retries reached. Stack creation failed."
        exit 1
    fi
done

echo "Stack creation successful. Sleep for 5 seconds."
sleep 5