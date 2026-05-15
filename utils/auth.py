import streamlit as st

from utils.db_mysql import get_or_create_user, verify_sms_code
from utils.sms import send_sms_code


def current_user() -> dict | None:
    return st.session_state.get("user")


def is_logged_in() -> bool:
    return current_user() is not None


def is_paid() -> bool:
    user = current_user() or {}
    return bool(user.get("is_paid"))


def login_box() -> None:
    st.subheader("手机号登录")
    phone = st.text_input("手机号", key="login_phone")
    code = st.text_input("验证码", key="login_code")
    col1, col2 = st.columns(2)

    with col1:
        if st.button("获取验证码", use_container_width=True):
            if not phone:
                st.warning("请输入手机号")
            else:
                try:
                    debug_code = send_sms_code(phone)
                    if debug_code:
                        with st.expander("本地调试验证码", expanded=False):
                            st.code(debug_code)
                    st.success("验证码已发送")
                except Exception as exc:
                    st.error(f"验证码发送失败：{exc}")

    with col2:
        if st.button("登录", type="primary", use_container_width=True):
            if not phone or not code:
                st.warning("请输入手机号和验证码")
            else:
                try:
                    if verify_sms_code(phone, code):
                        st.session_state["user"] = get_or_create_user(phone)
                        st.rerun()
                    else:
                        st.error("验证码错误或已过期")
                except Exception as exc:
                    st.error(f"登录失败：{exc}")


def require_login(message: str = "请先登录后继续操作。") -> bool:
    if is_logged_in():
        return True
    st.info(message)
    login_box()
    return False


def logout_button() -> None:
    if st.button("退出登录"):
        st.session_state.pop("user", None)
        st.rerun()
