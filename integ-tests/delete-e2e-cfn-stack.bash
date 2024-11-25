#!/bin/bash

echo "Deleting the stack."
aws cloudformation delete-stack --stack-name rootmail-cfn-test --region eu-central-1

# wait for the stack to be deleted
count=0
max_delete_count=60 # 10min
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