import boto3
import itertools
import json
import os
import time

domain = "{}.{}".format(os.environ['SUB_DOMAIN'], os.environ['DOMAIN'])
ses = boto3.client("ses", region_name="eu-west-1") # this is fixed to eu-west-1 until SES supports receive more globally (see #23)

def log(msg):
    print(json.dumps(msg), flush=True)

def backoff(msg, res, n):

    wait = pow(2, n)

    log({
        'level': 'info',
        'msg': msg,
        'res': res,
        'round': n,
        'waiting_in_seconds': wait,
    })

    time.sleep(n)

def handler(event, context):

    log({
        'event': event,
        'level': 'debug',
    })

    for n in itertools.count(start=1):

        res = ses.get_account_sending_enabled()

        if res.get('Enabled'):
            break
        else:
            backoff('sending not yet enabled', res, n)

    for n in itertools.count(start=1):

        res = ses.get_identity_verification_attributes(
            Identities=[
              domain,
            ],
        )

        if res.get('VerificationAttributes', {}).get(domain, {}).get('VerificationStatus') == 'Success':
            break
        else:
            backoff('verification not yet successful', res, n)

    for n in itertools.count(start=1):

        res = ses.get_identity_dkim_attributes(
            Identities=[
              domain,
            ],
        )

        if res.get('DkimAttributes', {}).get(domain, {}).get('DkimVerificationStatus') == 'Success':
            break
        else:
            backoff('DKIM verification not yet successful', res, n)

    for n in itertools.count(start=1):

        res = ses.get_identity_notification_attributes(
            Identities=[
              domain,
            ],
        )

        if res.get('NotificationAttributes', {}).get(domain, {}).get('ForwardingEnabled') == True:
            break
        else:
            backoff('forwarding not yet enabled', res, n)