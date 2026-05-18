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

function emptyState() {
  return `<div class="card status">当前数据正在接入中，完成后将展示完整分析结果。</div>`;
}

function table(rows, columns) {
  if (!rows.length) return emptyState();
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
      <div class="kpi"><strong>${big(overview.papers)}</strong><span>全球科研论文与成果</span></div>
      <div class="kpi"><strong>${big(overview.international_papers)}</strong><span>国际合作论文</span></div>
      <div class="kpi"><strong>${fmt(overview.universities)}</strong><span>国内高校与科研机构</span></div>
      <div class="kpi"><strong>${big(overview.institutions)}</strong><span>全球合作机构</span></div>
    </div>
  `;
}

function sampleKpis(overview) {
  return `
    <div class="kpis">
      <div class="kpi"><strong>${fmt(overview.sample_international_papers || overview.international_papers)}</strong><span>样例国际合作论文</span></div>
      <div class="kpi"><strong>${fmt(overview.sample_countries || overview.countries)}</strong><span>样例合作国家/地区</span></div>
      <div class="kpi"><strong>${fmt(overview.sample_institutions || overview.institutions)}</strong><span>样例合作机构</span></div>
      <div class="kpi"><strong>${overview.lead_rate || 0}%</strong><span>样例主导率</span></div>
    </div>
  `;
}

function moduleCard(title, copy, href) {
  return `
    <a class="card module-card" href="${href}">
      <span class="tag">平台模块</span>
      <h3>${title}</h3>
      <p>${copy}</p>
      <p class="muted">进入页面</p>
    </a>
  `;
}

async function renderHome() {
  const overview = await api("/api/overview");
  app.innerHTML = `
    <section class="section hero">
      <div>
        <p class="eyebrow">National Research Collaboration Intelligence</p>
        <h1>面向中国高校与科研机构的国际合作智能决策平台</h1>
        <p class="lead">覆盖全球论文成果、合作机构、学科方向与跨校对标数据，帮助高校看清国际合作格局，识别高价值伙伴，形成可执行的合作策略。</p>
        <div class="actions">
          <a class="button" href="/map">查看合作格局</a>
          <a class="button secondary" href="/benchmark">进入对标分析</a>
        </div>
        ${platformKpis(overview)}
      </div>
    </section>
    <section class="section">
      <h2 class="section-title">从全国视角，定位每所学校的合作机会。</h2>
      <p class="section-copy">平台面向高校国际处、科研管理部门、学院和科研机构，提供合作态势、机构质量、学科热点、低效合作识别和多校对标分析。</p>
      <div class="grid">
        ${moduleCard("合作格局", "查看国家覆盖、合作机构分布和论文成果规模。", "/map")}
        ${moduleCard("机构排行", "识别核心伙伴、潜力机构和长期沉默合作关系。", "/institutions")}
        ${moduleCard("学科热力", "发现国际合作中的优势学科与增长方向。", "/subjects")}
        ${moduleCard("对标分析", "跨校比较合作规模、机构覆盖和主导能力。", "/benchmark")}
        ${moduleCard("账号开通", "完整数据、导出报告和深度分析按需开通。", "/login")}
        ${moduleCard("管理后台", "管理用户权限、数据接入和付费审核。", "/admin")}
      </div>
    </section>
  `;
}

async function renderMap() {
  const [overview, data] = await Promise.all([api("/api/overview"), api("/api/map")]);
  const top = data.slice(0, 12);
  const max = Math.max(...top.map((item) => item.papers), 1);
  shell(
    "合作格局",
    "查看样例数据中的国际合作国家、机构覆盖和论文规模。",
    `
      ${sampleKpis(overview)}
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
          <h3>合作覆盖</h3>
          <p class="muted">当前样例库已识别 ${fmt(overview.sample_countries || overview.countries)} 个合作国家/地区，覆盖 ${fmt(overview.sample_institutions || overview.institutions)} 个合作机构。</p>
          <p class="muted">全量接入后，可按学校、学院、学科、国家和机构进行多维筛选与穿透分析。</p>
        </div>
      </div>
    `
  );
}

async function renderInstitutions() {
  const rows = await api("/api/institutions?limit=30");
  shell(
    "机构排行",
    "识别高频合作机构、国家分布和近年合作状态。",
    `<div class="card">${table(rows, [
      { label: "机构", key: "institution" },
      { label: "国家", key: "country" },
      { label: "论文数", key: "papers", format: fmt },
      { label: "平均被引", key: "avg_cited" },
      { label: "最后合作年份", key: "last_year" },
    ])}</div>`
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
    "首页、合作格局和公开分析先直接查看；导出、完整数据和后台管理再登录。",
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
