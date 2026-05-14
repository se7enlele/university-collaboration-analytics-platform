import streamlit as st

from utils.auth import require_login
from utils.charts import cooperation_map
from utils.db_sqlite import query_df
from utils.ui import data_warning, download_excel, filter_clause, inject_style, paywall, sidebar_filters


st.set_page_config(page_title="全球合作地图", layout="wide")
inject_style()
st.title("全球合作地图")

if not require_login() or data_warning():
    st.stop()

filters = sidebar_filters()
where_sql, params = filter_clause(filters)

metrics = query_df(
    f"""
    SELECT
        COUNT(DISTINCT w.id) AS total_papers,
        COUNT(DISTINCT c.collab_country) AS country_count,
        COUNT(DISTINCT c.collab_institution) AS institution_count,
        SUM(CASE WHEN w.year >= strftime('%Y','now') - 5 THEN 1 ELSE 0 END) AS recent_count,
        SUM(CASE WHEN w.year < strftime('%Y','now') - 5 THEN 1 ELSE 0 END) AS earlier_count
    FROM works w
    LEFT JOIN collaborations c ON w.id = c.work_id
    WHERE {where_sql} AND w.is_international = 1
    """,
    tuple(params),
).iloc[0]

growth = 0
if metrics["earlier_count"]:
    growth = (metrics["recent_count"] - metrics["earlier_count"]) / metrics["earlier_count"] * 100

cols = st.columns(4)
cols[0].metric("国际合作论文总数", int(metrics["total_papers"] or 0))
cols[1].metric("合作国家数", int(metrics["country_count"] or 0))
cols[2].metric("合作机构数", int(metrics["institution_count"] or 0))
cols[3].metric("近5年增长率", f"{growth:.1f}%")

country_df = query_df(
    f"""
    SELECT
        c.collab_country,
        c.collab_country_name,
        COUNT(DISTINCT w.id) AS paper_count,
        COUNT(DISTINCT c.collab_institution) AS institution_count
    FROM works w
    JOIN collaborations c ON w.id = c.work_id
    WHERE {where_sql} AND w.is_international = 1
    GROUP BY c.collab_country, c.collab_country_name
    """,
    tuple(params),
)
st.plotly_chart(cooperation_map(country_df), use_container_width=True)

st.subheader("合作论文列表")
limit = "" if filters["paid"] else "LIMIT 20"
paper_df = query_df(
    f"""
    SELECT w.title, w.year, GROUP_CONCAT(DISTINCT c.collab_institution) AS collab_institutions, w.cited_by
    FROM works w
    JOIN collaborations c ON w.id = c.work_id
    WHERE {where_sql} AND w.is_international = 1
    GROUP BY w.id
    ORDER BY w.year DESC, w.cited_by DESC
    {limit}
    """,
    tuple(params),
)
st.dataframe(paper_df, use_container_width=True, hide_index=True)
if not filters["paid"]:
    paywall("升级查看全部论文和机构下钻")
download_excel(paper_df, "global_collaborations.csv", "导出当前列表")
