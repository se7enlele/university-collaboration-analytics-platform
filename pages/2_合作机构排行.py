import pandas as pd
import streamlit as st

from utils.charts import lead_donut
from utils.db_sqlite import query_df
from utils.ui import data_warning, filter_clause, inject_style, page_nav, page_shell_end, page_shell_start, paywall, sidebar_filters


st.set_page_config(page_title="合作机构排行", layout="wide")
inject_style()
page_nav("机构排行")
page_shell_start()

st.title("合作机构质量排行")
st.caption("公开展示 Top 10 合作机构，开通后查看 Top 100、质量标签和更多机构详情。")

if data_warning():
    page_shell_end()
    st.stop()

filters = sidebar_filters()
where_sql, params = filter_clause(filters)

lead_summary = query_df(
    f"""
    SELECT
        SUM(CASE WHEN is_lead = 1 THEN 1 ELSE 0 END) AS lead_count,
        SUM(CASE WHEN is_lead = 0 THEN 1 ELSE 0 END) AS participate_count
    FROM works w
    WHERE {where_sql} AND is_international = 1
    """,
    tuple(params),
).iloc[0]
st.plotly_chart(
    lead_donut(int(lead_summary["lead_count"] or 0), int(lead_summary["participate_count"] or 0)),
    use_container_width=True,
    config={"displayModeBar": False},
)

avg_cited = query_df("SELECT AVG(cited_by) AS avg_cited FROM works WHERE is_international = 1").iloc[0]["avg_cited"] or 0
rank_df = query_df(
    f"""
    SELECT
        c.collab_institution AS 机构名称,
        c.collab_country_name AS 所属国家,
        COUNT(DISTINCT w.id) AS 合著论文数,
        SUM(CASE WHEN w.is_lead = 1 THEN 1 ELSE 0 END) AS 主导论文数,
        ROUND(100.0 * SUM(CASE WHEN w.is_lead = 1 THEN 1 ELSE 0 END) / COUNT(DISTINCT w.id), 1) AS 主导率,
        ROUND(AVG(w.cited_by), 1) AS 平均被引数,
        MAX(w.year) AS 最后合作年份
    FROM works w
    JOIN collaborations c ON w.id = c.work_id
    WHERE {where_sql} AND w.is_international = 1
    GROUP BY c.collab_institution, c.collab_country_name
    ORDER BY 合著论文数 DESC
    LIMIT 100
    """,
    tuple(params),
)


def label(row: pd.Series) -> str:
    if row["主导率"] > 30 and row["平均被引数"] > avg_cited:
        return "核心伙伴"
    if row["主导率"] < 10 and row["合著论文数"] > 10:
        return "低主导合作"
    if row["最后合作年份"] and row["最后合作年份"] <= 2023:
        return "沉默伙伴"
    return "稳定合作"


if not rank_df.empty:
    rank_df.insert(0, "排名", range(1, len(rank_df) + 1))
    rank_df["质量标签"] = rank_df.apply(label, axis=1)

display_df = rank_df if filters["paid"] else rank_df.head(10)
st.dataframe(display_df, use_container_width=True, hide_index=True)
if not filters["paid"] and len(rank_df) > 10:
    paywall("升级查看 Top 100、质量标签和机构详情")

page_shell_end()
