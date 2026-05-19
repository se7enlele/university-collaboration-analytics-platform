const app = document.querySelector("#app");
const nf = new Intl.NumberFormat("zh-CN");
let universitiesCache = null;
let selectedUniversity = localStorage.getItem("selectedUniversity") || "山东大学";
let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const fallbackUniversities = [
  { university: "山东大学" },
  { university: "中山大学" },
  { university: "武汉大学" },
  { university: "四川大学" },
];

async function api(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`API failed: ${path}`);
  return response.json();
}

function fmt(value) {
  return nf.format(Number(value || 0));
}

function withUniversity(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}university=${encodeURIComponent(selectedUniversity)}`;
}

function saveUser(user) {
  currentUser = user;
  localStorage.setItem("currentUser", JSON.stringify(user));
}

function clearUser() {
  currentUser = null;
  localStorage.removeItem("currentUser");
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
}

function table(rows, columns) {
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
      <div class="kpi"><strong>${big(overview.papers)}</strong><span>全球科研成果</span></div>
      <div class="kpi"><strong>${big(overview.international_papers)}</strong><span>国际合作论文</span></div>
      <div class="kpi"><strong>${fmt(overview.universities)}</strong><span>国内高校与机构</span></div>
      <div class="kpi"><strong>${big(overview.institutions)}</strong><span>全球合作机构</span></div>
    </div>
  `;
}

function sampleKpis(overview) {
  return `
    <div class="kpis">
      <div class="kpi"><strong>${fmt(overview.sample_international_papers || 0)}</strong><span>样例合作论文</span></div>
      <div class="kpi"><strong>${fmt(overview.sample_countries || 0)}</strong><span>合作国家/地区</span></div>
      <div class="kpi"><strong>${fmt(overview.sample_institutions || 0)}</strong><span>合作机构</span></div>
      <div class="kpi"><strong>${overview.lead_rate || 0}%</strong><span>主导率</span></div>
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
      <a class="button" href="/login">开通完整工作台</a>
    </div>
  `;
}

function decisionPanel(title, question, judgment, actions) {
  return `
    <div class="decision-panel">
      <div class="decision-main">
        <span class="tag">本页解决的问题</span>
        <h2>${title}</h2>
        <p>${question}</p>
      </div>
      <div class="decision-judgment">
        <strong>业务判断</strong>
        <p>${judgment}</p>
      </div>
      <div class="decision-actions">
        <strong>下一步行动</strong>
        <ol>
          ${actions.map((item) => `<li>${item}</li>`).join("")}
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
    return await api(withUniversity("/api/collaboration"));
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
  const [overview, universities] = await Promise.all([api(withUniversity("/api/overview")), loadUniversities()]);
  app.innerHTML = `
    <section class="section hero">
      <div class="hero-panel">
        <p class="eyebrow">International Office Workspace</p>
        <h1>给高校国际处使用的国际合作工作台</h1>
        <p class="lead">从公开论文和机构数据出发，快速看清合作现状、识别重点伙伴、发现沉默关系，并形成可汇报的决策依据。</p>
        <div class="actions">
          <a class="button" href="/map">先看合作格局</a>
          <a class="button secondary" href="/login">开通完整工作台</a>
        </div>
        ${schoolSelector(universities)}
        <div class="kpis value-kpis">
          <div class="kpi"><strong>${big(overview.papers)}</strong><span>全球科研成果底座</span></div>
          <div class="kpi"><strong>${fmt(overview.universities)}+</strong><span>可扩展国内高校机构</span></div>
          <div class="kpi"><strong>4类</strong><span>合作格局分析维度</span></div>
          <div class="kpi"><strong>1键</strong><span>形成汇报与行动清单</span></div>
        </div>
      </div>
    </section>
    <section class="section">
      <h2 class="section-title">不是临时报告，而是日常工作入口。</h2>
      <p class="section-copy">围绕国际处最常见的工作场景组织数据：出访准备、伙伴维护、领导汇报和高校对标。</p>
      <div class="scenario-grid">
        ${scenarioCard("出访前查对象", "快速了解目标机构与本校的合作历史、优势学科和近年活跃度。", "查看合作机构", "/institutions")}
        ${scenarioCard("年终证明成效", "用合著规模、覆盖国家、活跃伙伴和学科分布支撑国际化工作汇报。", "查看合作格局", "/map")}
        ${scenarioCard("发现沉默关系", "识别多年没有产出的合作机构，判断是重新激活还是清理维护成本。", "查看沉默关系", "/zombies")}
        ${scenarioCard("对标兄弟高校", "比较同层级高校的合作规模、国家覆盖和伙伴网络，找到差距与机会。", "进入对标分析", "/benchmark")}
      </div>
    </section>
    <section class="section">
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
  `;
  bindSchoolSelector();
}

async function renderDashboard() {
  const [data, universities] = await Promise.all([api(withUniversity("/api/performance")), loadUniversities()]);
  const metrics = data.metrics || {};
  const trend = data.trend || [];
  const benchmarkRows = data.benchmarks || [];
  shell(
    "绩效驾驶舱",
    "把国际合作成果转化为处长和校领导能快速理解的绩效指标、趋势变化和汇报素材。",
    `
      ${decisionPanel(
        "把数据变成可汇报的年度结论",
        "国际处最常见的压力不是缺少数据，而是要在汇报、评估和预算讨论中说明“今年国际合作到底产生了什么价值”。",
        `当前样例显示国际合作论文 ${fmt(metrics.international_papers)} 篇，国际合著占比 ${metrics.international_share || 0}%，需要同时解释规模、质量、增长和风险。`,
        ["先用核心指标证明工作产出", "再用趋势和零被引风险指出问题", "最后形成下一年度资源投向和伙伴维护建议"]
      )}
      <div class="kpis">
        <div class="kpi"><strong>${fmt(metrics.international_papers)}</strong><span>国际合作论文</span></div>
        <div class="kpi"><strong>${metrics.international_share || 0}%</strong><span>国际合著占比</span></div>
        <div class="kpi"><strong>${metrics.growth_rate || 0}%</strong><span>近五年变化</span></div>
        <div class="kpi"><strong>${metrics.zero_cited_rate || 0}%</strong><span>零被引风险</span></div>
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
    { universities }
  );
  bindSchoolSelector();
}

async function renderMap() {
  const [overview, analysis, universities, works] = await Promise.all([
    api(withUniversity("/api/overview")),
    loadCollaborationAnalysis(),
    loadUniversities(),
    api(withUniversity("/api/works?limit=8")).catch(() => []),
  ]);
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
    { universities }
  );
  bindSchoolSelector();
}

async function renderInstitutions() {
  const [rows, universities] = await Promise.all([api(withUniversity("/api/institutions?limit=50")), loadUniversities()]);
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
        <div class="kpi"><strong>${fmt(rows.length)}</strong><span>样例合作机构</span></div>
        <div class="kpi"><strong>${fmt(analysis.lowLead)}</strong><span>低主导风险</span></div>
        <div class="kpi"><strong>${fmt(analysis.dormant)}</strong><span>沉默伙伴</span></div>
        <div class="kpi"><strong>${fmt(analysis.active)}</strong><span>仍然活跃</span></div>
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
      <div class="grid two">
        <div class="card">
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
        <div class="card">
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
      </div>
      <div class="card">
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
        <h3>把机构排行转化为伙伴维护清单。</h3>
        <p>优先维护“核心伙伴”和“高潜力伙伴”；对“灌水风险”要判断是否只是挂名参与；对“沉默伙伴”结合学院、学科和历史项目复盘，决定激活、观察或减少维护投入。</p>
      </div>
      ${unlockCard("解锁机构质量分析", ["查看 Top 100 合作机构完整名单", "打开机构详情页查看年度趋势和学科分布", "导出伙伴维护优先级清单", "按学院或学科拆分合作机构"])}
    `,
    { universities }
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
        <div class="kpi"><strong>${fmt(summary.total)}</strong><span>样例合作机构</span></div>
        <div class="kpi"><strong>${fmt(summary.zombie)}</strong><span>僵尸关系</span></div>
        <div class="kpi"><strong>${fmt(summary.warning)}</strong><span>警告关系</span></div>
        <div class="kpi"><strong>${fmt(summary.active)}</strong><span>仍然活跃</span></div>
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
          <span class="tag">付费价值</span>
          <h3>完整名单适合导出</h3>
          <p>完整僵尸合作名单、联系人维护和 Excel 导出适合作为登录后的核心权益。</p>
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
    { universities }
  );
  bindSchoolSelector();
}

async function renderSubjects() {
  const [data, universities] = await Promise.all([api(withUniversity("/api/subjects?limit=12")), loadUniversities()]);
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
        <div class="kpi"><strong>${fmt(analysis.total)}</strong><span>样例学科论文</span></div>
        <div class="kpi"><strong>${fmt(analysis.rows.length)}</strong><span>学科方向</span></div>
        <div class="kpi"><strong>${analysis.topShare}%</strong><span>第一方向占比</span></div>
        <div class="kpi"><strong>${fmt(analysis.highImpact)}</strong><span>高影响方向</span></div>
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
    { universities }
  );
  bindSchoolSelector();
}

async function renderBenchmark() {
  const rows = await api("/api/benchmark");
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
        <div class="kpi"><strong>${analysis.topPapers.university || "-"}</strong><span>规模标杆</span></div>
        <div class="kpi"><strong>${analysis.topCountries.university || "-"}</strong><span>覆盖标杆</span></div>
        <div class="kpi"><strong>${analysis.topLead.university || "-"}</strong><span>主导标杆</span></div>
        <div class="kpi"><strong>${analysis.avgLead}%</strong><span>平均主导率</span></div>
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
  bindAuthForms();
  updateAuthNav();
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

function renderAdmin() {
  shell(
    "管理后台",
    "用于用户权限、数据接入、付费审核和运营管理。",
    `<div class="card form"><label>管理员密码</label><input type="password" /><div class="actions"><button class="button">进入后台</button></div></div>`
  );
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
  "/login": renderLogin,
  "/admin": renderAdmin,
};

updateAuthNav();

const queryPage = new URLSearchParams(location.search).get("page");
const routeKey = queryPage ? `/${queryPage}` : location.pathname;

(routes[routeKey] || renderHome)().catch((error) => {
  app.innerHTML = `<section class="section"><div class="card status">页面加载失败：${error.message}</div></section>`;
});
