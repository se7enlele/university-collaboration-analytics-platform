const app = document.querySelector("#app");
const nf = new Intl.NumberFormat("zh-CN");

async function api(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`API failed: ${path}`);
  return response.json();
}

function fmt(value) {
  return nf.format(Number(value || 0));
}

function big(value) {
  const number = Number(value || 0);
  if (number >= 100000000) return `${(number / 100000000).toFixed(number % 100000000 === 0 ? 0 : 1)}亿+`;
  if (number >= 10000) return `${(number / 10000).toFixed(number % 10000 === 0 ? 0 : 1)}万+`;
  return fmt(number);
}

function shell(title, copy, content) {
  app.innerHTML = `
    <section class="section">
      <h1 class="section-title">${title}</h1>
      <p class="section-copy">${copy}</p>
      ${content}
    </section>
  `;
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
    return await api("/api/collaboration");
  } catch (_) {
    const [countries, institutions] = await Promise.all([api("/api/map"), api("/api/institutions?limit=10")]);
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
  if ((item.papers || 0) >= maxPapers * 0.55 && (item.avg_cited || 0) >= 70) return "战略核心";
  if ((item.papers || 0) >= maxPapers * 0.35) return "高频合作";
  if ((item.avg_cited || 0) >= 90) return "高影响力";
  if ((item.last_year || 0) < 2023) return "需重新激活";
  return "潜力观察";
}

function buildInstitutionAnalysis(rows) {
  const list = rows || [];
  const maxPapers = Math.max(...list.map((item) => item.papers || 0), 1);
  const countries = new Set(list.map((item) => item.country).filter(Boolean));
  const avgCited = list.length ? list.reduce((sum, item) => sum + Number(item.avg_cited || 0), 0) / list.length : 0;
  const active = list.filter((item) => (item.last_year || 0) >= 2024).length;
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
    tierCounts,
    countriesRank,
    insights: [
      { title: "核心伙伴明确", text: `${top.institution || "头部机构"} 是当前样例库中合作频次最高的机构，合作论文 ${fmt(top.papers)} 篇。` },
      { title: "合作质量可分层", text: `已按频次、影响力和活跃度将机构划分为战略核心、高频合作、高影响力和潜力观察。` },
      { title: "近期活跃度可追踪", text: `${active} 个机构在 2024 年后仍保持合作记录，可优先纳入持续维护清单。` },
      { title: "国家分布可辅助决策", text: `Top 机构覆盖 ${countries.size} 个国家/地区，可结合国家战略和学科方向制定访问计划。` },
    ],
  };
}

async function renderHome() {
  const overview = await api("/api/overview");
  app.innerHTML = `
    <section class="section hero">
      <div class="hero-panel">
        <p class="eyebrow">National Research Collaboration Intelligence</p>
        <h1>中国高校国际合作智能决策平台</h1>
        <p class="lead">看清合作格局，识别高价值伙伴，形成可执行的国际合作策略。</p>
        <div class="actions">
          <a class="button" href="/map">查看合作格局</a>
          <a class="button secondary" href="/benchmark">进入对标分析</a>
        </div>
        ${platformKpis(overview)}
      </div>
    </section>
    <section class="section">
      <h2 class="section-title">全国视角，服务每所学校。</h2>
      <p class="section-copy">覆盖合作态势、机构质量、学科热点和多校对标，支持高校国际处与科研管理部门快速判断合作机会。</p>
      <div class="grid">
        ${moduleCard("合作格局", "国家、机构与论文成果覆盖。", "/map")}
        ${moduleCard("机构排行", "识别核心伙伴与潜力机构。", "/institutions")}
        ${moduleCard("学科热力", "发现优势学科和增长方向。", "/subjects")}
        ${moduleCard("对标分析", "比较合作规模、覆盖和主导能力。", "/benchmark")}
        ${moduleCard("账号开通", "解锁完整数据与导出报告。", "/login")}
        ${moduleCard("管理后台", "管理用户、权限与数据接入。", "/admin")}
      </div>
    </section>
  `;
}

async function renderMap() {
  const [overview, analysis] = await Promise.all([api("/api/overview"), loadCollaborationAnalysis()]);
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
                          <small>${fmt(item.countries)} 国 / ${fmt(item.institutions)} 机构</small>
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
    `
  );
}

async function renderInstitutions() {
  const rows = await api("/api/institutions?limit=50");
  const analysis = buildInstitutionAnalysis(rows);
  const tierEntries = Object.entries(analysis.tierCounts);
  const countryTop = analysis.countriesRank.slice(0, 8);
  const countryMax = Math.max(...countryTop.map((item) => item.papers), 1);
  shell(
    "机构排行",
    "识别核心伙伴、合作质量和机构维护优先级。",
    `
      <div class="kpis">
        <div class="kpi"><strong>${fmt(rows.length)}</strong><span>样例合作机构</span></div>
        <div class="kpi"><strong>${fmt(analysis.countries)}</strong><span>覆盖国家/地区</span></div>
        <div class="kpi"><strong>${analysis.avgCited}</strong><span>平均被引</span></div>
        <div class="kpi"><strong>${fmt(analysis.active)}</strong><span>近年活跃机构</span></div>
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
          <h3>机构质量分层</h3>
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
          { label: "平均被引", key: "avg_cited" },
          { label: "最近年份", key: "last_year" },
          { label: "质量标签", key: "tier" },
        ])}
      </div>
      <div class="card recommendation">
        <span class="tag">行动建议</span>
        <h3>把机构排行转化为伙伴维护清单。</h3>
        <p>优先维护“战略核心”和“高影响力”机构；对“需重新激活”的机构结合学院、学科和历史项目复盘，判断是否恢复访问、联合申报或学生交流合作。</p>
      </div>
    `
  );
}

async function renderSubjects() {
  const data = await api("/api/subjects?limit=12");
  const max = Math.max(...data.map((item) => item.papers), 1);
  shell(
    "学科热力",
    "查看国际合作论文集中在哪些学科领域。",
    `
      <div class="card">
        <div class="bar-list">
          ${data
            .map(
              (item) => `
                <div class="bar-row">
                  <span>${item.domain}</span>
                  <div class="bar-track"><div class="bar-fill green" style="width:${(item.papers / max) * 100}%"></div></div>
                  <strong>${fmt(item.papers)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `
  );
}

async function renderBenchmark() {
  const rows = await api("/api/benchmark");
  shell(
    "多校对标分析",
    "基于样例数据比较高校国际合作规模、机构覆盖和主导能力。",
    `<div class="card">${table(rows, [
      { label: "学校", key: "university" },
      { label: "样例论文数", key: "papers", format: fmt },
      { label: "国际合作论文", key: "international_papers", format: fmt },
      { label: "合作国家", key: "countries", format: fmt },
      { label: "合作机构", key: "institutions", format: fmt },
      { label: "主导率", key: "lead_rate", format: (value) => `${value || 0}%` },
    ])}</div>`
  );
}

function renderLogin() {
  shell(
    "账号只在需要时出现。",
    "公开分析先直接查看；导出、完整数据和后台管理再登录。",
    `
      <div class="card form">
        <label>手机号</label>
        <input placeholder="请输入手机号" />
        <label>验证码</label>
        <input placeholder="请输入验证码" />
        <div class="actions"><button class="button">登录</button></div>
      </div>
    `
  );
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
  "/institutions": renderInstitutions,
  "/subjects": renderSubjects,
  "/benchmark": renderBenchmark,
  "/login": renderLogin,
  "/admin": renderAdmin,
};

(routes[location.pathname] || renderHome)().catch((error) => {
  app.innerHTML = `<section class="section"><div class="card status">页面加载失败：${error.message}</div></section>`;
});
