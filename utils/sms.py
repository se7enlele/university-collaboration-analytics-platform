import json
import random

from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
from alibabacloud_dysmsapi20170525 import models as dysmsapi_models
from alibabacloud_tea_openapi import models as open_api_models

from config import ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET, SMS_SIGN_NAME, SMS_TEMPLATE_CODE
from utils.db_mysql import set_sms_code


def generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def create_client() -> DysmsapiClient:
    config = open_api_models.Config(
        access_key_id=ALIYUN_ACCESS_KEY_ID,
        access_key_secret=ALIYUN_ACCESS_KEY_SECRET,
        endpoint="dysmsapi.aliyuncs.com",
    )
    return DysmsapiClient(config)


def send_sms_code(phone: str) -> str:
    code = generate_code()
    set_sms_code(phone, code)

    if ALIYUN_ACCESS_KEY_ID == "your-key-id":
        return code

    client = create_client()
    request = dysmsapi_models.SendSmsRequest(
        phone_numbers=phone,
        sign_name=SMS_SIGN_NAME,
        template_code=SMS_TEMPLATE_CODE,
        template_param=json.dumps({"code": code}),
    )
    client.send_sms(request)
    return code
