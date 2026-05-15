const app = document.querySelector("#app");
const nf = new Intl.NumberFormat("zh-CN");

async function api(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`API failed: ${path}`);
  return response.json();
}

function fmt(value, suffix = "") {
  const number = Number(value || 0);
  return `${nf.format(number)}${suffix}`;
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
  if (!rows.length) return `<div class="card status">当前数据正在准备中，完成数据接入后将自动展示。</div>`;
  return `
    <table class="table">
      <thead><tr>${columns.map((col) => `<th>${col.label}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${columns.map((col) => `<td>${col.format ? col.format(row[col.key], row) : row[col.key] ?? ""}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;
}

async function renderHome() {
  const overview = await api("/api/overview");
  app.innerHTML = `
    <section class="section hero">
      <div>
        <p class="eyebrow">University Collaboration Intelligence Platform</p>
        <h1>看清高校国际合作格局，找到真正值得投入的合作关系</h1>
        <p class="lead">从论文合作、机构质量、学科热度和多校对标出发，把分散的科研合作数据整理成可解释、可比较、可行动的决策视图。</p>
        <div class="actions">
          <a class="button" href="/map">查看合作地图</a>
          <a class="button secondary" href="/benchmark">进入对标分析</a>
        </div>
        <div class="kpis">
          <div class="kpi"><strong>${fmt(overview.international_papers)}</strong><span>国际合作论文</span></div>
          <div class="kpi"><strong>${fmt(overview.countries)}</strong><span>合作国家/地区</span></div>
          <div class="kpi"><strong>${fmt(overview.institutions)}</strong><span>合作机构</span></div>
          <div class="kpi"><strong>${overview.lead_rate || 0}%</strong><span>本校主导率</span></div>
        </div>
      </div>
    </section>
    <section class="section">
      <h2 class="section-title">从公开浏览到深度决策。</h2>
      <p class="section-copy">正式平台不再受 Streamlit 页面布局限制，前台展示价值，登录后承载完整数据、导出和后台管理。</p>
      <div class="grid">
        ${moduleCard("合作地图", "国家覆盖、合作机构和论文列表预览。", "/map")}
        ${moduleCard("机构排行", "识别核心伙伴、沉默伙伴和高质量机构。", "/institutions")}
        ${moduleCard("学科热力", "发现国际合作中的高热学科方向。", "/subjects")}
        ${moduleCard("对标分析", "跨校比较合作规模、机构覆盖和主导率。", "/benchmark")}
        ${moduleCard("账号开通", "导出、完整名单和后台管理按需登录。", "/login")}
        ${moduleCard("管理后台", "审核付费申请和管理用户状态。", "/admin")}
      </div>
    </section>
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

async function renderMap() {
  const [overview, data] = await Promise.all([api("/api/overview"), api("/api/map")]);
  shell(
    "全球合作地图",
    "查看国际合作国家、机构覆盖和论文规模。",
    `
      <div class="kpis">
        <div class="kpi"><strong>${fmt(overview.international_papers)}</strong><span>国际合作论文</span></div>
        <div class="kpi"><strong>${fmt(overview.countries)}</strong><span>合作国家/地区</span></div>
        <div class="kpi"><strong>${fmt(overview.institutions)}</strong><span>合作机构</span></div>
        <div class="kpi"><strong>${overview.lead_rate || 0}%</strong><span>本校主导率</span></div>
      </div>
      <div class="card"><div id="worldMap" class="chart"></div></div>
    `
  );

  const chart = echarts.init(document.querySelector("#worldMap"));
  chart.setOption({
    tooltip: { trigger: "item", formatter: (p) => `${p.name}<br/>论文数：${fmt(p.value || 0)}` },
    visualMap: {
      min: 0,
      max: Math.max(...data.map((item) => item.papers), 1),
      left: 18,
      bottom: 18,
      text: ["高", "低"],
      calculable: true,
      inRange: { color: ["#dbeafe", "#60a5fa", "#005bb8"] },
    },
    series: [
      {
        type: "map",
        map: "world",
        roam: true,
        nameProperty: "name",
        itemStyle: { borderColor: "#cbd5e1" },
        emphasis: { label: { show: false } },
        data: data.map((item) => ({ name: item.name, value: item.papers })),
      },
    ],
  });
  window.addEventListener("resize", () => chart.resize());
}

async function renderInstitutions() {
  const rows = await api("/api/institutions?limit=30");
  shell(
    "合作机构排行",
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
  shell("学科热力", "查看国际合作论文集中在哪些学科领域。", `<div class="card"><div id="subjects" class="chart small"></div></div>`);
  const chart = echarts.init(document.querySelector("#subjects"));
  chart.setOption({
    tooltip: {},
    grid: { left: 140, right: 20, top: 20, bottom: 30 },
    xAxis: { type: "value" },
    yAxis: { type: "category", data: data.map((item) => item.domain).reverse() },
    series: [{ type: "bar", data: data.map((item) => item.papers).reverse(), itemStyle: { color: "#006edb", borderRadius: [0, 8, 8, 0] } }],
  });
  window.addEventListener("resize", () => chart.resize());
}

async function renderBenchmark() {
  const rows = await api("/api/benchmark");
  shell(
    "多校对标分析",
    "比较高校国际合作规模、机构覆盖和主导能力。",
    `<div class="card">${table(rows, [
      { label: "学校", key: "university" },
      { label: "论文总数", key: "papers", format: fmt },
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
    "首页、地图和公开分析先直接查看；导出、完整数据和后台管理再登录。",
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
  shell("管理后台", "用于付费审核、用户状态和运营管理。", `<div class="card form"><label>管理员密码</label><input type="password" /><div class="actions"><button class="button">进入后台</button></div></div>`);
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
