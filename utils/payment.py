import smtplib
from email.mime.text import MIMEText

import streamlit as st

from config import ADMIN_EMAIL, ALIPAY_QR_PATH, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER
from utils.auth import current_user
from utils.db_mysql import create_payment_request


def notify_admin(phone: str, trade_no: str) -> None:
    if SMTP_USER == "your-email@gmail.com":
        return
    message = MIMEText(f"手机号：{phone}\n支付宝付款单号：{trade_no}", "plain", "utf-8")
    message["Subject"] = f"新付款待审核 - {phone}"
    message["From"] = SMTP_USER
    message["To"] = ADMIN_EMAIL

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, [ADMIN_EMAIL], message.as_string())


def payment_panel() -> None:
    user = current_user()
    if not user or user.get("is_paid"):
        return

    with st.expander("🔒 升级解锁完整数据", expanded=False):
        st.write("扫码支付 19.9 元后，请填写支付宝付款单号。管理员审核通过后自动开通一年。")
        st.image(ALIPAY_QR_PATH, width=220)
        trade_no = st.text_input("支付宝付款单号")
        if st.button("提交审核", type="primary"):
            if not trade_no:
                st.warning("请输入付款单号")
                return
            try:
                create_payment_request(user["phone"], trade_no.strip())
                notify_admin(user["phone"], trade_no.strip())
                st.success("已提交审核，请等待管理员开通。")
            except Exception as exc:
                st.error(f"提交失败：{exc}")
