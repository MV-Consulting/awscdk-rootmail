# integ-tests

Still WIP!

## run
### changes
1. do the changes in the `*.ts` files
2. from the root of the project run
```bash
# run the dry-run to see changes if they are destructive
yarn run integ-test -- --dry-run
# NOTE: undo the changes in the integ.snapshot so the next call
# will really run the tests with the update
# run the tests
yarn run integ-test
```

### changes in CR
the `integ-runner` does not detect the changes, this is why we need to run all test via the `--force` flag
```bash
yarn run integ-test -- --force
```

## clean up manually
### s3 bucket
```bash
# in 'awscdk-rootmail/integ-tests' folder
virtualenv venv
source venv/bin/activate
pip3 install -r requirements.tx

# determine bucket name
aws s3 ls | grep rootmailinteg
# empty and remove the bucket
python3 cleanup/empty-and-delete-s3-bucket.py rootmailintegteststack-testrootmailemailbucket<suffix>
# or short in fish
for bucket in $(aws s3 ls | grep rootmailinteg |  awk '{ print $3 }'); echo $bucket; python3 cleanup/empty-and-delete-s3-bucket.py $bucket; end
# remove the log groups. generic or more specific with 'rootmailinteg' and 'SetupTest'
python3 cleanup/delete-log-groups.py Integ eu-west-1
python3 cleanup/delete-log-groups.py Integ eu-west-2
# or short in fish
for lgregion in eu-west-1 eu-west-2; echo $lgregion; python3 cleanup/delete-log-groups.py Integ $lgregion; end

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