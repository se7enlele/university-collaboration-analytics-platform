from datetime import datetime

import streamlit as st

from utils.db_sqlite import query_df
from utils.ui import data_warning, download_excel, filter_clause, inject_style, page_nav, page_shell_end, page_shell_start, paywall, sidebar_filters


st.set_page_config(page_title="低效合作识别", layout="wide")
inject_style()
page_nav("低效合作")
page_shell_start()

st.title("低效合作识别")
st.caption("公开查看沉默合作概览，完整机构名单和导出能力需要开通。")

if data_warning():
    page_shell_end()
    st.stop()

filters = sidebar_filters()
where_sql, params = filter_clause(filters)
current_year = datetime.now().year

zombie_df = query_df(
    f"""
    SELECT
        c.collab_institution AS 机构名称,
        c.collab_country_name AS 所属国家,
        COUNT(DISTINCT w.id) AS 历史合作论文数,
        MAX(w.year) AS 最后合作年份
    FROM works w
    JOIN collaborations c ON w.id = c.work_id
    WHERE {where_sql} AND w.is_international = 1
    GROUP BY c.collab_institution, c.collab_country_name
    ORDER BY 最后合作年份 ASC
    """,
    tuple(params),
)

if not zombie_df.empty:
    zombie_df["沉默年数"] = current_year - zombie_df["最后合作年份"]
    zombie_df["状态标签"] = zombie_df["沉默年数"].apply(
        lambda x: "僵尸合作" if x >= 3 else ("预警合作" if x >= 1 else "活跃合作")
    )

total = len(zombie_df)
zombies = len(zombie_df[zombie_df["沉默年数"] >= 3]) if total else 0
st.metric("僵尸合作机构", f"{zombies} 个", f"占全部合作机构 {zombies / total * 100:.1f}%" if total else "暂无数据")

status_counts = zombie_df["状态标签"].value_counts() if total else {}
cols = st.columns(3)
for idx, status in enumerate(["活跃合作", "预警合作", "僵尸合作"]):
    cols[idx].metric(status, int(status_counts.get(status, 0)))

if filters["paid"]:
    status_filter = st.multiselect("状态筛选", ["活跃合作", "预警合作", "僵尸合作"], default=["预警合作", "僵尸合作"])
    view_df = zombie_df[zombie_df["状态标签"].isin(status_filter)].sort_values("沉默年数", ascending=False)
    st.dataframe(view_df, use_container_width=True, hide_index=True)
    download_excel(view_df, "zombie_collaborations.csv", "导出低效合作名单")
else:
    st.dataframe(zombie_df.head(10), use_container_width=True, hide_index=True)
    paywall("升级查看完整低效合作机构名单")

page_shell_end()
