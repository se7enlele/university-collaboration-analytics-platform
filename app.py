import pandas as pd
import plotly.express as px
import streamlit as st

from utils.auth import current_user, login_box
from utils.db_sqlite import has_processed_data, query_df
from utils.payment import payment_panel
from utils.ui import inject_style


st.set_page_config(page_title="高校国际合作智析平台", page_icon="🌐", layout="wide")
inject_style()


def load_home_stats() -> tuple[bool, dict, pd.DataFrame]:
    if not has_processed_data():
        sample_stats = {
            "papers": "12.8万+",
            "countries": "96",
            "institutions": "3,800+",
            "lead_rate": "28.6%",
        }
        sample_countries = pd.DataFrame(
            {
                "国家": ["United States", "United Kingdom", "Germany", "Australia", "Singapore", "Japan"],
                "论文数": [18240, 12480, 9360, 8120, 6480, 5960],
            }
        )
        return False, sample_stats, sample_countries

    stats_row = query_df(
        """
        SELECT
            COUNT(DISTINCT w.id) AS papers,
            COUNT(DISTINCT c.collab_country) AS countries,
            COUNT(DISTINCT c.collab_institution) AS institutions,
            ROUND(100.0 * SUM(CASE WHEN w.is_lead = 1 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN w.is_international = 1 THEN 1 ELSE 0 END), 0), 1) AS lead_rate
        FROM works w
        LEFT JOIN collaborations c ON w.id = c.work_id
        WHERE w.is_international = 1
        """
    ).iloc[0]
    stats = {
        "papers": f"{int(stats_row['papers'] or 0):,}",
        "countries": f"{int(stats_row['countries'] or 0):,}",
        "institutions": f"{int(stats_row['institutions'] or 0):,}",
        "lead_rate": f"{float(stats_row['lead_rate'] or 0):.1f}%",
    }
    top_countries = query_df(
        """
        SELECT
            c.collab_country_name AS 国家,
            COUNT(DISTINCT w.id) AS 论文数
        FROM works w
        JOIN collaborations c ON w.id = c.work_id
        WHERE w.is_international = 1
        GROUP BY c.collab_country_name
        ORDER BY 论文数 DESC
        LIMIT 8
        """
    )
    return True, stats, top_countries


def render_hero(stats: dict) -> None:
    st.markdown(
        f"""
        <nav class="site-nav">
            <a class="site-brand" href="/" target="_self">高校国际合作智析平台</a>
            <div class="site-links">
                <a href="/全球合作地图" target="_self">合作地图</a>
                <a href="/合作机构排行" target="_self">机构排行</a>
                <a href="/学科热力图" target="_self">学科热力图</a>
                <a href="/对标分析" target="_self">对标分析</a>
                <a href="#account" class="site-cta">登录 / 开通</a>
            </div>
        </nav>
        <section class="platform-hero">
            <div class="hero-inner">
                <p class="eyebrow">University Collaboration Intelligence Platform</p>
                <h1>看清高校国际合作格局，找到真正值得投入的合作关系</h1>
                <p class="hero-copy">
                    从论文合作、机构质量、学科热度和多校对标出发，把分散的科研合作数据整理成可解释、
                    可比较、可行动的决策视图。前台先公开展示，导出、完整数据和后台管理再触发登录。
                </p>
                <div class="hero-actions">
                    <a class="hero-action" href="/全球合作地图" target="_self">查看合作地图</a>
                    <a class="hero-action secondary" href="/对标分析" target="_self">进入对标分析</a>
                </div>
                <div class="hero-kpi">
                    <div><strong>{stats["papers"]}</strong><small>国际合作论文</small></div>
                    <div><strong>{stats["countries"]}</strong><small>合作国家/地区</small></div>
                    <div><strong>{stats["institutions"]}</strong><small>合作机构</small></div>
                    <div><strong>{stats["lead_rate"]}</strong><small>本校主导率</small></div>
                </div>
            </div>
        </section>
        """,
        unsafe_allow_html=True,
    )


def render_data_section(has_data: bool, top_countries: pd.DataFrame) -> None:
    st.markdown('<section class="page-section">', unsafe_allow_html=True)
    if has_data:
        st.markdown('<div class="data-state">当前概览基于已接入的科研合作数据生成，适合用于快速判断合作覆盖、机构质量和学科方向。</div>', unsafe_allow_html=True)
    else:
        st.markdown(
            '<div class="data-state">当前展示为平台能力预览。数据接入完成后，这里会自动呈现本校真实合作概览、国家分布和机构分析。</div>',
            unsafe_allow_html=True,
        )

    left, right = st.columns([1.15, 0.85])
    with left:
        st.markdown('<h2 class="section-title">合作网络，一眼看清。</h2>', unsafe_allow_html=True)
        st.markdown('<p class="section-copy">从国家覆盖、机构分布和论文质量入手，把国际合作从列表变成可比较的结构化视图。</p>', unsafe_allow_html=True)
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        fig = px.bar(
            top_countries,
            x="论文数",
            y="国家",
            orientation="h",
            color="论文数",
            color_continuous_scale=["#dbeafe", "#006edb"],
            height=360,
        )
        fig.update_layout(
            margin=dict(l=8, r=8, t=8, b=8),
            yaxis=dict(autorange="reversed", title=None),
            xaxis=dict(title=None),
            showlegend=False,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            coloraxis_showscale=False,
            font=dict(color="#374151"),
        )
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)
    with right:
        st.markdown(
            """
            <div class="workflow-card">
                <h3>推荐工作流</h3>
                <ol>
                    <li>先确认国家和机构覆盖。</li>
                    <li>再判断合作质量和主导程度。</li>
                    <li>识别沉默合作，减少无效投入。</li>
                    <li>进入多校对标，形成汇报依据。</li>
                </ol>
            </div>
            """,
            unsafe_allow_html=True,
        )
    st.markdown("</section>", unsafe_allow_html=True)


def render_modules() -> None:
    st.markdown('<section class="page-section">', unsafe_allow_html=True)
    st.markdown('<h2 class="section-title">从公开浏览到深度决策。</h2>', unsafe_allow_html=True)
    st.markdown('<p class="section-copy">前台页面先展示价值，完整名单、导出和后台审核在关键节点触发登录。</p>', unsafe_allow_html=True)
    modules = [
        ("全球合作地图", "国家、机构覆盖和论文列表预览", "/全球合作地图", "公开浏览"),
        ("合作机构排行", "识别核心伙伴、低主导合作和沉默伙伴", "/合作机构排行", "公开浏览"),
        ("低效合作识别", "定位长期低产出或沉默关系", "/僵尸合作识别", "核心分析"),
        ("学科热力图", "查看学科领域和细分主题热度", "/学科热力图", "公开浏览"),
        ("对标分析", "跨校比较国际合作指标", "/对标分析", "核心分析"),
        ("管理后台", "付费审核、用户状态和运营管理", "/admin管理后台", "管理员"),
    ]
    cards = []
    for title, desc, href, tag in modules:
        cards.append(
            f"""
            <div class="feature-card">
                <span>{tag}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
                <p><a href="{href}" target="_self">进入页面</a></p>
            </div>
            """
        )
    st.markdown(f'<div class="module-grid">{"".join(cards)}</div>', unsafe_allow_html=True)
    st.markdown("</section>", unsafe_allow_html=True)


def render_account_section() -> None:
    st.markdown('<section class="page-section" id="account">', unsafe_allow_html=True)
    st.markdown('<h2 class="section-title">账号只在需要时出现。</h2>', unsafe_allow_html=True)
    st.markdown('<p class="section-copy">首页、地图和公开分析先直接查看；导出、完整数据和后台管理再登录。</p>', unsafe_allow_html=True)
    _, center, _ = st.columns([1, 1.45, 1])
    with center:
        st.markdown('<div class="account-panel">', unsafe_allow_html=True)
        user = current_user()
        if user:
            st.success(f"已登录：{user['phone']}")
            st.write("账号状态：", "已开通" if user.get("is_paid") else "免费版")
            if st.button("退出登录", use_container_width=True):
                st.session_state.pop("user", None)
                st.rerun()
        else:
            login_box()

        payment_panel()
        st.markdown("</div>", unsafe_allow_html=True)
    st.markdown("</section>", unsafe_allow_html=True)


has_data, stats, top_countries = load_home_stats()
render_hero(stats)
render_data_section(has_data, top_countries)
render_modules()
render_account_section()
