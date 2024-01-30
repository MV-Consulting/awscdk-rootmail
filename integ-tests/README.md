# integ-tests

## setup
```bash
# on which we create the 'integ-test-1234' test subdomain
export TEST_DOMAIN=your-test-domain.com
export TEST_ACCOUNT_ID=123456789012
# from the root of the project start the tests
npm run integ-test
```
## clean up manually
### s3 bucket
```bash
# in 'awscdk-rootmail/integ-tests' folder
virtualenv venv
source venv/bin/activate
pip3 install -r requirements.tx

# determine bucket name
aws s3 ls | grep rootmailteststack
# empty and remove the bucket
python3 cleanup/empty-and-delete-s3-bucket.py rootmailteststack-testrootmailemailbucket<suffix>

# when your done deactive the virtual env via
# see https://stackoverflow.com/questions/990754/how-to-leave-exit-deactivate-a-python-virtualenv
deactivate
```

### log groups from handlers
- filter by `Test` with this [query](https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups$3FlogGroupNameFilter$3DTest)
- delete all log groups matching

## testing cloudformation templates
- publish the version
- create a cloudformation stack
- test 2 times
    1. with the Hosted Zone ID given
    2. without the Hosted Zone ID, and add it by hand