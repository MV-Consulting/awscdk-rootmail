import boto3
import email
from email import policy
import hashlib
import json
import re
import datetime

s3 = boto3.client('s3')
ssm = boto3.client('ssm', region_name='${AWS::Region}')

filtered_email_subjects = [
    'Your AWS Account is Ready - Get Started Now',
    'Welcome to Amazon Web Services',
]

def handler(event, context):

    log({
        'event': event,
        'level': 'debug',
    })

    for record in event['Records']:

        id = record['ses']['mail']['messageId']
        key = 'RootMail/{key}'.format(key=id)
        receipt = record['ses']['receipt']

        log({
            'id': id,
            'level': 'debug',
            'key': key,
            'msg': 'processing mail',
        })

        verdicts = {
            'dkim': receipt['dkimVerdict']['status'],
            'spam': receipt['spamVerdict']['status'],
            'spf': receipt['spfVerdict']['status'],
            'virus': receipt['virusVerdict']['status'],
        }

        for k, v in verdicts.items():

            if not v == 'PASS':

                log({
                    'class': k,
                    'id': id,
                    'key': key,
                    'level': 'warn',
                    'msg': 'verdict failed - ops santa item skipped',
                })

                return

        response = s3.get_object(
            Bucket="${EmailBucket}",
            Key=key,
        )

        msg = email.message_from_bytes(response["Body"].read(), policy=policy.default)

        title=msg["subject"]

        source=recipient=event["Records"][0]["ses"]["mail"]["destination"][0]

        if title == 'Amazon Web Services Password Assistance':
            description=msg.get_body('html').get_content()
            pw_reset_link = re.search(r'(https://signin.aws.amazon.com/resetpassword(.*?))(?=<br>)', description).group()
            rootmail_identifier = '/superwerker/rootmail/pw_reset_link/{}'.format(source.split('@')[0].split('root+')[1])
            ssm.put_parameter(
                Name=rootmail_identifier,
                Value=pw_reset_link,
                Overwrite=True,
                Type='String',
                Tier='Advanced',
                Policies=json.dumps([
                {
                    "Type":"Expiration",
                    "Version":"1.0",
                    "Attributes":{
                    "Timestamp": (datetime.datetime.now() + datetime.timedelta(minutes = 10)).strftime('%Y-%m-%dT%H:%M:%SZ') # expire in 10 minutes
                    }
                }
                ])
            )
            return # no ops item for now

        if title in filtered_email_subjects:
            log({
                'level': 'info',
                'msg': 'filtered email',
                'title': title,
            })
            return

        description=msg.get_body(preferencelist=('plain', 'html')).get_content()

        title=title[:1020] + " ..." * (len(title) > 1020)

        description=description[:1020] + " ..." * (len(description) > 1020)

        source=source[:60] + ' ...' * (len(source) > 60)

        operational_data={
            "/aws/dedup":{
                "Value":json.dumps(
                    {
                        "dedupString":id,
                    }
                ),
                "Type":"SearchableString",
            },
            "/aws/resources":{
                "Value":json.dumps([
                    {
                        "arn":"${EmailBucket.Arn}/{key}".format(key=key),
                    }
                ]),
                "Type":"SearchableString",
            },
        }

        ssm.create_ops_item(
            Description=description,
            OperationalData=operational_data,
            Source=source,
            Title=title,
        )

def log(msg):
    print(json.dumps(msg), flush=True)