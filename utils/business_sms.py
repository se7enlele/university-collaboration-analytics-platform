import json
import os

from alibabacloud_dysmsapi20170525 import models as dysmsapi_models
from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
from alibabacloud_dypnsapi20170525 import models as dypnsapi_models
from alibabacloud_dypnsapi20170525.client import Client as DypnsapiClient
from alibabacloud_tea_openapi import models as open_api_models

from config import (
    ALIYUN_ACCESS_KEY_ID,
    ALIYUN_ACCESS_KEY_SECRET,
    PNVS_SMS_EXPIRE_MINUTES,
    PNVS_SMS_SIGN_NAME,
    PNVS_SMS_TEMPLATE_CODE,
    SMS_PROVIDER,
    SMS_SIGN_NAME,
    SMS_TEMPLATE_CODE,
)
from utils.business_db import create_sms_code, verify_sms_code


PLACEHOLDER_VALUES = {
    "your-key-id",
    "your-secret",
    "your-sign",
    "your-template",
    "",
}


def aliyun_keys_configured() -> bool:
    values = [ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET]
    return all(value and value not in PLACEHOLDER_VALUES for value in values)


def dysms_configured() -> bool:
    values = [ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET, SMS_SIGN_NAME, SMS_TEMPLATE_CODE]
    return all(value and value not in PLACEHOLDER_VALUES for value in values)


def provider() -> str:
    return (SMS_PROVIDER or "pnvs").strip().lower()


def create_dysms_client() -> DysmsapiClient:
    config = open_api_models.Config(
        access_key_id=ALIYUN_ACCESS_KEY_ID,
        access_key_secret=ALIYUN_ACCESS_KEY_SECRET,
        endpoint="dysmsapi.aliyuncs.com",
    )
    return DysmsapiClient(config)


def create_pnvs_client() -> DypnsapiClient:
    config = open_api_models.Config(
        access_key_id=ALIYUN_ACCESS_KEY_ID,
        access_key_secret=ALIYUN_ACCESS_KEY_SECRET,
        endpoint="dypnsapi.aliyuncs.com",
    )
    return DypnsapiClient(config)


def send_login_sms_code(phone: str) -> dict:
    current_provider = provider()
    if current_provider == "dysms":
        return send_by_dysms(phone)
    if current_provider == "debug":
        code = create_sms_code(phone)
        return {"sent": False, "provider": "debug", "debug_code": code}
    return send_by_pnvs(phone)


def verify_login_sms_code(phone: str, code: str) -> bool:
    if provider() == "pnvs" and aliyun_keys_configured():
        request = dypnsapi_models.CheckSmsVerifyCodeRequest(
            phone_number=phone,
            verify_code=code,
        )
        response = create_pnvs_client().check_sms_verify_code(request)
        body = response.body
        return bool(getattr(body, "code", None) == "OK" and getattr(body, "data", None))
    return verify_sms_code(phone, code)


def send_by_pnvs(phone: str) -> dict:
    if not aliyun_keys_configured():
        if os.getenv("SMS_DEBUG_CODE") == "1":
            code = create_sms_code(phone)
            return {"sent": False, "provider": "debug", "debug_code": code}
        raise RuntimeError(
            "PNVS SMS is not configured. Set ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET."
        )

    request = dypnsapi_models.SendSmsVerifyCodeRequest(
        phone_number=phone,
        sign_name=PNVS_SMS_SIGN_NAME,
        template_code=PNVS_SMS_TEMPLATE_CODE,
        template_param=json.dumps({"code": "##code##", "min": PNVS_SMS_EXPIRE_MINUTES}),
    )
    create_pnvs_client().send_sms_verify_code(request)
    return {"sent": True, "provider": "pnvs"}


def send_by_dysms(phone: str) -> dict:
    code = create_sms_code(phone)

    if not dysms_configured():
        if os.getenv("SMS_DEBUG_CODE") == "1":
            return {"sent": False, "provider": "debug", "debug_code": code}
        raise RuntimeError(
            "DYSMS is not configured. Set ALIYUN_ACCESS_KEY_ID, "
            "ALIYUN_ACCESS_KEY_SECRET, SMS_SIGN_NAME and SMS_TEMPLATE_CODE."
        )

    request = dysmsapi_models.SendSmsRequest(
        phone_numbers=phone,
        sign_name=SMS_SIGN_NAME,
        template_code=SMS_TEMPLATE_CODE,
        template_param=json.dumps({"code": code}),
    )
    create_dysms_client().send_sms(request)
    return {"sent": True, "provider": "dysms"}
