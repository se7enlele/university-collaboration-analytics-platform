import streamlit as st

from utils.auth import current_user, login_box, logout_button
from utils.payment import payment_panel
from utils.ui import inject_style


st.set_page_config(page_title="高校国际合作智析平台", page_icon="🌐", layout="wide")
inject_style()

st.title("高校国际合作智析平台")
st.caption("看清格局、识别重点、辅助决策、证明成效")

user = current_user()
if user:
    st.sidebar.success(f"已登录：{user['phone']}")
    st.sidebar.write("付费状态：", "已开通" if user.get("is_paid") else "免费版")
    logout_button()
else:
    login_box()

payment_panel()

st.markdown(
    """
    ### 工作台
    左侧页面导航包含全球合作地图、合作机构排行、僵尸合作识别、学科热力图、对标分析和管理后台。

    数据初始化顺序：
    1. `python data/fetch_openalex.py`
    2. `python data/process_data.py`
    3. `streamlit run app.py`
    """
)

st.info("MVP 阶段支付采用支付宝静态收款码 + 管理员人工审核。")
