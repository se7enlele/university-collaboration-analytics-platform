const app = document.querySelector("#app");
const nf = new Intl.NumberFormat("zh-CN");
let universitiesCache = null;
let selectedUniversity = localStorage.getItem("selectedUniversity") || "山东大学";
let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
let authToken = localStorage.getItem("authToken") || "";
const fallbackUniversities = [
  { university: "山东大学" },
  { university: "中山大学" },
  { university: "武汉大学" },
  { university: "四川大学" },
];

async function api(path) {
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const response = await fetch(path, { headers });
  if (!response.ok) throw new Error(`API failed: ${path}`);
  return response.json();
}

async function postApi(path, payload = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `API failed: ${path}`);
  return data;
}

async function adminApi(path, options = {}) {
  const adminToken = localStorage.getItem("adminToken") || "";
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": adminToken,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `API failed: ${path}`);
  return data;
}

function fmt(value) {
  return nf.format(Number(value || 0));
}

function itemsOf(payload) {
  return Array.isArray(payload) ? payload : payload?.items || [];
}

function accessOf(payload) {
  if (!payload || Array.isArray(payload)) return { access: currentUser ? "login" : "public", locked: true, message: "" };
  return {
    access: payload.access || (currentUser ? "login" : "public"),
    locked: Boolean(payload.locked),
    message: payload.message || "",
  };
}

function accessBanner(payload) {
  const access = accessOf(payload);
  if (!access.locked) return "";
  const title = access.access === "public" ? "当前为公开预览" : "当前为登录试用视图";
  return `
    <div class="card access-banner">
      <div>
        <span class="tag">权限提示</span>
        <strong>${title}</strong>
        <p>${access.message || "开通机构工作台后可查看完整明细、导出清单和生成报告。"}</p>
      </div>
      <a class="button" href="/pricing">查看开通权益</a>
    </div>
  `;
}

function withUniversity(path) {
  if (!currentUser) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}university=${encodeURIComponent(selectedUniversity)}`;
}

function pageOptions(universities) {
  return currentUser ? { universities } : {};
}

function saveUser(user, token = authToken) {
  currentUser = user;
  localStorage.setItem("currentUser", JSON.stringify(user));
  if (token) {
    authToken = token;
    localStorage.setItem("authToken", token);
  }
}

function clearUser() {
  currentUser = null;
  authToken = "";
  localStorage.removeItem("currentUser");
  localStorage.removeItem("authToken");
}

function updateAuthNav() {
  const slot = document.querySelector("#authNav");
  if (!slot) return;
  slot.innerHTML = currentUser
    ? `<a class="pill logged" href="/login">${currentUser.name || currentUser.phone} · 已登录</a>`
    : `<a class="pill" href="/login">登录 / 开通</a>`;
}

function big(value) {
  const number = Number(value || 0);
  if (number >= 100000000) return `${(number / 100000000).toFixed(number % 100000000 === 0 ? 0 : 1)}亿+`;
  if (number >= 10000) return `${(number / 10000).toFixed(number % 10000 === 0 ? 0 : 1)}万+`;
  return fmt(number);
}

function highlightMetrics(text) {
  return String(text).replace(/(\d[\d,]*(?:\.\d+)?%?|\d+(?:\.\d+)?\s*个|\d+(?:\.\d+)?\s*篇)/g, '<mark class="metric-highlight">$1</mark>');
}

function sparkline(seed = 1, tone = "blue") {
  const patterns = [
    "6,30 28,24 50,27 72,15 94,18",
    "6,26 28,20 50,22 72,13 94,9",
    "6,18 28,24 50,16 72,22 94,14",
    "6,25 28,27 50,23 72,28 94,26",
  ];
  const path = patterns[Math.abs(Number(seed) || 0) % patterns.length];
  return `
    <svg class="sparkline ${tone}" viewBox="0 0 100 36" aria-hidden="true">
      <polyline points="${path}" />
    </svg>
  `;
}

function kpiCard(value, label, seed = 1, tone = "blue") {
  return `<div class="kpi"><div><strong>${value}</strong><span>${label}</span></div>${sparkline(seed, tone)}</div>`;
}

function initPageEffects() {
  const revealTargets = document.querySelectorAll(".section, .card, .kpis, .decision-panel");
  revealTargets.forEach((item) => item.classList.add("reveal"));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealTargets.forEach((item) => observer.observe(item));
  } else {
    revealTargets.forEach((item) => item.classList.add("is-visible"));
  }
  bindHomeRail();
}

function bindHomeRail() {
  const rail = document.querySelector(".home-rail");
  if (!rail || !("IntersectionObserver" in window)) return;
  const links = [...rail.querySelectorAll("a")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
    },
    { rootMargin: "-35% 0px -45% 0px", threshold: [0.1, 0.4, 0.7] }
  );
  sections.forEach((section) => observer.observe(section));
}

function shell(title, copy, content, options = {}) {
  app.innerHTML = `
    <section class="section">
      <div class="page-head">
        <div>
          <h1 class="section-title">${title}</h1>
          <p class="section-copy">${copy}</p>
        </div>
        ${options.universities ? schoolSelector(options.universities) : ""}
      </div>
      ${content}
    </section>
  `;
  updateAuthNav();
  initPageEffects();
}

function table(rows, columns) {
  if (!rows.length && !currentUser) return `<div class="card status">公开页展示平台级判断；登录后可查看学校级明细和样例数据。</div>`;
  if (!rows.length) return `<div class="card status">数据接入中，完成后将展示分析结果。</div>`;
  return `
    <table class="table">
      <thead><tr>${columns.map((col) => `<th>${col.label}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${columns.map((col) => `<td>${col.format ? col.format(row[col.key]) : row[col.key] ?? ""}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;
}

function platformKpis(overview) {
  return `
    <div class="kpis">
      ${kpiCard(big(overview.papers), "全球科研成果", 1)}
      ${kpiCard(big(overview.international_papers), "国际合作论文", 2)}
      ${kpiCard(fmt(overview.universities), "国内高校与机构", 3, "green")}
      ${kpiCard(big(overview.institutions), "全球合作机构", 4)}
    </div>
  `;
}

function sampleKpis(overview) {
  if (!overview.ready && !currentUser) {
    return platformKpis(overview);
  }
  return `
    <div class="kpis">
      ${kpiCard(fmt(overview.sample_international_papers || 0), "样例合作论文", 1)}
      ${kpiCard(fmt(overview.sample_countries || 0), "合作国家/地区", 2, "green")}
      ${kpiCard(fmt(overview.sample_institutions || 0), "合作机构", 3)}
      ${kpiCard(`${overview.lead_rate || 0}%`, "主导率", 4, "green")}
    </div>
  `;
}

function moduleCard(title, copy, href) {
  return `
    <a class="card module-card" href="${href}">
      <span class="tag">核心能力</span>
      <h3>${title}</h3>
      <p>${copy}</p>
    </a>
  `;
}

async function loadUniversities() {
  if (!universitiesCache) {
    try {
      universitiesCache = await api("/api/universities");
    } catch (_) {
      universitiesCache = fallbackUniversities;
    }
  }
  if (!universitiesCache.some((item) => item.university === selectedUniversity) && universitiesCache[0]) {
    selectedUniversity = universitiesCache[0].university;
    localStorage.setItem("selectedUniversity", selectedUniversity);
  }
  return universitiesCache;
}

function schoolSelector(universities) {
  return `
    <div class="school-selector">
      <div>
        <span>分析对象</span>
        <strong>${selectedUniversity}</strong>
      </div>
      <select id="schoolSelect" aria-label="选择学校">
        ${universities.map((item) => `<option value="${item.university}" ${item.university === selectedUniversity ? "selected" : ""}>${item.university}</option>`).join("")}
      </select>
    </div>
  `;
}

function bindSchoolSelector() {
  const select = document.querySelector("#schoolSelect");
  if (!select) return;
  select.addEventListener("change", () => {
    selectedUniversity = select.value;
    localStorage.setItem("selectedUniversity", selectedUniversity);
    const queryPage = new URLSearchParams(location.search).get("page");
    const routeKey = queryPage ? `/${queryPage}` : location.pathname;
    (routes[routeKey] || renderHome)();
  });
}

function scenarioCard(title, copy, action, href) {
  return `
    <a class="card scenario-card" href="${href}">
      <strong>${title}</strong>
      <span>${copy}</span>
      <em>${action}</em>
    </a>
  `;
}

function unlockCard(title, items) {
  if (currentUser?.status === "active" || currentUser?.plan === "institution") {
    return `
      <div class="card access-banner unlocked">
        <div>
          <span class="tag">已开通</span>
          <strong>机构工作台权限已生效</strong>
          <p>当前账号可以继续查看完整明细、导出清单和使用后台审核后的机构权限。</p>
        </div>
        <a class="button secondary" href="/?page=dashboard">进入绩效驾驶舱</a>
      </div>
    `;
  }
  return `
    <div class="card unlock-card">
      <div>
        <span class="tag">登录解锁</span>
        <h3>${title}</h3>
        <p>公开页面先展示判断轮廓；登录后可继续查看完整明细、导出结果和生成汇报材料。</p>
      </div>
      <ul>
        ${items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
      <a class="button" href="/pricing">查看开通权益</a>
    </div>
  `;
}

function priceCard(name, price, target, features, highlighted = false) {
  return `
    <div class="card price-card ${highlighted ? "featured" : ""}">
      <span class="tag">${target}</span>
      <h3>${name}</h3>
      <strong class="price">${price}</strong>
      <ul>
        ${features.map((item) => `<li>${item}</li>`).join("")}
      </ul>
      <a class="button ${highlighted ? "" : "secondary"}" href="/login">申请开通</a>
    </div>
  `;
}

function decisionPanel(title, question, judgment, actions) {
  return `
    <div class="decision-panel">
      <div class="decision-main">
        <span class="tag">本页解决的问题</span>
        <h2>${title}</h2>
      </div>
      <div class="decision-judgment">
        <strong>关键判断</strong>
        <p>${highlightMetrics(judgment)}</p>
      </div>
      <div class="decision-actions">
        <strong>下一步</strong>
        <ol>
          ${actions.slice(0, 2).map((item) => `<li>${item}</li>`).join("")}
        </ol>
      </div>
    </div>
  `;
}

function regionName(country) {
  const europe = new Set(["United Kingdom", "Germany", "France", "Italy", "Spain", "Sweden", "Netherlands", "Switzerland", "Russian Federation", "Portugal", "Poland", "Greece"]);
  const asia = new Set(["Japan", "Singapore", "Hong Kong", "Korea, Republic of", "India", "Malaysia", "Thailand", "Israel", "Türkiye"]);
  const northAmerica = new Set(["United States", "Canada", "Mexico"]);
  const oceania = new Set(["Australia", "New Zealand"]);
  if (europe.has(country)) return "欧洲";
  if (asia.has(country)) return "亚洲";
  if (northAmerica.has(country)) return "北美";
  if (oceania.has(country)) return "大洋洲";
  return "其他地区";
}

async function loadCollaborationAnalysis() {
  try {
    const data = await api(withUniversity("/api/collaboration"));
    if (!data.countries?.length && !currentUser) return publicCollaborationPreview();
    return data;
  } catch (_) {
    const [countries, institutions] = await Promise.all([api(withUniversity("/api/map")), api(withUniversity("/api/institutions?limit=10"))]);
    const regionMap = new Map();
    countries.forEach((item) => {
      const region = regionName(item.name || "");
      const current = regionMap.get(region) || { region, papers: 0, countries: 0, institutions: 0 };
      current.papers += item.papers || 0;
      current.countries += 1;
      current.institutions += item.institutions || 0;
      regionMap.set(region, current);
    });
    const regions = Array.from(regionMap.values()).sort((a, b) => b.papers - a.papers);
    const topCountry = countries[0] || {};
    const topRegion = regions[0] || {};
    const topInstitution = institutions[0] || {};
    return {
      countries: countries.slice(0, 20),
      regions,
      institutions,
      trend: [],
      insights: [
        { title: "合作重心清晰", text: `${topCountry.name || "重点国家"} 是当前样例库中最核心的合作国家，贡献 ${fmt(topCountry.papers)} 篇合作论文。` },
        { title: "区域集聚明显", text: `${topRegion.region || "重点区域"} 是合作最集中的区域，覆盖 ${fmt(topRegion.countries)} 个国家/地区。` },
        { title: "核心机构可优先维护", text: `${topInstitution.institution || "高频合作机构"} 是高频合作伙伴，可作为稳定合作关系维护对象。` },
        { title: "分析能力可继续下钻", text: "全量接入后，可按学校、学院、学科、国家和机构进行多维筛选与穿透分析。" },
      ],
    };
  }
}

function publicCollaborationPreview() {
  const countries = [
    { name: "United States", papers: 184200, institutions: 12800 },
    { name: "United Kingdom", papers: 96300, institutions: 6100 },
    { name: "Germany", papers: 74200, institutions: 5200 },
    { name: "Australia", papers: 68500, institutions: 4300 },
    { name: "Canada", papers: 52100, institutions: 3900 },
    { name: "Japan", papers: 43800, institutions: 3600 },
  ];
  return {
    countries,
    regions: [
      { region: "北美", papers: 236300, countries: 2, institutions: 16700 },
      { region: "欧洲", papers: 211600, countries: 18, institutions: 14800 },
      { region: "亚太", papers: 150800, countries: 12, institutions: 9200 },
    ],
    institutions: [
      { institution: "University of Oxford", country: "United Kingdom", papers: 8200 },
      { institution: "Harvard University", country: "United States", papers: 7900 },
      { institution: "Stanford University", country: "United States", papers: 7100 },
      { institution: "National University of Singapore", country: "Singapore", papers: 6200 },
    ],
    trend: [
      { year: 2021, papers: 42000 },
      { year: 2022, papers: 46800 },
      { year: 2023, papers: 51100 },
      { year: 2024, papers: 54800 },
      { year: 2025, papers: 58200 },
    ],
    insights: [
      { title: "先看全球合作重心", text: "公开预览展示平台级合作格局，帮助判断主要国家、区域和机构网络的分布。" },
      { title: "登录后进入学校视角", text: "登录后可以选择学校，查看本校合作国家、机构、学科和趋势。" },
      { title: "开通后解锁完整明细", text: "机构账号可查看完整机构清单、论文样本、沉默关系和对标报告。" },
      { title: "用于汇报和行动", text: "最终目标不是看图，而是形成出访、续约、联合项目和资源投向建议。" },
    ],
  };
}

function institutionTier(item, maxPapers) {
  const papers = item.papers || 0;
  const leadRate = Number(item.lead_rate || 0);
  const silentYears = Number(item.silent_years || 0);
  const avgCited = Number(item.avg_cited || 0);
  if (silentYears >= 3) return "沉默伙伴";
  if (papers >= maxPapers * 0.35 && leadRate >= 50) return "核心伙伴";
  if (papers >= maxPapers * 0.25 && leadRate < 10) return "灌水风险";
  if (avgCited >= 80 && leadRate >= 20) return "高潜力伙伴";
  if (silentYears >= 1) return "需要跟进";
  return "常规维护";
}

function buildInstitutionAnalysis(rows) {
  const list = rows || [];
  const maxPapers = Math.max(...list.map((item) => item.papers || 0), 1);
  const countries = new Set(list.map((item) => item.country).filter(Boolean));
  const avgCited = list.length ? list.reduce((sum, item) => sum + Number(item.avg_cited || 0), 0) / list.length : 0;
  const active = list.filter((item) => (item.last_year || 0) >= 2024).length;
  const lowLead = list.filter((item) => Number(item.lead_rate || 0) < 10).length;
  const dormant = list.filter((item) => Number(item.silent_years || 0) >= 3).length;
  const tiered = list.map((item) => ({ ...item, tier: institutionTier(item, maxPapers) }));
  const tierCounts = tiered.reduce((acc, item) => {
    acc[item.tier] = (acc[item.tier] || 0) + 1;
    return acc;
  }, {});
  const countryCounts = list.reduce((acc, item) => {
    const country = item.country || "未标注";
    const current = acc.get(country) || { country, papers: 0, institutions: 0 };
    current.papers += item.papers || 0;
    current.institutions += 1;
    acc.set(country, current);
    return acc;
  }, new Map());
  const countriesRank = Array.from(countryCounts.values()).sort((a, b) => b.papers - a.papers);
  const top = tiered[0] || {};
  return {
    rows: tiered,
    maxPapers,
    countries: countries.size,
    avgCited: avgCited.toFixed(1),
    active,
    lowLead,
    dormant,
    tierCounts,
    countriesRank,
    insights: [
      { title: "核心伙伴明确", text: `${top.institution || "头部机构"} 是当前样例库中合作频次最高的机构，合作论文 ${fmt(top.papers)} 篇。` },
      { title: "主导性需要单独看", text: `${lowLead} 个 Top 机构主导率低于 10%，可能更像参与型合作，需要结合学院判断实际价值。` },
      { title: "沉默伙伴需要复盘", text: `${dormant} 个 Top 机构近三年以上没有新成果，应进入重新激活或清理维护成本的清单。` },
      { title: "国家分布可辅助决策", text: `Top 机构覆盖 ${countries.size} 个国家/地区，可结合国家战略和学科方向制定访问计划。` },
    ],
  };
}

function buildSubjectAnalysis(data) {
  const rows = data || [];
  const total = rows.reduce((sum, item) => sum + Number(item.papers || 0), 0);
  const max = Math.max(...rows.map((item) => item.papers || 0), 1);
  const top = rows[0] || {};
  const topShare = total ? ((top.papers || 0) / total * 100).toFixed(1) : 0;
  const highImpact = rows.filter((item) => Number(item.avg_cited || 0) >= 50).length;
  const opportunity = rows.find((item) => Number(item.avg_cited || 0) >= 50 && item !== top) || rows[1] || top;
  return {
    rows,
    total,
    max,
    top,
    topShare,
    highImpact,
    opportunity,
    insights: [
      { title: "优势方向集中", text: `${top.domain || "重点学科"} 是当前样例库中合作最集中的方向，占学科样例论文约 ${topShare}%。` },
      { title: "高影响领域可优先布局", text: `${highImpact} 个方向平均被引较高，适合结合学院优势判断联合项目机会。` },
      { title: "潜力方向值得下钻", text: `${opportunity.domain || "潜力方向"} 同时具备合作规模和影响力，可作为重点观察方向。` },
      { title: "学科组合可服务决策", text: "将学科热度与合作国家、机构排行结合，可形成更清晰的国际合作路线图。" },
    ],
  };
}

function buildBenchmarkAnalysis(rows) {
  const list = rows || [];
  const topPapers = [...list].sort((a, b) => (b.international_papers || 0) - (a.international_papers || 0))[0] || {};
  const topCountries = [...list].sort((a, b) => (b.countries || 0) - (a.countries || 0))[0] || {};
  const topInstitutions = [...list].sort((a, b) => (b.institutions || 0) - (a.institutions || 0))[0] || {};
  const topLead = [...list].sort((a, b) => (b.lead_rate || 0) - (a.lead_rate || 0))[0] || {};
  const avgLead = list.length ? list.reduce((sum, item) => sum + Number(item.lead_rate || 0), 0) / list.length : 0;
  const avgInternational = list.length ? list.reduce((sum, item) => sum + Number(item.international_papers || 0), 0) / list.length : 0;
  const scored = list.map((item) => ({
    ...item,
    tier: (item.lead_rate || 0) >= avgLead && (item.international_papers || 0) >= avgInternational ? "综合领先" : (item.lead_rate || 0) >= avgLead ? "主导优势" : (item.international_papers || 0) >= avgInternational ? "规模优势" : "追赶提升",
  }));
  return {
    rows: scored,
    topPapers,
    topCountries,
    topInstitutions,
    topLead,
    avgLead: avgLead.toFixed(1),
    insights: [
      { title: "规模标杆", text: `${topPapers.university || "标杆学校"} 在样例国际合作论文规模上领先，可作为合作规模对标对象。` },
      { title: "覆盖标杆", text: `${topCountries.university || "标杆学校"} 的合作国家覆盖更广，适合参考其区域布局。` },
      { title: "网络标杆", text: `${topInstitutions.university || "标杆学校"} 的合作机构覆盖更强，可用于比较伙伴网络广度。` },
      { title: "主导标杆", text: `${topLead.university || "标杆学校"} 的主导率较高，适合分析其牵头合作模式。` },
    ],
  };
}

async function renderHome() {
  const overview = await api("/api/overview");
  app.innerHTML = `
    <nav class="home-rail" aria-label="首页章节导航">
      <a class="active" href="#home-hero">概览</a>
      <a href="#home-workflows">场景</a>
      <a href="#home-modules">能力</a>
      <a href="#home-access">开通</a>
    </nav>
    <section class="section hero" id="home-hero">
      <div class="hero-panel">
        <p class="eyebrow">International Office Workspace</p>
        <h1>给高校国际处使用的国际合作工作台</h1>
        <p class="lead">从公开论文和机构数据出发，快速看清合作现状、识别重点伙伴、发现沉默关系，并形成可汇报的决策依据。</p>
        <div class="actions">
          <a class="button" href="/map">先看合作格局</a>
          <a class="button secondary" href="/pricing">查看开通权益</a>
        </div>
        <div class="kpis value-kpis">
          <div class="kpi"><span>全球科研成果底座</span><strong>${big(overview.papers)}</strong></div>
          <div class="kpi"><span>可扩展国内高校机构</span><strong>${fmt(overview.universities)}+</strong></div>
          <div class="kpi"><span>合作格局分析维度</span><strong>4类</strong></div>
          <div class="kpi"><span>形成汇报与行动清单</span><strong>1键</strong></div>
        </div>
      </div>
    </section>
    <section class="section" id="home-workflows">
      <h2 class="section-title">不是临时报告，而是日常工作入口。</h2>
      <p class="section-copy">围绕国际处最常见的工作场景组织数据：出访准备、伙伴维护、领导汇报和高校对标。</p>
      <div class="scenario-grid">
        ${scenarioCard("出访前查对象", "快速了解目标机构与本校的合作历史、优势学科和近年活跃度。", "查看合作机构", "/institutions")}
        ${scenarioCard("年终证明成效", "用合著规模、覆盖国家、活跃伙伴和学科分布支撑国际化工作汇报。", "查看合作格局", "/map")}
        ${scenarioCard("发现沉默关系", "识别多年没有产出的合作机构，判断是重新激活还是清理维护成本。", "查看沉默关系", "/zombies")}
        ${scenarioCard("对标兄弟高校", "比较同层级高校的合作规模、国家覆盖和伙伴网络，找到差距与机会。", "进入对标分析", "/benchmark")}
      </div>
    </section>
    <section class="section" id="home-modules">
      <h2 class="section-title">先免费看到轮廓，再解锁完整细节。</h2>
      <p class="section-copy">公开页面先展示国家、机构、学科和对标的宏观结果；具体机构名单、历史明细、导出报告和后台权限在登录后开放。</p>
      <div class="grid">
        ${moduleCard("合作格局", "国家、机构与论文成果覆盖。", "/map")}
        ${moduleCard("绩效驾驶舱", "形成面向领导汇报的指标看板。", "/?page=dashboard")}
        ${moduleCard("机构排行", "识别核心伙伴与潜力机构。", "/institutions")}
        ${moduleCard("沉默关系", "找出长期无产出的合作伙伴。", "/zombies")}
        ${moduleCard("学科热力", "发现优势学科和增长方向。", "/subjects")}
        ${moduleCard("对标分析", "比较合作规模、覆盖和主导能力。", "/benchmark")}
      </div>
    </section>
    <section class="section commercial-section" id="home-access">
      <div class="commercial-copy">
        <span class="tag">开通后可用</span>
        <h2 class="section-title">从浏览概览，到管理全校国际合作。</h2>
        <p class="section-copy">开通后可查看完整明细、导出报告、管理伙伴清单，并支持国际处、科研院和学院协同使用。</p>
      </div>
      <div class="revenue-grid">
        <div class="card revenue-card">
          <strong>看清全局</strong>
          <span>全校合作概览</span>
          <p>统一查看国家、机构、学科、论文和对标结果，减少分散整理数据的时间。</p>
        </div>
        <div class="card revenue-card">
          <strong>形成清单</strong>
          <span>伙伴维护与沉默关系</span>
          <p>识别重点伙伴、低质量合作和长期无产出的关系，形成可跟进的维护清单。</p>
        </div>
        <div class="card revenue-card">
          <strong>用于汇报</strong>
          <span>报告与决策材料</span>
          <p>生成年度成效、同类高校对标、重点国家和机构拓展建议等汇报素材。</p>
        </div>
      </div>
      <div class="actions">
        <a class="button" href="/pricing">查看开通权益</a>
        <a class="button secondary" href="/login">申请机构试用</a>
      </div>
    </section>
  `;
  updateAuthNav();
  initPageEffects();
}

async function renderDashboard() {
  const [data, universities] = await Promise.all([api(withUniversity("/api/performance")), loadUniversities()]);
  const metrics = data.metrics || {};
  const trend = data.trend || [];
  const benchmarkRows = data.benchmarks || [];
  shell(
    "绩效驾驶舱",
    "把国际合作成果整理成处长和校领导能快速理解的绩效指标、趋势变化和汇报素材。",
    `
      ${decisionPanel(
        "把数据变成可汇报的年度结论",
        "国际处最常见的压力不是缺少数据，而是要在汇报、评估和预算讨论中说明“今年国际合作到底产生了什么价值”。",
        `当前样例显示国际合作论文 ${fmt(metrics.international_papers)} 篇，国际合著占比 ${metrics.international_share || 0}%，需要同时解释规模、质量、增长和风险。`,
        ["先用核心指标证明工作产出", "再用趋势和零被引风险指出问题", "最后形成下一年度资源投向和伙伴维护建议"]
      )}
      <div class="kpis">
        ${kpiCard(fmt(metrics.international_papers), "国际合作论文", 1)}
        ${kpiCard(`${metrics.international_share || 0}%`, "国际合著占比", 2, "green")}
        ${kpiCard(`${metrics.growth_rate || 0}%`, "近五年变化", 3)}
        ${kpiCard(`${metrics.zero_cited_rate || 0}%`, "零被引风险", 4, "red")}
      </div>
      <div class="insight-grid">
        <div class="card insight-card">
          <span class="tag">领导视角</span>
          <h3>先看成果，再看问题</h3>
          <p>用国际合作论文、合著占比和增长变化说明国际化工作的实际产出。</p>
        </div>
        <div class="card insight-card">
          <span class="tag">质量视角</span>
          <h3>关注零被引和主导性</h3>
          <p>零被引率和主导率可以帮助判断合作是否真正形成高质量成果。</p>
        </div>
        <div class="card insight-card">
          <span class="tag">汇报视角</span>
          <h3>指标要能直接复用</h3>
          <p>驾驶舱指标适合进入年终总结、双一流评估和国际处工作汇报。</p>
        </div>
        <div class="card insight-card">
          <span class="tag">下一步</span>
          <h3>从看板进入行动</h3>
          <p>发现问题后，可继续下钻到合作国家、机构质量和沉默关系清单。</p>
        </div>
      </div>
      <div class="grid two">
        <div class="card">
          <h3>近年国际合作产出</h3>
          <div class="trend-list">
            ${trend.map((item) => `
              <div class="trend-row">
                <span>${item.year}</span>
                <strong>${fmt(item.international_papers)}</strong>
                <small>国际合作论文</small>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="card">
          <h3>同批高校对标</h3>
          ${table(benchmarkRows, [
            { label: "学校", key: "university" },
            { label: "国际合作论文", key: "international_papers", format: fmt },
            { label: "合作国家", key: "countries", format: fmt },
            { label: "主导率", key: "lead_rate", format: (value) => `${value || 0}%` },
          ])}
        </div>
      </div>
      <div class="card recommendation">
        <span class="tag">汇报建议</span>
        <h3>用一页讲清国际化工作成效。</h3>
        <p>建议围绕“规模、质量、趋势、问题、下一步行动”组织汇报：先证明产出，再指出沉默关系、低主导合作和潜力方向，最后形成年度合作策略。</p>
      </div>
      ${unlockCard("解锁一键绩效报告", ["生成 PDF/Word 领导简报", "导出全部图表和指标解释", "与全国均值和全球基准对比", "保存年度汇报模板和历史版本"])}
    `,
    pageOptions(universities)
  );
  bindSchoolSelector();
}

async function renderMap() {
  const [overview, analysis, universities, worksPayload] = await Promise.all([
    api(withUniversity("/api/overview")),
    loadCollaborationAnalysis(),
    loadUniversities(),
    api(withUniversity("/api/works?limit=8")).catch(() => []),
  ]);
  const works = itemsOf(worksPayload);
  const top = analysis.countries.slice(0, 12);
  const regions = analysis.regions.slice(0, 6);
  const institutions = analysis.institutions.slice(0, 8);
  const trend = analysis.trend;
  const max = Math.max(...top.map((item) => item.papers), 1);
  const regionMax = Math.max(...regions.map((item) => item.papers), 1);
  shell(
    "合作格局",
    "从国家、区域、机构和趋势四个维度识别国际合作机会。",
    `
      ${decisionPanel(
        "判断国际合作资源应该投向哪里",
        "合作格局页不只是看哪个国家论文多，而是帮助国际处决定下一轮出访、续约、联合项目和重点伙伴维护的优先级。",
        `${top[0]?.name || "重点国家"} 是当前最集中的合作国家，${regions[0]?.region || "重点区域"} 是主要合作区域，应继续下钻到机构和学科确认是否值得加大投入。`,
        ["锁定高频国家和区域", "筛出核心机构与高影响学科", "形成访问、续约、联合项目三类行动清单"]
      )}
      ${sampleKpis(overview)}
      <div class="insight-grid">
        ${analysis.insights
          .map(
            (item) => `
              <div class="card insight-card">
                <span class="tag">智能洞察</span>
                <h3>${item.title}</h3>
                <p>${item.text}</p>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="grid two">
        <div class="card">
          <h3>合作国家排行</h3>
          <div class="bar-list">
            ${top
              .map(
                (item) => `
                  <div class="bar-row">
                    <span>${item.name || item.code}</span>
                    <div class="bar-track"><div class="bar-fill" style="width:${(item.papers / max) * 100}%"></div></div>
                    <strong>${fmt(item.papers)}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="card">
          <h3>区域分布</h3>
          <div class="bar-list compact">
            ${regions
              .map(
                (item) => `
                  <div class="bar-row compact">
                    <span>${item.region}</span>
                    <div class="bar-track"><div class="bar-fill green" style="width:${(item.papers / regionMax) * 100}%"></div></div>
                    <strong>${fmt(item.papers)}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      </div>
      <div class="grid two">
        <div class="card">
          <h3>核心合作机构</h3>
          ${table(institutions, [
            { label: "机构", key: "institution" },
            { label: "国家", key: "country" },
            { label: "论文数", key: "papers", format: fmt },
            { label: "平均被引", key: "avg_cited" },
          ])}
        </div>
        <div class="card">
          <h3>近年合作趋势</h3>
          <div class="trend-list">
            ${
              trend.length
                ? trend
                    .map(
                      (item) => `
                        <div class="trend-row">
                          <span>${item.year}</span>
                          <strong>${fmt(item.papers)}</strong>
                          <small>国际合作论文</small>
                        </div>
                      `
                    )
                    .join("")
                : '<p class="muted">趋势数据正在整理中，当前可先查看国家、区域和机构分布。</p>'
            }
          </div>
        </div>
      </div>
      <div class="card recommendation">
        <span class="tag">行动建议</span>
        <h3>优先维护高频国家与核心机构，同时追踪区域增长点。</h3>
        <p>建议把国家排行、区域分布和核心机构名单结合使用：先锁定高频合作区域，再下钻到机构和学科方向，形成可执行的访问、续约、联合项目和学科合作清单。</p>
      </div>
      <div class="card">
        <h3>最近国际合作论文样例</h3>
        ${table(works, [
          { label: "论文标题", key: "title" },
          { label: "年份", key: "year" },
          { label: "期刊/来源", key: "journal" },
          { label: "学科", key: "domain" },
          { label: "被引", key: "cited_by", format: fmt },
        ])}
      </div>
      ${unlockCard("解锁合作格局下钻能力", ["点击国家查看完整机构名单", "查看合作论文标题、年份、期刊和被引次数", "按年份、学科和论文类型筛选", "导出国家与机构合作清单"])}
    `,
    pageOptions(universities)
  );
  bindSchoolSelector();
}

async function renderInstitutions() {
  const [payload, universities] = await Promise.all([api(withUniversity("/api/institutions?limit=50")), loadUniversities()]);
  const rows = itemsOf(payload);
  const analysis = buildInstitutionAnalysis(rows);
  const tierEntries = Object.entries(analysis.tierCounts);
  const countryTop = analysis.countriesRank.slice(0, 8);
  const countryMax = Math.max(...countryTop.map((item) => item.papers), 1);
  shell(
    "机构排行",
    "识别核心伙伴、合作质量和机构维护优先级。",
    `
      ${decisionPanel(
        "把机构名单变成伙伴管理策略",
        "国际处真正需要的不是机构排名本身，而是知道哪些伙伴应该重点维护、哪些需要复盘、哪些只是低价值参与。",
        `当前样例中有 ${fmt(analysis.lowLead)} 个低主导风险机构、${fmt(analysis.dormant)} 个沉默伙伴，说明机构关系需要分层管理。`,
        ["核心伙伴进入年度维护名单", "低主导伙伴交给学院判断合作价值", "沉默伙伴进入激活、观察或清理流程"]
      )}
      <div class="kpis">
        ${kpiCard(fmt(rows.length), "样例合作机构", 1)}
        ${kpiCard(fmt(analysis.lowLead), "低主导风险", 2, "red")}
        ${kpiCard(fmt(analysis.dormant), "沉默伙伴", 3, "red")}
        ${kpiCard(fmt(analysis.active), "仍然活跃", 4, "green")}
      </div>
      <div class="insight-grid">
        ${analysis.insights
          .map(
            (item) => `
              <div class="card insight-card">
                <span class="tag">智能洞察</span>
                <h3>${item.title}</h3>
                <p>${item.text}</p>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="grid two institution-summary-grid">
        <div class="card country-card-panel">
          <h3>Top 机构国家分布</h3>
          <div class="bar-list compact">
            ${countryTop
              .map(
                (item) => `
                  <div class="bar-row compact">
                    <span>${item.country}</span>
                    <div class="bar-track"><div class="bar-fill" style="width:${(item.papers / countryMax) * 100}%"></div></div>
                    <strong>${fmt(item.papers)}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="card tier-card-panel">
          <h3>伙伴质量标签</h3>
          <div class="tier-grid">
            ${tierEntries
              .map(
                ([tier, count]) => `
                  <div class="tier-card">
                    <strong>${count}</strong>
                    <span>${tier}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      </div>
      <div class="card institution-table-card">
        <h3>核心合作机构清单</h3>
        ${table(analysis.rows, [
          { label: "机构", key: "institution" },
          { label: "国家", key: "country" },
          { label: "合作论文", key: "papers", format: fmt },
          { label: "主导率", key: "lead_rate", format: (value) => `${value || 0}%` },
          { label: "最后合作", key: "last_year" },
          { label: "沉默年数", key: "silent_years" },
          { label: "质量标签", key: "tier" },
        ])}
      </div>
      <div class="card recommendation">
        <span class="tag">行动建议</span>
        <h3>把机构排行整理成伙伴维护清单。</h3>
        <p>优先维护“核心伙伴”和“高潜力伙伴”；对“灌水风险”要判断是否只是挂名参与；对“沉默伙伴”结合学院、学科和历史项目复盘，决定激活、观察或减少维护投入。</p>
      </div>
      ${unlockCard("解锁机构质量分析", ["查看 Top 100 合作机构完整名单", "打开机构详情页查看年度趋势和学科分布", "导出伙伴维护优先级清单", "按学院或学科拆分合作机构"])}
    `,
    pageOptions(universities)
  );
  bindSchoolSelector();
}

async function renderZombies() {
  const [data, universities] = await Promise.all([api(withUniversity("/api/zombies")), loadUniversities()]);
  const summary = data.summary || {};
  const partners = data.partners || [];
  const zombies = partners.filter((item) => item.status === "僵尸").slice(0, 20);
  const warnings = partners.filter((item) => item.status === "警告").slice(0, 10);
  shell(
    "沉默关系识别",
    "找出签过协议或曾经合作、但近年没有继续产出的机构，帮助国际处判断是否激活、维护或清理。",
    `
      ${decisionPanel(
        "识别名义合作和无效维护成本",
        "很多高校有大量历史合作协议和伙伴名单，但真正持续产生科研成果的关系有限。本页帮助判断哪些关系还值得投入时间和资源。",
        `当前样例识别出 ${fmt(summary.zombie)} 个僵尸关系和 ${fmt(summary.warning)} 个警告关系，应优先复盘历史产出高但近期无新成果的机构。`,
        ["把沉默关系按历史价值排序", "分配到学院或项目负责人复盘", "形成激活、观察、清理三类处理结果"]
      )}
      <div class="kpis">
        ${kpiCard(fmt(summary.total), "样例合作机构", 1)}
        ${kpiCard(fmt(summary.zombie), "僵尸关系", 2, "red")}
        ${kpiCard(fmt(summary.warning), "警告关系", 3, "red")}
        ${kpiCard(fmt(summary.active), "仍然活跃", 4, "green")}
      </div>
      <div class="insight-grid">
        <div class="card insight-card">
          <span class="tag">痛点识别</span>
          <h3>协议不等于有效合作</h3>
          <p>长期没有论文产出的机构需要重新评估，避免合作协议只停留在名义关系。</p>
        </div>
        <div class="card insight-card">
          <span class="tag">优先处理</span>
          <h3>${summary.zombie || 0} 个关系需要复盘</h3>
          <p>建议优先看历史产出较高、但最近三年以上没有新成果的合作机构。</p>
        </div>
        <div class="card insight-card">
          <span class="tag">行动清单</span>
          <h3>从名单到跟进任务</h3>
          <p>可按国家、学院和历史合作强度拆分维护责任，形成访问、续约或终止建议。</p>
        </div>
        <div class="card insight-card">
          <span class="tag">完整清单</span>
          <h3>登录后可继续查看明细</h3>
          <p>完整沉默关系名单、跟进记录和导出能力可用于部门协同和年度复盘。</p>
        </div>
      </div>
      <div class="grid two">
        <div class="card">
          <h3>优先复盘的沉默机构</h3>
          ${table(zombies, [
            { label: "机构", key: "institution" },
            { label: "国家/地区", key: "country" },
            { label: "历史论文", key: "papers", format: fmt },
            { label: "最后合作", key: "last_year" },
            { label: "沉默年数", key: "silent_years" },
            { label: "状态", key: "status" },
          ])}
        </div>
        <div class="card">
          <h3>近期需要跟进</h3>
          ${table(warnings, [
            { label: "机构", key: "institution" },
            { label: "国家/地区", key: "country" },
            { label: "最后合作", key: "last_year" },
            { label: "建议", key: "priority" },
          ])}
        </div>
      </div>
      <div class="card recommendation">
        <span class="tag">行动建议</span>
        <h3>把沉默关系分成三类处理：激活、观察、清理。</h3>
        <p>历史产出高但沉默时间长的机构，优先安排学院复盘和外方沟通；历史产出低且长期无后续的机构，可减少维护投入，把资源转向高潜力伙伴。</p>
      </div>
      ${unlockCard("解锁完整沉默关系名单", ["导出全部僵尸合作机构 Excel", "按国家、学院和学科筛选沉默关系", "生成激活、观察、清理三类处理清单", "沉默关系跟进记录和权限协作"])}
    `,
    pageOptions(universities)
  );
  bindSchoolSelector();
}

async function renderSubjects() {
  const [payload, universities] = await Promise.all([api(withUniversity("/api/subjects?limit=12")), loadUniversities()]);
  const data = itemsOf(payload);
  const analysis = buildSubjectAnalysis(data);
  shell(
    "学科热力",
    "识别国际合作中的优势学科、高影响方向和潜在增长点。",
    `
      ${decisionPanel(
        "找到国际合作最值得投入的学科方向",
        "学科热力页要回答的是：学校应该在哪些学科上加强国际合作，哪些方向已经有基础，哪些方向影响力高但合作不足。",
        `${analysis.top.domain || "重点学科"} 是当前合作最集中的方向，高影响方向共 ${fmt(analysis.highImpact)} 个，适合与学院共同制定重点伙伴拓展计划。`,
        ["先定位优势学科和高影响方向", "再联动国家与机构数据寻找伙伴", "最后形成学院级国际合作建议"]
      )}
      <div class="kpis">
        ${kpiCard(fmt(analysis.total), "样例学科论文", 1)}
        ${kpiCard(fmt(analysis.rows.length), "学科方向", 2, "green")}
        ${kpiCard(`${analysis.topShare}%`, "第一方向占比", 3)}
        ${kpiCard(fmt(analysis.highImpact), "高影响方向", 4, "green")}
      </div>
      <div class="insight-grid">
        ${analysis.insights
          .map(
            (item) => `
              <div class="card insight-card">
                <span class="tag">智能洞察</span>
                <h3>${item.title}</h3>
                <p>${item.text}</p>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="card">
        <h3>学科合作热度</h3>
        <div class="bar-list">
          ${analysis.rows
            .map(
              (item) => `
                <div class="bar-row">
                  <span>${item.domain}</span>
                  <div class="bar-track"><div class="bar-fill green" style="width:${(item.papers / analysis.max) * 100}%"></div></div>
                  <strong>${fmt(item.papers)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="grid two">
        <div class="card">
          <h3>高影响方向</h3>
          ${table(
            analysis.rows
              .filter((item) => Number(item.avg_cited || 0) >= 50)
              .slice(0, 8),
            [
              { label: "学科方向", key: "domain" },
              { label: "论文数", key: "papers", format: fmt },
              { label: "平均被引", key: "avg_cited" },
            ]
          )}
        </div>
        <div class="card recommendation">
          <span class="tag">行动建议</span>
          <h3>用学科热度确定合作优先级。</h3>
          <p>优先选择“规模较高 + 影响力较高”的方向进入学院层面复盘，再结合国家和机构排行形成目标伙伴清单。</p>
        </div>
      </div>
      ${unlockCard("解锁学科穿透分析", ["查看细分学科和主题方向", "按学科下钻到国家和机构", "发现高影响但合作不足的潜力方向", "导出学院级合作建议"])}
    `,
    pageOptions(universities)
  );
  bindSchoolSelector();
}

async function renderBenchmark() {
  const payload = await api("/api/benchmark");
  const rows = itemsOf(payload);
  const analysis = buildBenchmarkAnalysis(rows);
  shell(
    "多校对标分析",
    "比较高校国际合作规模、覆盖能力、伙伴网络和主导能力。",
    `
      ${decisionPanel(
        "判断学校和同层次高校的差距在哪里",
        "对标分析不应只比较谁的论文多，而是拆解规模、覆盖、伙伴网络和主导能力，找到可追赶的具体方向。",
        `${analysis.topPapers.university || "规模标杆"} 在合作规模上领先，${analysis.topLead.university || "主导标杆"} 在主导能力上领先，可以分别作为不同追赶目标。`,
        ["选择同层次高校作为参照组", "按规模、覆盖、网络、主导四类拆解差距", "把差距转成年度目标和重点合作策略"]
      )}
      <div class="kpis">
        ${kpiCard(analysis.topPapers.university || "-", "规模标杆", 1)}
        ${kpiCard(analysis.topCountries.university || "-", "覆盖标杆", 2)}
        ${kpiCard(analysis.topLead.university || "-", "主导标杆", 3, "green")}
        ${kpiCard(`${analysis.avgLead}%`, "平均主导率", 4, "green")}
      </div>
      <div class="insight-grid">
        ${analysis.insights
          .map(
            (item) => `
              <div class="card insight-card">
                <span class="tag">智能洞察</span>
                <h3>${item.title}</h3>
                <p>${item.text}</p>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="card">
        <h3>高校对标矩阵</h3>
        ${table(analysis.rows, [
          { label: "学校", key: "university" },
          { label: "样例论文数", key: "papers", format: fmt },
          { label: "国际合作论文", key: "international_papers", format: fmt },
          { label: "合作国家", key: "countries", format: fmt },
          { label: "合作机构", key: "institutions", format: fmt },
          { label: "主导率", key: "lead_rate", format: (value) => `${value || 0}%` },
          { label: "对标类型", key: "tier" },
        ])}
      </div>
      <div class="card recommendation">
        <span class="tag">行动建议</span>
        <h3>把对标结果拆成规模、覆盖、网络和主导四类目标。</h3>
        <p>规模落后时优先扩大合作产出；覆盖不足时拓展国家和机构网络；主导率不足时重点提升牵头项目、通讯作者和联合平台建设能力。</p>
      </div>
      ${unlockCard("解锁完整对标报告", ["查看逐项差距解释和追赶建议", "比较独家合作机构和拓展目标", "生成近五年增速对比图", "导出 PDF/Word 汇报简报"])}
    `
  );
}

function renderLogin() {
  app.innerHTML = `
    <section class="section auth-section">
      <div class="auth-layout">
        <div class="auth-copy">
          <span class="tag">权限入口</span>
          <h1>登录后进入完整决策工作台。</h1>
          <p>公开页面用于快速浏览合作格局；开通账号后，可查看完整样本、导出报告、管理学校与机构权限。</p>
          <div class="auth-benefits">
            <div>
              <strong>完整数据</strong>
              <span>查看学校、学科、国家和机构的多维明细。</span>
            </div>
            <div>
              <strong>报告导出</strong>
              <span>生成对标分析、合作清单和管理汇报材料。</span>
            </div>
            <div>
              <strong>团队协作</strong>
              <span>支持国际处、科研院和学院分级使用。</span>
            </div>
          </div>
        </div>
        <div class="auth-card">
          ${
            currentUser
              ? `
                <div class="auth-card-head">
                  <span class="tag">当前账号</span>
                  <h2>${currentUser.name || currentUser.phone}</h2>
                  <p>${currentUser.organization || selectedUniversity} · ${currentUser.plan || "本地测试账号"}</p>
                </div>
                <div class="account-status">
                  <div><strong>登录状态</strong><span>已登录</span></div>
                  <div><strong>账号权限</strong><span>${currentUser.status || "已开通"}</span></div>
                  <div><strong>当前学校</strong><span>${selectedUniversity}</span></div>
                </div>
                <div class="actions auth-actions">
                  <button class="button" id="enterDashboardBtn">进入绩效驾驶舱</button>
                  <button class="button secondary" id="logoutBtn">退出登录</button>
                </div>
              `
              : `
                <div class="auth-card-head">
                  <span class="tag">账号登录</span>
                  <h2>进入工作台</h2>
                  <p>用于导出报告、查看完整样本和管理团队权限。</p>
                </div>
                <form class="auth-form" id="loginForm">
                  <label>手机号</label>
                  <input id="loginPhone" type="tel" inputmode="tel" placeholder="请输入手机号" value="13800000000" />
                  <label>验证码</label>
                  <div class="input-action">
                    <input id="loginCode" inputmode="numeric" placeholder="请输入验证码" value="123456" />
                    <button type="button" id="sendCodeBtn">获取验证码</button>
                  </div>
                  <button class="button auth-submit" type="submit">登录工作台</button>
                </form>
                <div class="auth-divider"><span>机构开通</span></div>
                <form class="signup-panel" id="signupForm">
                  <label>学校 / 机构名称</label>
                  <input id="signupOrg" placeholder="请输入学校或机构名称" value="${selectedUniversity}" />
                  <label>联系人</label>
                  <input id="signupName" placeholder="请输入联系人姓名" value="本地测试用户" />
                  <label>职务 / 部门</label>
                  <input id="signupRole" placeholder="例如：国际合作处、科研院、学院办公室" value="国际合作处" />
                  <button class="button secondary auth-submit" type="submit">提交开通申请</button>
                </form>
              `
          }
        </div>
      </div>
    </section>
  `;
  bindAuthFormsV2();
  updateAuthNav();
}

function renderPricing() {
  shell(
    "开通权益",
    "为国际处、科研院、学科建设办公室和学院提供完整数据、报告导出和协同管理能力。",
    `
      <div class="decision-panel pricing-decision">
        <div class="decision-main">
          <span class="tag">适用场景</span>
          <h2>让国际合作管理从分散整理，变成持续跟进。</h2>
          <p>适合用于年度总结、出访准备、协议复盘、学科建设、同类高校对标和领导汇报。</p>
        </div>
        <div class="decision-judgment">
          <strong>开通后获得</strong>
          <p>完整机构名单、沉默关系清单、学院和学科下钻、对标报告、报告导出和团队权限。</p>
        </div>
        <div class="decision-actions">
          <strong>建议使用方式</strong>
          <ol>
            <li>先用公开页面了解学校合作概况</li>
            <li>提交机构申请并确认使用范围</li>
            <li>开通后导出报告和伙伴维护清单</li>
          </ol>
        </div>
      </div>
      <div class="pricing-grid">
        ${priceCard("体验入口", "公开浏览", "初次了解", ["查看宏观合作格局", "浏览样例机构和学科洞察", "体验登录和工作台流程", "适合首次了解平台能力"])}
        ${priceCard("机构工作台", "申请开通", "学校/科研院/国际处", ["完整学校数据和机构名单", "沉默关系与伙伴维护清单", "绩效驾驶舱和报告导出", "多角色账号与权限管理"], true)}
        ${priceCard("专题分析", "联系确认", "领导汇报/战略规划", ["年度国际合作成效报告", "同层次高校对标分析", "重点国家与机构拓展建议", "可交付 Word/PDF 汇报材料"])}
      </div>
      <div class="grid two">
        <div class="card">
          <h3>开通后可以解决什么</h3>
          <ul class="business-list">
            <li>减少国际处手工整理论文、机构、国家和学院数据的时间。</li>
            <li>把合作协议和历史关系整理成可维护、可复盘、可汇报的清单。</li>
            <li>支持年度总结、双一流建设、领导汇报和出访计划。</li>
            <li>帮助学校基于数据判断合作资源应该投向哪里。</li>
          </ul>
        </div>
        <div class="card">
          <h3>适合哪些角色使用</h3>
          <ul class="business-list">
            <li>国际合作处：伙伴维护、出访准备、协议复盘。</li>
            <li>科研院/科技处：国际论文产出、项目布局、质量评估。</li>
            <li>学科建设办公室：学科国际影响力和标杆高校对比。</li>
            <li>校领导办公室：一页式汇报、年度成效和下一步策略。</li>
          </ul>
        </div>
      </div>
      <div class="card recommendation">
        <span class="tag">申请说明</span>
        <h3>提交申请后，我们会根据学校和使用部门确认开通范围。</h3>
        <p>如果需要用于年度总结、专题汇报或同类高校对标，可以在申请时说明具体场景，便于优先配置相应的数据视图和报告模板。</p>
      </div>
    `
  );
}

function bindAuthForms() {
  const loginForm = document.querySelector("#loginForm");
  const signupForm = document.querySelector("#signupForm");
  const logoutBtn = document.querySelector("#logoutBtn");
  const sendCodeBtn = document.querySelector("#sendCodeBtn");
  const enterDashboardBtn = document.querySelector("#enterDashboardBtn");

  if (sendCodeBtn) {
    sendCodeBtn.addEventListener("click", () => {
      sendCodeBtn.textContent = "验证码 123456";
      sendCodeBtn.disabled = true;
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const phone = document.querySelector("#loginPhone").value.trim() || "13800000000";
      saveUser({
        phone,
        name: "本地测试用户",
        organization: selectedUniversity,
        role: "国际合作处",
        plan: "个人体验版",
        status: "已开通",
        loggedAt: new Date().toISOString(),
      });
      renderLogin();
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveUser({
        phone: "待绑定手机号",
        name: document.querySelector("#signupName").value.trim() || "本地测试用户",
        organization: document.querySelector("#signupOrg").value.trim() || selectedUniversity,
        role: document.querySelector("#signupRole").value.trim() || "国际合作处",
        plan: "机构申请",
        status: "待审核",
        loggedAt: new Date().toISOString(),
      });
      renderLogin();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearUser();
      renderLogin();
    });
  }

  if (enterDashboardBtn) {
    enterDashboardBtn.addEventListener("click", () => {
      history.pushState({}, "", "/?page=dashboard");
      renderDashboard();
    });
  }
}

function bindAuthFormsV2() {
  const loginForm = document.querySelector("#loginForm");
  const signupForm = document.querySelector("#signupForm");
  const logoutBtn = document.querySelector("#logoutBtn");
  const sendCodeBtn = document.querySelector("#sendCodeBtn");
  const enterDashboardBtn = document.querySelector("#enterDashboardBtn");

  if (sendCodeBtn) {
    sendCodeBtn.addEventListener("click", async () => {
      const phone = document.querySelector("#loginPhone").value.trim() || "13800000000";
      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = "发送中";
      try {
        const result = await postApi("/api/auth/send-code", { phone });
        const code = result.debug_code || "";
        sendCodeBtn.textContent = code ? `验证码 ${code}` : "已发送";
        if (code) document.querySelector("#loginCode").value = code;
      } catch (error) {
        sendCodeBtn.textContent = "重新获取";
        sendCodeBtn.disabled = false;
        alert(error.message);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await postApi("/api/auth/login", {
          phone: document.querySelector("#loginPhone").value.trim() || "13800000000",
          code: document.querySelector("#loginCode").value.trim(),
          organization: selectedUniversity,
          role: "international-office",
        });
        saveUser(result.user, result.token);
        renderLogin();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await postApi("/api/access-requests", {
          phone: currentUser?.phone || "",
          name: document.querySelector("#signupName").value.trim(),
          organization: document.querySelector("#signupOrg").value.trim() || selectedUniversity,
          role: document.querySelector("#signupRole").value.trim(),
          message: "用户从开通页面提交机构开通申请",
        });
        saveUser({
          ...(currentUser || {}),
          phone: currentUser?.phone || result.request.phone || "待绑定手机号",
          name: result.request.name || currentUser?.name || "待审核用户",
          organization: result.request.organization,
          role: result.request.role,
          plan: "institution-request",
          status: "pending",
        });
        renderLogin();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await postApi("/api/auth/logout");
      } catch (_) {
        // Local cleanup still matters if the server session already expired.
      }
      clearUser();
      renderLogin();
    });
  }

  if (enterDashboardBtn) {
    enterDashboardBtn.addEventListener("click", () => {
      history.pushState({}, "", "/?page=dashboard");
      renderDashboard();
    });
  }
}

function renderAdmin() {
  shell(
    "管理后台",
    "用于用户权限、数据接入、开通审核和运营管理。",
    `<div class="card form"><label>管理员密码</label><input type="password" /><div class="actions"><button class="button">进入后台</button></div></div>`
  );
}

async function renderAdminConsole() {
  const adminToken = localStorage.getItem("adminToken") || "";
  if (!adminToken) {
    shell(
      "管理后台",
      "用于用户权限、开通审核和运营管理。",
      `
        <div class="card form">
          <label>管理员密钥</label>
          <input id="adminTokenInput" type="password" placeholder="请输入管理员密钥" />
          <div class="actions"><button class="button" id="adminLoginBtn">进入后台</button></div>
        </div>
      `
    );
    bindAdminLogin();
    return;
  }

  try {
    const [requestsData, usersData, dataStatus] = await Promise.all([
      adminApi("/api/admin/access-requests"),
      adminApi("/api/admin/users"),
      adminApi("/api/admin/data-status"),
    ]);
    shell(
      "管理后台",
      "审核开通申请、查看用户和运营状态。",
      `
        <div class="kpis">
          ${kpiCard(fmt(requestsData.requests.filter((item) => item.status === "pending").length), "待审核申请", 1, "red")}
          ${kpiCard(fmt(requestsData.requests.filter((item) => item.status === "approved").length), "已开通申请", 2, "green")}
          ${kpiCard(fmt(usersData.users.length), "注册用户", 3)}
          ${kpiCard(fmt(usersData.users.filter((item) => item.status === "active").length), "已开通用户", 4, "green")}
        </div>
        <div class="grid two admin-grid">
          <div class="card">
            <h3>开通申请</h3>
            ${adminRequestsTable(requestsData.requests)}
          </div>
          <div class="card">
            <h3>用户列表</h3>
            ${adminUsersTable(usersData.users)}
          </div>
        </div>
        <div class="grid two admin-grid">
          <div class="card">
            <h3>数据源状态</h3>
            ${adminSourcesTable(dataStatus.sources || [])}
          </div>
          <div class="card">
            <h3>数据任务</h3>
            ${adminJobsTable(dataStatus.jobs || [])}
          </div>
        </div>
        <div class="actions">
          <button class="button secondary" id="adminLogoutBtn">退出后台</button>
        </div>
      `
    );
    bindAdminActions();
  } catch (error) {
    localStorage.removeItem("adminToken");
    shell(
      "管理后台",
      "管理员密钥无效或已变更，请重新登录。",
      `
        <div class="card form">
          <p class="muted">${error.message}</p>
          <label>管理员密钥</label>
          <input id="adminTokenInput" type="password" placeholder="请输入管理员密钥" />
          <div class="actions"><button class="button" id="adminLoginBtn">进入后台</button></div>
        </div>
      `
    );
    bindAdminLogin();
  }
}

function adminRequestsTable(requests) {
  if (!requests.length) return `<p class="muted">暂无开通申请。</p>`;
  return `
    <div class="admin-list">
      ${requests
        .map(
          (item) => `
            <div class="admin-row">
              <div>
                <strong>${item.organization || "-"}</strong>
                <span>${item.name || "-"} · ${item.role || "-"} · ${item.phone || "-"}</span>
                <small>${item.created_at || ""}</small>
              </div>
              <em class="status-badge ${item.status}">${item.status}</em>
              ${
                item.status === "pending"
                  ? `<div class="admin-actions">
                      <button data-action="approve" data-id="${item.id}">通过</button>
                      <button data-action="reject" data-id="${item.id}">拒绝</button>
                    </div>`
                  : ""
              }
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function adminUsersTable(users) {
  if (!users.length) return `<p class="muted">暂无用户。</p>`;
  return `
    <div class="admin-list compact">
      ${users
        .map(
          (item) => `
            <div class="admin-row">
              <div>
                <strong>${item.name || item.phone}</strong>
                <span>${item.organization || "-"} · ${item.role || "-"} · ${item.phone}</span>
                <small>${item.plan || "trial"} · ${item.status || "trial"}</small>
              </div>
              <em class="status-badge ${item.status}">${item.status}</em>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function adminSourcesTable(sources) {
  if (!sources.length) return `<p class="muted">暂无学校数据源。</p>`;
  return `
    <div class="admin-list compact">
      ${sources
        .map(
          (item) => `
            <div class="admin-row">
              <div>
                <strong>${item.university}</strong>
                <span>${item.search_name || "-"} · raw ${fmt(item.raw_count)} · processed ${fmt(item.work_count)}</span>
                <small>last fetched ${item.last_fetched_at || "未采集"}</small>
              </div>
              <em class="status-badge ${item.status}">${item.status}</em>
              <div class="admin-actions">
                <button data-action="refresh-data" data-university="${item.university}">刷新</button>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function adminJobsTable(jobs) {
  if (!jobs.length) return `<p class="muted">暂无数据任务。</p>`;
  return `
    <div class="admin-list compact">
      ${jobs
        .slice(0, 12)
        .map(
          (item) => `
            <div class="admin-row">
              <div>
                <strong>${item.university}</strong>
                <span>${item.job_type} · raw ${fmt(item.raw_count)} · processed ${fmt(item.processed_count)}</span>
                <small>${item.error || item.finished_at || item.created_at || ""}</small>
              </div>
              <em class="status-badge ${item.status}">${item.status}</em>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function bindAdminLogin() {
  const button = document.querySelector("#adminLoginBtn");
  if (!button) return;
  button.addEventListener("click", () => {
    const token = document.querySelector("#adminTokenInput").value.trim();
    if (!token) {
      alert("请输入管理员密钥");
      return;
    }
    localStorage.setItem("adminToken", token);
    renderAdminConsole();
  });
}

function bindAdminActions() {
  const logout = document.querySelector("#adminLogoutBtn");
  if (logout) {
    logout.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      renderAdminConsole();
    });
  }
  document.querySelectorAll("[data-action][data-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.id);
      const action = button.dataset.action;
      const path = action === "approve" ? "/api/admin/access-requests/approve" : "/api/admin/access-requests/reject";
      try {
        await adminApi(path, { method: "POST", body: JSON.stringify({ id }) });
        renderAdminConsole();
      } catch (error) {
        alert(error.message);
      }
    });
  });
  document.querySelectorAll("[data-action='refresh-data'][data-university]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "刷新中";
      try {
        await adminApi("/api/admin/data/refresh", {
          method: "POST",
          body: JSON.stringify({ university: button.dataset.university, limit_per_university: 200 }),
        });
        renderAdminConsole();
      } catch (error) {
        button.disabled = false;
        button.textContent = "刷新";
        alert(error.message);
      }
    });
  });
}

const routes = {
  "/": renderHome,
  "/map": renderMap,
  "/dashboard": renderDashboard,
  "/performance": renderDashboard,
  "/institutions": renderInstitutions,
  "/zombies": renderZombies,
  "/subjects": renderSubjects,
  "/benchmark": renderBenchmark,
  "/pricing": renderPricing,
  "/login": renderLogin,
  "/admin": renderAdminConsole,
};

updateAuthNav();

const queryPage = new URLSearchParams(location.search).get("page");
const routeKey = queryPage ? `/${queryPage}` : location.pathname;

(routes[routeKey] || renderHome)().catch((error) => {
  app.innerHTML = `<section class="section"><div class="card status">页面加载失败：${error.message}</div></section>`;
});
