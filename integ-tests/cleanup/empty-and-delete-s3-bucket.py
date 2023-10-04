import boto3
import sys

def empty_and_delete_bucket(bucket_name):
    s3 = boto3.resource('s3')
    bucket = s3.Bucket(bucket_name)

    # Empty the bucket
    print(f"Emptying bucket: {bucket_name}")
    for obj_version in bucket.object_versions.all():
        obj_version.delete()

    # Delete the bucket
    bucket.delete()
    print(f"Bucket {bucket_name} deleted")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Please provide the bucket name as a parameter.")
        sys.exit(1)
    
    bucket_name = sys.argv[1]
    empty_and_delete_bucket(bucket_name)
