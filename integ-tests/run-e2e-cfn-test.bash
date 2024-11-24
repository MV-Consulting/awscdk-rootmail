#!/bin/bash

RELEASE_VERSION=$1
if [ -z "$RELEASE_VERSION" ]; then
    echo "Please provide the release version as the first argument."
    exit 1
fi
echo "Using release version: '$RELEASE_VERSION'"

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
max_create_count=30 # 5min
while [[ ! "$STACK_STATUS" == *"_FAILED" ]] && [[ ! "$STACK_STATUS" == *"_COMPLETE" ]]; do
    sleep 10
    count=$((count+1))
    STACK_STATUS=$(aws cloudformation describe-stacks --stack-name rootmail-cfn-test --query 'Stacks[0].StackStatus' --output text)
    echo "($count/$max_create_count) Stack status: $STACK_STATUS at $(date)"
    if [ $count -eq $max_retries ]; then
        echo "Max retries reached. Stack creation failed."
        exit 1
    fi
done

sleep 5

echo "Deleting the stack."
aws cloudformation delete-stack --stack-name rootmail-cfn-test --region eu-central-1

# wait for the stack to be deleted
count=0
max_delete_count=30 # 5min
STACK_STATUS="undefined"
while [[ ! "$STACK_STATUS" == *"_FAILED" ]] && [[ ! "$STACK_STATUS" == *"_COMPLETE" ]]; do
    sleep 2
    count=$((count+1))
    STACK_STATUS=$(aws cloudformation describe-stacks --stack-name rootmail-cfn-test --query 'Stacks[0].StackStatus' --output text)
    echo "($count/$max_delete_count) Stack status: $STACK_STATUS at $(date)"
    # if STACK_STATUS is empty, the stack does not exist anymore
    if [ -z "$STACK_STATUS" ]; then
        echo "Stack deletion successful."
        break
    fi
    if [ $count -eq $max_delete_count ]; then
        echo "Max retries reached. Stack deletion failed."
        exit 1
    fi
done

echo "E2E test for CloudFormation template finished."