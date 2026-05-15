import streamlit as st

from utils.auth import is_paid
from utils.charts import benchmark_bar
from utils.db_sqlite import query_df
from utils.ui import data_warning, inject_style, page_nav, page_shell_end, page_shell_start, paywall


st.set_page_config(page_title="对标分析", layout="wide")
inject_style()
page_nav("对标分析")
page_shell_start()

st.title("多校对标分析")
st.caption("公开查看核心对标指标，开通后分析独家合作机构和潜在拓展目标。")

if data_warning():
    page_shell_end()
    st.stop()

benchmark = query_df(
    """
    SELECT
        w.university AS 学校,
        ROUND(100.0 * SUM(CASE WHEN w.is_international = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS 国际合作论文占比,
        COUNT(DISTINCT c.collab_country) AS 合作国家数,
        COUNT(DISTINCT c.collab_institution) AS 合作机构数,
        ROUND(100.0 * SUM(CASE WHEN w.is_lead = 1 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN w.is_international = 1 THEN 1 ELSE 0 END), 0), 1) AS 主导率,
        ROUND(AVG(CASE WHEN w.is_international = 1 THEN w.cited_by END), 1) AS 平均被引次数
    FROM works w
    LEFT JOIN collaborations c ON w.id = c.work_id
    GROUP BY w.university
    ORDER BY w.university
    """
)
st.dataframe(benchmark, use_container_width=True, hide_index=True)

metric = st.selectbox("选择指标展开对比", ["国际合作论文占比", "合作国家数", "合作机构数", "主导率", "平均被引次数"])
chart_df = benchmark.rename(columns={"学校": "university", metric: "metric"})
st.plotly_chart(benchmark_bar(chart_df, "metric"), use_container_width=True, config={"displayModeBar": False})

if is_paid():
    st.subheader("独家合作机构分析")
    selected = st.selectbox("选择本校", benchmark["学校"].tolist())
    exclusive = query_df(
        """
        SELECT
            collab_institution AS 只有本校合作的机构,
            collab_country_name AS 国家,
            COUNT(*) AS 合作论文数
        FROM collaborations
        WHERE university = ?
          AND collab_institution NOT IN (
              SELECT collab_institution FROM collaborations WHERE university != ?
          )
        GROUP BY collab_institution, collab_country_name
        ORDER BY 合作论文数 DESC
        LIMIT 50
        """,
        (selected, selected),
    )
    st.dataframe(exclusive, use_container_width=True, hide_index=True)
else:
    paywall("升级查看独家合作机构和潜在拓展目标")

page_shell_end()
