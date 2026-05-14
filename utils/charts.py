import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


COLOR_SEQUENCE = ["#1a3a5c", "#f97316", "#0f766e", "#9333ea", "#64748b", "#dc2626"]


def cooperation_map(country_df: pd.DataFrame) -> go.Figure:
    fig = px.choropleth(
        country_df,
        locations="collab_country",
        color="paper_count",
        hover_name="collab_country_name",
        hover_data={"paper_count": True, "institution_count": True, "collab_country": False},
        color_continuous_scale="Blues",
    )
    fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=520)
    return fig


def lead_donut(lead_count: int, participate_count: int) -> go.Figure:
    fig = go.Figure(
        data=[
            go.Pie(
                labels=["本校主导", "本校参与"],
                values=[lead_count, participate_count],
                hole=0.62,
                marker_colors=["#1a3a5c", "#f97316"],
            )
        ]
    )
    fig.update_layout(margin=dict(l=0, r=0, t=20, b=0), height=300, showlegend=True)
    return fig


def subject_bubble(df: pd.DataFrame) -> go.Figure:
    fig = px.scatter(
        df,
        x="country_count",
        y="paper_count",
        size="avg_cited",
        color="domain",
        hover_name="topic",
        color_discrete_sequence=COLOR_SEQUENCE,
    )
    fig.update_layout(margin=dict(l=0, r=0, t=20, b=0), height=520)
    return fig


def benchmark_bar(df: pd.DataFrame, metric: str) -> go.Figure:
    fig = px.bar(
        df,
        x="university",
        y=metric,
        color="university",
        color_discrete_sequence=COLOR_SEQUENCE,
    )
    fig.update_layout(showlegend=False, margin=dict(l=0, r=0, t=20, b=0), height=360)
    return fig
