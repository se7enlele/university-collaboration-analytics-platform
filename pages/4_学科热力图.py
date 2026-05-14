import streamlit as st

from utils.auth import require_login
from utils.charts import subject_bubble
from utils.db_sqlite import query_df
from utils.ui import data_warning, filter_clause, inject_style, paywall, sidebar_filters


st.set_page_config(page_title="学科热力图", layout="wide")
inject_style()
st.title("学科合作热力图")

if not require_login() or data_warning():
    st.stop()

filters = sidebar_filters()
where_sql, params = filter_clause(filters)
subject_field = "w.topic" if filters["paid"] else "w.domain"

df = query_df(
    f"""
    SELECT
        {subject_field} AS topic,
        w.domain,
        COUNT(DISTINCT w.id) AS paper_count,
        COUNT(DISTINCT c.collab_country) AS country_count,
        ROUND(AVG(w.cited_by), 1) AS avg_cited
    FROM works w
    JOIN collaborations c ON w.id = c.work_id
    WHERE {where_sql} AND w.is_international = 1 AND {subject_field} != ''
    GROUP BY {subject_field}, w.domain
    ORDER BY paper_count DESC
    LIMIT 80
    """,
    tuple(params),
)

st.plotly_chart(subject_bubble(df), use_container_width=True)
st.dataframe(df, use_container_width=True, hide_index=True)
if not filters["paid"]:
    paywall("升级下钻到细分学科和机构穿透")
