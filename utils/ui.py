from datetime import datetime

import pandas as pd
import streamlit as st

from data.fetch_openalex import UNIVERSITIES
from utils.auth import is_paid
from utils.db_sqlite import has_processed_data, query_df


def inject_style() -> None:
    st.markdown(
        """
        <style>
        .stApp { background: #ffffff; }
        div[data-testid="stMetric"] {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
        }
        .paywall {
            background: rgba(248,250,252,0.92);
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            padding: 32px;
            text-align: center;
            color: #1a3a5c;
            margin: 12px 0;
        }
        .paywall strong { font-size: 20px; display: block; margin-bottom: 8px; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def paywall(label: str = "升级解锁完整数据") -> None:
    st.markdown(
        f"""
        <div class="paywall">
            <strong>🔒 {label}</strong>
            <div>19.9元/年 · 低于一杯奶茶</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def data_warning() -> bool:
    if has_processed_data():
        return False
    st.warning("尚未检测到 processed 数据。请先运行 `python data/fetch_openalex.py` 和 `python data/process_data.py`。")
    return True


def sidebar_filters() -> dict:
    st.sidebar.header("筛选器")
    university = st.sidebar.selectbox("选择学校", list(UNIVERSITIES.keys()))
    current_year = datetime.now().year
    year_range = st.sidebar.slider("年份范围", 2014, current_year, (current_year - 5, current_year))

    domains = []
    if has_processed_data():
        domains_df = query_df(
            "SELECT DISTINCT domain FROM works WHERE university = ? AND domain != '' ORDER BY domain",
            (university,),
        )
        domains = domains_df["domain"].tolist()

    selected_domains = st.sidebar.multiselect("研究领域", domains, default=domains[:5])
    paper_types = st.sidebar.multiselect(
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
