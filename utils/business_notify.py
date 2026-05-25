from __future__ import annotations

import os
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr

from config import ADMIN_EMAIL, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER


SITE_URL = os.getenv("SITE_URL", "https://acadmap.com")


def is_mail_configured() -> bool:
    placeholders = {"", "your-email@gmail.com", "your-app-password"}
    return (
        bool(ADMIN_EMAIL)
        and SMTP_USER not in placeholders
        and SMTP_PASSWORD not in placeholders
        and SMTP_HOST not in placeholders
    )


def notify_access_request(request: dict) -> bool:
    if not is_mail_configured():
        return False

    subject = f"AcadMap 新开通申请：{request.get('organization') or request.get('phone') or '未知机构'}"
    lines = [
        "有新的开通申请需要跟进。",
        "",
        f"机构：{request.get('organization') or '-'}",
        f"联系人：{request.get('name') or '-'}",
        f"手机号：{request.get('phone') or '-'}",
        f"角色/部门：{request.get('role') or '-'}",
        f"来源：{request.get('source') or '-'}",
        f"线索状态：{request.get('lead_status') or '-'}",
        f"提交时间：{request.get('created_at') or '-'}",
        "",
        "留言：",
        request.get("message") or "-",
        "",
        f"后台查看：{SITE_URL}/admin",
    ]
    message = MIMEText("\n".join(lines), "plain", "utf-8")
    message["Subject"] = subject
    message["From"] = formataddr(("AcadMap", SMTP_USER))
    message["To"] = ADMIN_EMAIL

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, [ADMIN_EMAIL], message.as_string())
    return True
