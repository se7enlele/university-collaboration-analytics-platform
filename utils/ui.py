from datetime import datetime

import pandas as pd
import streamlit as st

from data.fetch_openalex import UNIVERSITIES
from utils.auth import is_paid
from utils.db_sqlite import has_processed_data, query_df


def page_nav(active: str = "") -> None:
    links = [
        ("首页", "/"),
        ("合作地图", "/全球合作地图"),
        ("机构排行", "/合作机构排行"),
        ("低效合作", "/僵尸合作识别"),
        ("学科热力图", "/学科热力图"),
        ("对标分析", "/对标分析"),
    ]
    items = []
    for label, href in links:
        class_name = "active" if label == active else ""
        items.append(f'<a class="{class_name}" href="{href}" target="_self">{label}</a>')

    st.markdown(
        f"""
        <nav class="site-nav">
            <a class="site-brand" href="/" target="_self">高校国际合作智析平台</a>
            <div class="site-links">{"".join(items)}</div>
        </nav>
        """,
        unsafe_allow_html=True,
    )


def page_shell_start() -> None:
    st.markdown('<main class="page-section page-shell">', unsafe_allow_html=True)


def page_shell_end() -> None:
    st.markdown("</main>", unsafe_allow_html=True)


def inject_style() -> None:
    st.markdown(
        """
        <style>
        [data-testid="stSidebarNav"],
        [data-testid="stSidebar"],
        [data-testid="stToolbar"],
        #MainMenu,
        footer {
            display: none;
        }
        .stApp {
            background: #f5f5f7;
            color: #111827;
        }
        .block-container,
        .main .block-container {
            max-width: 1180px !important;
            padding: 1.5rem 1.5rem 4rem !important;
        }
        .site-nav {
            position: sticky;
            top: 0;
            z-index: 50;
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-sizing: border-box;
            width: 100%;
            border-radius: 18px;
            padding: 0 clamp(18px, 4vw, 44px);
            background: rgba(255,255,255,0.86);
            backdrop-filter: blur(18px);
            border-bottom: 1px solid rgba(226,232,240,0.72);
        }
        .site-brand,
        .site-links a {
            text-decoration: none;
            white-space: nowrap;
        }
        .site-brand {
            color: #111827;
            font-size: 15px;
            font-weight: 700;
        }
        .site-links {
            display: flex;
            align-items: center;
            gap: clamp(12px, 2vw, 24px);
            min-width: 0;
        }
        .site-links a {
            color: #374151;
            font-size: 13px;
        }
        .site-links a.active {
            color: #0066cc;
            font-weight: 700;
        }
        .site-cta {
            color: #ffffff !important;
            background: #111827;
            border-radius: 999px;
            padding: 7px 14px;
        }
        .platform-hero {
            display: grid;
            place-items: center;
            text-align: center;
            min-height: auto;
            padding: clamp(64px, 9vh, 96px) 24px clamp(42px, 7vh, 70px);
            margin-top: 18px;
            border-radius: 28px;
            background: #f5f5f7;
            color: #111827;
        }
        .hero-inner {
            width: min(1120px, calc(100vw - 48px));
            margin: 0 auto;
        }
        .platform-hero h1 {
            max-width: 1040px;
            margin: 0 auto;
            font-size: clamp(44px, 5vw, 76px);
            line-height: 1.06;
            font-weight: 800;
            letter-spacing: 0;
        }
        .eyebrow {
            margin: 0 0 12px;
            color: #0066cc;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .hero-copy {
            max-width: 760px;
            margin: 24px auto 0;
            color: #374151;
            font-size: clamp(18px, 1.55vw, 24px);
            line-height: 1.55;
        }
        .hero-actions {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 12px;
            margin-top: 30px;
        }
        .hero-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 136px;
            min-height: 44px;
            padding: 0 22px;
            border: 1px solid #006edb;
            border-radius: 999px;
            background: #006edb;
            color: #ffffff !important;
            font-weight: 700;
            text-decoration: none !important;
            box-shadow: 0 10px 24px rgba(0,113,227,0.18);
        }
        .hero-action.secondary {
            background: transparent;
            color: #0066cc !important;
            box-shadow: none;
        }
        .hero-kpi {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 1px;
            width: min(900px, 100%);
            margin: clamp(34px, 6vh, 56px) auto 0;
            overflow: hidden;
            border-radius: 18px;
            background: #d1d5db;
        }
        .hero-kpi div {
            background: #ffffff;
            padding: 24px 18px;
        }
        .hero-kpi strong {
            display: block;
            margin: 0;
            color: #111827;
            font-size: 30px;
            line-height: 1.2;
        }
        .hero-kpi small {
            color: #6b7280;
        }
        .page-section {
            box-sizing: border-box;
            width: 100%;
            margin: 0 auto;
            padding: clamp(38px, 6vw, 64px) 0;
        }
        .page-shell {
            padding-top: 38px;
        }
        .section-title {
            margin: 0 0 28px;
            color: #111827;
            font-size: clamp(34px, 4vw, 44px);
            line-height: 1.1;
            font-weight: 800;
            letter-spacing: 0;
        }
        .section-copy {
            max-width: 760px;
            color: #4b5563;
            font-size: clamp(17px, 1.5vw, 20px);
            line-height: 1.55;
        }
        .module-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
        }
        .feature-card {
            min-height: 240px;
            box-sizing: border-box;
            background: #ffffff;
            border-radius: 22px;
            padding: 28px;
            box-shadow: 0 18px 60px rgba(15,23,42,0.08);
        }
        .feature-card span {
            display: inline-flex;
            color: #0f766e;
            background: #ccfbf1;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 700;
        }
        .feature-card h3 {
            margin: 18px 0 10px;
            font-size: 25px;
            line-height: 1.15;
        }
        .feature-card p {
            margin: 0;
            color: #526173;
            line-height: 1.6;
        }
        .feature-card a {
            display: inline-block;
            margin-top: 18px;
            color: #0066cc;
            font-weight: 700;
            text-decoration: none;
        }
        .data-state,
        .workflow-card,
        .chart-card,
        .account-panel {
            background: #ffffff;
            box-shadow: 0 18px 60px rgba(15,23,42,0.08);
        }
        .data-state {
            color: #374151;
            padding: 18px 22px;
            border-radius: 14px;
            margin: 0 0 30px;
            font-size: 16px;
            line-height: 1.7;
        }
        .workflow-card {
            border-radius: 22px;
            padding: 28px;
        }
        .workflow-card ol {
            margin: 0;
            padding-left: 1.3rem;
            color: #374151;
            line-height: 2;
        }
        .chart-card {
            border-radius: 22px;
            padding: 18px;
        }
        .account-panel {
            max-width: 620px;
            margin: 0 auto;
            border-radius: 22px;
            padding: 28px;
        }
        .account-panel [data-testid="stTextInput"] input {
            min-height: 44px;
            border-radius: 12px;
        }
        .account-panel [data-testid="stButton"] button {
            min-height: 44px;
            border-radius: 999px;
        }
        .account-panel [data-testid="stButton"] button[kind="primary"] {
            background: #006edb;
            border-color: #006edb;
        }
        div[data-testid="stMetric"] {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 14px;
            box-shadow: 0 12px 34px rgba(15,23,42,0.06);
        }
        div[data-testid="stDataFrame"],
        div[data-testid="stPlotlyChart"] {
            background: #ffffff;
            border-radius: 18px;
            padding: 12px;
            box-shadow: 0 14px 40px rgba(15,23,42,0.07);
        }
        .paywall {
            background: #ffffff;
            border: 1px dashed #cbd5e1;
            border-radius: 14px;
            padding: 28px;
            text-align: center;
            color: #1f2937;
            margin: 16px 0;
        }
        .paywall strong {
            display: block;
            margin-bottom: 8px;
            font-size: 20px;
        }
        @media (max-width: 900px) {
            .site-links a:not(.site-cta) {
                display: none;
            }
            .hero-kpi {
                grid-template-columns: 1fr 1fr;
            }
            .module-grid {
                grid-template-columns: 1fr;
            }
        }
        @media (max-width: 560px) {
            .block-container,
            .main .block-container {
                padding-left: 14px !important;
                padding-right: 14px !important;
            }
            .site-brand {
                font-size: 13px;
            }
            .platform-hero {
                min-height: auto;
                padding-top: 54px;
            }
            .hero-inner,
            .page-section {
                width: min(100% - 28px, 1160px);
            }
            .hero-actions {
                flex-direction: column;
                align-items: stretch;
            }
            .hero-kpi {
                grid-template-columns: 1fr;
            }
            .feature-card,
            .account-panel,
            .workflow-card {
                padding: 22px;
            }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def paywall(label: str = "升级解锁完整数据") -> None:
    st.markdown(
        f"""
        <div class="paywall">
            <strong>🔒 {label}</strong>
            <div>开通后可查看完整数据、导出结果并使用高级分析。</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def data_warning() -> bool:
    if has_processed_data():
        return False
    st.info("当前数据正在准备中。完整合作地图、机构排行和对标分析将在数据接入后开放。")
    return True


def sidebar_filters() -> dict:
    with st.expander("筛选器", expanded=True):
        top_cols = st.columns([1, 1])
        university = top_cols[0].selectbox("选择学校", list(UNIVERSITIES.keys()))
        current_year = datetime.now().year
        year_range = top_cols[1].slider("年份范围", 2014, current_year, (current_year - 5, current_year))

        domains = []
        if has_processed_data():
            domains_df = query_df(
                "SELECT DISTINCT domain FROM works WHERE university = ? AND domain != '' ORDER BY domain",
                (university,),
            )
            domains = domains_df["domain"].tolist()

        bottom_cols = st.columns([1, 1])
        selected_domains = bottom_cols[0].multiselect("研究领域", domains, default=domains[:5])
        paper_types = bottom_cols[1].multiselect(
            "论文类型",
            ["article", "review", "book-chapter", "conference-paper", "preprint"],
            default=["article", "review", "conference-paper"],
        )

    return {
        "university": university,
        "start_year": year_range[0],
        "end_year": year_range[1],
        "domains": selected_domains,
        "paper_types": paper_types,
        "paid": is_paid(),
    }


def filter_clause(filters: dict, alias: str = "w") -> tuple[str, list]:
    clauses = [f"{alias}.university = ?", f"{alias}.year BETWEEN ? AND ?"]
    params: list = [filters["university"], filters["start_year"], filters["end_year"]]
    if filters["domains"]:
        placeholders = ",".join("?" for _ in filters["domains"])
        clauses.append(f"{alias}.domain IN ({placeholders})")
        params.extend(filters["domains"])
    if filters["paper_types"]:
        placeholders = ",".join("?" for _ in filters["paper_types"])
        clauses.append(f"{alias}.type IN ({placeholders})")
        params.extend(filters["paper_types"])
    return " AND ".join(clauses), params


def download_excel(df: pd.DataFrame, filename: str, label: str) -> None:
    if not is_paid():
        paywall("升级后可导出 Excel")
        return
    st.download_button(
        label,
        data=df.to_csv(index=False).encode("utf-8-sig"),
        file_name=filename,
        mime="text/csv",
    )
