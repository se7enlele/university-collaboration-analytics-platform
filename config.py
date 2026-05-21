import os


MYSQL_HOST = os.getenv("MYSQL_HOST", "your-rds-host")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "your-user")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "your-password")
MYSQL_DB = os.getenv("MYSQL_DB", "platform")

ALIYUN_ACCESS_KEY_ID = os.getenv("ALIYUN_ACCESS_KEY_ID", "your-key-id")
ALIYUN_ACCESS_KEY_SECRET = os.getenv("ALIYUN_ACCESS_KEY_SECRET", "your-secret")
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "pnvs")
SMS_SIGN_NAME = os.getenv("SMS_SIGN_NAME", "your-sign")
SMS_TEMPLATE_CODE = os.getenv("SMS_TEMPLATE_CODE", "your-template")
PNVS_SMS_SIGN_NAME = os.getenv("PNVS_SMS_SIGN_NAME", "速通互联网验证码")
PNVS_SMS_TEMPLATE_CODE = os.getenv("PNVS_SMS_TEMPLATE_CODE", "100001")
PNVS_SMS_EXPIRE_MINUTES = os.getenv("PNVS_SMS_EXPIRE_MINUTES", "5")

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "your-admin-password")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "your-email@gmail.com")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "your-email@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "your-app-password")

SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", "data/works.db")
ALIPAY_QR_PATH = os.getenv("ALIPAY_QR_PATH", "static/images/alipay_qr.png")
