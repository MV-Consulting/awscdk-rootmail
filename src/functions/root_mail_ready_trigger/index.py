import json
import os
import urllib3
import uuid

def handler(event, context):

    encoded_body = json.dumps({
        "Status": "SUCCESS",
        "Reason": "RootMail Setup completed",
        "UniqueId": str(uuid.uuid4()),
        "Data": "RootMail Setup completed"
    })

    http = urllib3.PoolManager()
    http.request('PUT', os.environ['SIGNAL_URL'], body=encoded_body)