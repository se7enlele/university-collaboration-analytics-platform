import pandas as pd
import pycountry
import plotly.express as px
import plotly.graph_objects as go


COLOR_SEQUENCE = ["#006edb", "#0f766e", "#f97316", "#7c3aed", "#64748b", "#dc2626"]


def iso2_to_iso3(code: str) -> str:
    if not code:
        return ""
    country = pycountry.countries.get(alpha_2=code)
    return country.alpha_3 if country else code


def cooperation_map(country_df: pd.DataFrame) -> go.Figure:
    view_df = country_df[country_df["collab_country"].fillna("") != ""].copy()
    view_df["iso3"] = view_df["collab_country"].apply(iso2_to_iso3)
    fig = px.choropleth(
        view_df,
        locations="iso3",
        locationmode="ISO-3",
        color="paper_count",
        hover_name="collab_country_name",
        hover_data={"paper_count": True, "institution_count": True, "collab_country": False},
        color_continuous_scale=["#dbeafe", "#60a5fa", "#005bb8"],
    )
    fig.update_geos(
        projection_type="natural earth",
        showcountries=True,
        countrycolor="#d1d5db",
        showcoastlines=False,
        showframe=False,
        bgcolor="rgba(0,0,0,0)",
    )
    fig.update_layout(
        margin=dict(l=0, r=0, t=0, b=0),
        height=520,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        coloraxis_colorbar=dict(title="论文数"),
    )
    return fig


def lead_donut(lead_count: int, participate_count: int) -> go.Figure:
    fig = go.Figure(
        data=[
            go.Pie(
                labels=["本校主导", "本校参与"],
                values=[lead_count, participate_count],
                hole=0.62,
                marker_colors=["#006edb", "#0f766e"],
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
