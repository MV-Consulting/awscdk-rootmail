import boto3
import os
import sys

def delele_log_groups(pattern, aws_region):
    # from env AWS_REGION
    logs = boto3.client('logs', region_name=aws_region)
    paginator = logs.get_paginator('describe_log_groups')
    for page in paginator.paginate():
        for log_group in page['logGroups']:
            if pattern in log_group['logGroupName']:
                print(f"Deleting log group: {log_group['logGroupName']}")
                logs.delete_log_group(logGroupName=log_group['logGroupName'])
                print(f"Log group {log_group['logGroupName']} deleted")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Please a pattern of the log group name as 1st parameter AND the aws region as 2nd.")
        sys.exit(1)
    
    pattern = sys.argv[1]
    aws_region = sys.argv[2]
    delele_log_groups(pattern, aws_region)

