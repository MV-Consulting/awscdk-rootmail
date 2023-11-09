# integ-tests

## setup
```bash
# on which we create the 'integ-test-1234' test subdomain
export TEST_DOMAIN=your-test-domain.com
# from the root of the project start the tests
npm run integ-test
```
## clean up manually
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