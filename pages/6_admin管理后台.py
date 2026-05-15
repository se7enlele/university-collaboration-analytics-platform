import pandas as pd
import streamlit as st
from sqlalchemy import text

from config import ADMIN_PASSWORD
from utils.db_mysql import approve_payment, get_engine, init_mysql_tables, reject_payment
from utils.ui import inject_style, page_shell_end, page_shell_start


st.set_page_config(page_title="管理后台", layout="wide")
inject_style()
page_shell_start()

st.title("管理后台")
st.caption("用于付费审核和用户状态管理。")

password = st.text_input("管理员密码", type="password")
if password != ADMIN_PASSWORD:
    page_shell_end()
    st.stop()

try:
    engine = get_engine()
    init_mysql_tables(engine)
    with engine.begin() as conn:
        pending = pd.read_sql(
            text(
                "SELECT id, phone, alipay_trade_no, submitted_at "
                "FROM payment_requests WHERE status = 'pending' ORDER BY submitted_at DESC"
            ),
            conn,
        )
        paid_users = pd.read_sql(
            text("SELECT phone, paid_at, paid_until FROM users WHERE is_paid = TRUE ORDER BY paid_until DESC"),
            conn,
        )
except Exception as exc:
    st.error(f"MySQL 连接失败：{exc}")
    page_shell_end()
    st.stop()

st.subheader("待审核列表")
for _, row in pending.iterrows():
    cols = st.columns([2, 3, 2, 1, 1])
    cols[0].write(row["phone"])
    cols[1].write(row["alipay_trade_no"])
    cols[2].write(row["submitted_at"])
    if cols[3].button("通过", key=f"approve_{row['id']}", use_container_width=True):
        approve_payment(int(row["id"]), engine)
        st.rerun()
    if cols[4].button("拒绝", key=f"reject_{row['id']}", use_container_width=True):
        reject_payment(int(row["id"]), engine)
        st.rerun()

st.subheader("已付费用户")
st.dataframe(paid_users, use_container_width=True, hide_index=True)

page_shell_end()
