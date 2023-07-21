import boto3
import cfnresponse
import os

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
    # Properties = event["ResourceProperties"]
    LogicalResourceId = event["LogicalResourceId"]
    PhysicalResourceId = event.get("PhysicalResourceId")
    Domain = os.environ['DOMAIN'] #Properties["Domain"]

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
# import boto3
# import json
# import os

# client = boto3.client('sns')

# def log(msg):
#     print(json.dumps(msg), flush=True)

# def handler(event, _):
#     response_elements = event['detail']['responseElements']
#     id = response_elements.get('OpsItemId', response_elements.get('opsItemId'))
#     request_parameters = event['detail']['requestParameters']
#     desc = request_parameters.get(
#         'Description', request_parameters.get('description'))
#     title = request_parameters.get('Title', request_parameters.get('title'))
#     assert id and title and desc

#     url = "https://{}.console.aws.amazon.com/systems-manager/opsitems/{}".format(
#         os.environ['AWS_REGION'], id)

#     log({
#         'desc': desc,
#         'event': event,
#         'level': 'info',
#         'msg': 'Publishing new ops item event from CloudTrail to SNS',
#         'title': title,
#         'url': url,
#     })

#     message_title = "New OpsItem: {}".format(title)
#     message_body = "{}\n\n{}".format(desc, url)

#     client.publish(
#         Message=message_body,
#         Subject=message_title,
#         TopicArn=os.environ['TOPIC_ARN'],
#     )
