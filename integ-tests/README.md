# integ-tests

## run
1. do the changes in the `*.ts` files
2. synth the project
```bash
npm run prepare-integ-test
```
3. from the root of the project run
```bash
AWS_REGION=eu-west-2 npm run integ-test -- --parallel-regions eu-west-2 --update-on-failed
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
# remove the log groups. generic or more specific with 'RootmailTestStack' and 'SetupTest'
python3 cleanup/delete-log-groups.py Test

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