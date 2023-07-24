import boto3
import cfnresponse

ses = boto3.client("ses", region_name="eu-west-1") # this is fixed to eu-west-1 until SES supports receive more globally (see #23)

CREATE = 'Create'
DELETE = 'Delete'
UPDATE = 'Update'

def exception_handling(function):
    def catch(event, context):
        try:
            function(event, context)
        except Exception as e:
            print(e)
            print(event)
            cfnresponse.send(event, context, cfnresponse.FAILED, {})

    return catch

@exception_handling
def handler(event, context):
    RequestType = event["RequestType"]
    Properties = event["ResourceProperties"]
    LogicalResourceId = event["LogicalResourceId"]
    PhysicalResourceId = event.get("PhysicalResourceId")
    Domain = Properties["Domain"]

    print('RequestType: {}'.format(RequestType))
    print('PhysicalResourceId: {}'.format(PhysicalResourceId))
    print('LogicalResourceId: {}'.format(LogicalResourceId))

    id = PhysicalResourceId

    data = {}

    if RequestType == CREATE:

        print('Creating Domain verification and DKIM records: {}'.format(LogicalResourceId))

        response = ses.verify_domain_identity(
            Domain=Domain,
        )

        data["VerificationToken"] = response["VerificationToken"]

        response = ses.verify_domain_dkim(
            Domain=Domain,
        )

        data["DkimTokens"] = response["DkimTokens"]

    cfnresponse.send(event, context, cfnresponse.SUCCESS, data, id)