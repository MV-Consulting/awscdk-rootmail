import boto3
import os
import sys

def delele_log_groups(pattern):
    # from env AWS_REGION
    logs = boto3.client('logs', region_name=os.environ['AWS_REGION'])
    paginator = logs.get_paginator('describe_log_groups')
    for page in paginator.paginate():
        for log_group in page['logGroups']:
            if pattern in log_group['logGroupName']:
                print(f"Deleting log group: {log_group['logGroupName']}")
                logs.delete_log_group(logGroupName=log_group['logGroupName'])
                print(f"Log group {log_group['logGroupName']} deleted")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Please a pattern of the log group name as a parameter.")
        sys.exit(1)
    
    pattern = sys.argv[1]
    delele_log_groups(pattern)
