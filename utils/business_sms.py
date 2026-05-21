import json
import os

from alibabacloud_dysmsapi20170525 import models as dysmsapi_models
from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
from alibabacloud_tea_openapi import models as open_api_models

from config import ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET, SMS_SIGN_NAME, SMS_TEMPLATE_CODE
from utils.business_db import create_sms_code


PLACEHOLDER_VALUES = {
    "your-key-id",
    "your-secret",
    "your-sign",
    "your-template",
    "",
}


def sms_configured() -> bool:
    values = [ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET, SMS_SIGN_NAME, SMS_TEMPLATE_CODE]
    return all(value and value not in PLACEHOLDER_VALUES for value in values)


def create_client() -> DysmsapiClient:
    config = open_api_models.Config(
        access_key_id=ALIYUN_ACCESS_KEY_ID,
        access_key_secret=ALIYUN_ACCESS_KEY_SECRET,
        endpoint="dysmsapi.aliyuncs.com",
    )
    return DysmsapiClient(config)


def send_login_sms_code(phone: str) -> dict:
    code = create_sms_code(phone)

    if not sms_configured():
        if os.getenv("SMS_DEBUG_CODE") == "1":
            return {"sent": False, "debug_code": code}
        raise RuntimeError(
            "SMS service is not configured. Set ALIYUN_ACCESS_KEY_ID, "
            "ALIYUN_ACCESS_KEY_SECRET, SMS_SIGN_NAME and SMS_TEMPLATE_CODE."
        )

    request = dysmsapi_models.SendSmsRequest(
        phone_numbers=phone,
        sign_name=SMS_SIGN_NAME,
        template_code=SMS_TEMPLATE_CODE,
        template_param=json.dumps({"code": code}),
    )
    create_client().send_sms(request)
    return {"sent": True}
