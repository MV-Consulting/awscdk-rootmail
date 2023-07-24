import boto3
import cfnresponse

ses = boto3.client("ses")

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
    Subdomain = Properties["Subdomain"]
    EmailBucket = Properties["EmailBucket"]
    OpsSantaFunctionArn = Properties["OpsSantaFunctionArn"]

    print('RequestType: {}'.format(RequestType))
    print('PhysicalResourceId: {}'.format(PhysicalResourceId))
    print('LogicalResourceId: {}'.format(LogicalResourceId))

    id = PhysicalResourceId
    rule_set_name = 'RootMail'
    rule_name = 'Receive'

    if RequestType == CREATE or RequestType == UPDATE:
        ses.create_receipt_rule_set(
            RuleSetName=rule_set_name
        )

        ses.create_receipt_rule(
            RuleSetName=rule_set_name,
            Rule          = {
                'Name'      : rule_name,
                'Enabled'   : True,
                'TlsPolicy' : 'Require',
                'ScanEnabled': True,
                'Recipients': [
                    print("'root@{}.{}'".format(Subdomain, Domain)),
                ],
                'Actions': [
                    {
                        'S3Action'         : {
                        'BucketName'     : print("'{}'".format(EmailBucket)),
                        'ObjectKeyPrefix': 'RootMail'
                        },
                    },
                    {
                        'LambdaAction': {
                        'FunctionArn': print("'{}'".format(OpsSantaFunctionArn)),
                        }
                    }
                ],
            }
        )

        print('Activating SES ReceiptRuleSet: {}'.format(LogicalResourceId))

        ses.set_active_receipt_rule_set(
            RuleSetName=rule_set_name,
        )
    elif RequestType == DELETE:
        print('Deactivating SES ReceiptRuleSet: {}'.format(LogicalResourceId))

        ses.set_active_receipt_rule_set()

        ses.delete_receipt_rule(
            RuleName=rule_name,
            RuleSetName=rule_set_name,
        )

        ses.delete_receipt_rule_set(
            RuleSetName=rule_set_name
        )


    cfnresponse.send(event, context, cfnresponse.SUCCESS, {}, id)