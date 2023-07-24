import os
from unittest.mock import MagicMock

def test_notification_dummy(mocker):
    os.environ['DOMAIN'] = 'example.com'
    # os.environ['AWS_REGION'] = 'aws-region'
    # ops_item_id: str = 'ops_item_id_123'
    # url: str = 'https://{}.console.aws.amazon.com/systems-manager/opsitems/{}'.format(
    #     os.environ['AWS_REGION'], ops_item_id)
    # title: str = 'test_message_title'
    # description: str = 'test_message_description'

    ssm_client_mock = MagicMock()
    # ssm_client_mock = MagicMock()
    mocker.patch('boto3.client', return_value=ssm_client_mock)

    # from index import handler

    # handler({
    #     'detail': {
    #         'responseElements': {
    #             'opsItemId': ops_item_id,
    #         },
    #         'requestParameters': {
    #             'description': description,
    #             'title': title,
    #         },
    #     }
    # }, {})

    # sns_client_mock.publish.assert_called_once_with(
    #     Message='{}\n\n{}'.format(description, url),
    #     Subject='New OpsItem: {}'.format(title),
    #     TopicArn='no arn',
    # )