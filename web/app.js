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
const trackingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
const institutionLeadMap = {
  "peking-university": "北京大学",
  "tsinghua-university": "清华大学",
  "fudan-university": "复旦大学",
  "shanghai-jiao-tong-university": "上海交通大学",
  "zhejiang-university": "浙江大学",
  "nanjing-university": "南京大学",
  "university-of-science-and-technology-of-china": "中国科学技术大学",
  "shandong-university": "山东大学",
  "sichuan-university": "四川大学",
  "wuhan-university": "武汉大学",
  "zhongshan-university": "中山大学",
};

function requestedInstitution() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("institution") || "";
  return institutionLeadMap[slug] || "";
}

function captureTrackingParams() {
  const params = new URLSearchParams(window.location.search);
  const captured = {};
  trackingKeys.forEach((key) => {
    const value = params.get(key);
    if (value) captured[key] = value;
  });
  if (!Object.keys(captured).length) return;
  try {
    sessionStorage.setItem("acadmapTracking", JSON.stringify(captured));
  } catch (_) {
    // Tracking is best-effort; the lead form still works if storage is unavailable.
  }
}

function currentTrackingParams() {
  captureTrackingParams();
  try {
    return JSON.parse(sessionStorage.getItem("acadmapTracking") || "{}");
  } catch (_) {
    return {};
  }
}

function appendTracking(path) {
  const tracking = currentTrackingParams();
  if (!Object.keys(tracking).length) return path;
  const url = new URL(path, window.location.origin);
  Object.entries(tracking).forEach(([key, value]) => {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}${url.hash}`;
}

function leadSource(defaultSource) {
  const tracking = currentTrackingParams();
  if (!Object.keys(tracking).length) return defaultSource;
  const parts = trackingKeys
    .filter((key) => tracking[key])
    .map((key) => `${key}=${tracking[key]}`);
  return [defaultSource, ...parts].join(";");
}

function trackLeadEvent(eventName, details = {}) {
  const payload = {
    event_name: eventName,
    page: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    target: details.target || "",
    source: details.source || "",
    tracking: currentTrackingParams(),
    metadata: details.metadata || {},
  };
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/lead-events", blob);
    return;
  }
  fetch("/api/lead-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

document.addEventListener("click", (event) => {
  const target = event.target.closest?.("[data-lead-event]");
  if (!target) return;
  trackLeadEvent(target.dataset.leadEvent, {
    target: target.getAttribute("href") || target.getAttribute("data-target") || target.textContent.trim(),
    source: target.dataset.leadSource || "",
    metadata: {
      label: target.textContent.trim().slice(0, 80),
      location: target.dataset.leadLocation || "",
    },
  });
});

document.addEventListener("click", (event) => {
  document.querySelectorAll(".nav-more[open], .mobile-nav[open]").forEach((menu) => {
    if (!menu.contains(event.target)) menu.removeAttribute("open");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".nav-more[open], .mobile-nav[open]").forEach((menu) => menu.removeAttribute("open"));
});

function parseLeadSource(source = "") {
  const text = String(source || "");
  const parsed = { label: text || "直接申请", detail: "" };
  const parts = text.split(";").map((part) => part.trim()).filter(Boolean);
  const params = {};
  parts.forEach((part) => {
    const index = part.indexOf("=");
    if (index > 0) params[part.slice(0, index)] = part.slice(index + 1);
  });
  if (params.utm_source === "outreach") {
    parsed.label = `外联：${params.utm_content || "未知学校"}`;
    parsed.detail = [params.utm_campaign, params.utm_medium].filter(Boolean).join(" · ");
  } else if (params.utm_source === "organic_social") {
    parsed.label = `公开传播：${params.utm_medium || "未知渠道"}`;
    parsed.detail = [params.utm_campaign, params.utm_content].filter(Boolean).join(" · ");
  } else if (params.utm_source === "signature") {
    parsed.label = "邮件签名";
    parsed.detail = [params.utm_campaign, params.utm_content].filter(Boolean).join(" · ");
  } else if (params.utm_source === "sample_report") {
    parsed.label = "样例页转化";
    parsed.detail = [params.utm_campaign, params.utm_content].filter(Boolean).join(" · ");
  } else if (text.startsWith("seo:")) {
    parsed.label = `SEO：${text.replace("seo:", "")}`;
  } else if (text === "pricing") {
    parsed.label = "开通页";
  } else if (text === "pilot") {
    parsed.label = "体检页快速申请";
  }
  return parsed;
}

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

function navigateTo(path) {
  captureTrackingParams();
  history.pushState({}, "", path);
  const queryPage = new URLSearchParams(location.search).get("page");
  const routeKey = queryPage ? `/${queryPage}` : location.pathname;
  const renderer = routes[routeKey] || renderHome;
  Promise.resolve(renderer())
    .then(() => {
      if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: "start" });
    })
    .catch((error) => {
      app.innerHTML = `<section class="section"><div class="card"><p>${error.message}</p></div></section>`;
    });
}

function goToPay() {
  navigateTo("/pricing#institution-plan");
}

function goToContact() {
  navigateTo("/login");
}

function goToApp() {
  navigateTo("/");
}

function goToZombies() {
  const select = document.querySelector("#heroUniversitySelect");
  const university = select?.value || "";
  if (!university) return;
  navigateTo(`/zombies?university=${encodeURIComponent(university)}`);
}

async function loadHeroUniversities() {
  const select = document.querySelector("#heroUniversitySelect");
  if (!select) return;
  try {
    const data = await api("/api/universities");
    const universities = Array.isArray(data) ? data : data.universities || [];
    universities.forEach((item) => {
      const name = item.name || item.university || "";
      if (!name) return;
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  } catch (error) {
    select.innerHTML = `<option value="">暂无学校列表</option>`;
  }
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

function setAdminNotice(message, tone = "info") {
  sessionStorage.setItem("adminNotice", JSON.stringify({ message, tone }));
}

function adminNoticeMarkup() {
  const raw = sessionStorage.getItem("adminNotice");
  if (!raw) return "";
  sessionStorage.removeItem("adminNotice");
  try {
    const notice = JSON.parse(raw);
    return `<div class="admin-notice ${notice.tone || "info"}">${notice.message || ""}</div>`;
  } catch {
    return "";
  }
}

function friendlyAdminError(error) {
  const message = error?.message || "";
  if (message.includes("OpenAlex") || message.includes("api.openalex.org") || message.includes("503") || message.includes("502")) {
    return "OpenAlex 数据源暂时不可用。系统已经按队列机制处理，请稍后查看任务日志。";
  }
  return message || "操作失败，请稍后重试。";
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
  return lockedCard();
}

function lockedCard() {
  return `
    <div class="acadmap-locked-card">
      <div class="acadmap-locked-icon">🔒</div>
      <p class="acadmap-locked-title">此功能需要开通国际处专业版</p>
      <p class="acadmap-locked-desc">解锁完整伙伴清单、沉默关系名单、对标报告和图表导出</p>
      <button class="button acadmap-btn acadmap-btn-primary" type="button" onclick="navigateTo('/pricing#institution-plan')">
        申请国际处演示
      </button>
      <p class="acadmap-locked-note">提交后 1-2 个工作日完成配置，试点学校可优先开通</p>
    </div>
  `;
}

function withUniversity(path) {
  if (!currentUser) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}university=${encodeURIComponent(selectedUniversity)}`;
}

function withUniversityAlways(path) {
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
  const slots = document.querySelectorAll("#authNav, #authNavMobile");
  if (!slots.length) return;
  if (!currentUser) {
    slots.forEach((slot) => {
      const location = slot.id === "authNavMobile" ? "mobile_nav" : "top_nav";
      slot.innerHTML = `
      <a class="acadmap-nav-btn acadmap-nav-login" href="/login" data-lead-event="nav_login_click" data-lead-source="nav" data-lead-location="${location}">登录</a>
      <a class="acadmap-nav-btn acadmap-nav-trial" href="/pricing" data-lead-event="nav_trial_click" data-lead-source="nav" data-lead-location="${location}">免费试用</a>
    `;
    });
    return;
  }
  const paid = currentUser.status === "active" || currentUser.plan === "institution";
  slots.forEach((slot) => {
    slot.innerHTML = paid
      ? `<a class="acadmap-nav-user" href="/login">${currentUser.name || currentUser.phone}</a>`
      : `<a class="acadmap-nav-btn acadmap-nav-upgrade" href="/pricing#institution-plan">申请专业版</a>`;
  });
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
  document.body.classList.toggle("admin-mode", Boolean(options.admin));
  const sectionClass = ["section", options.pageClass || ""].filter(Boolean).join(" ");
  app.innerHTML = `
    <section class="${sectionClass}">
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
  loadHeroUniversities();
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
    <a class="card module-card" href="` + href + `">
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

function bindFinderForm() {
  const form = document.querySelector("#finderForm");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const keyword = document.querySelector("#finderKeyword").value.trim() || "人工智能";
    history.pushState({}, "", `/finder?keyword=${encodeURIComponent(keyword)}`);
    renderFinderWorkbench();
  });
}

function scenarioCard(title, copy, action, href) {
  return `
    <a class="card scenario-card" href="` + href + `">
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

function priceCard(name, price, target, features, highlighted = false, options = {}) {
  const buttonClass = options.buttonClass || (highlighted ? "acadmap-btn-primary" : "acadmap-btn-outline-blue");
  const buttonText = options.buttonText || "申请开通";
  const buttonAction = options.buttonAction || "goToContact()";
  const cardId = options.id ? ` id="${options.id}"` : "";
  const priceCompare = options.priceCompare || "";
  const priceMarkup = highlighted && priceCompare
    ? `
      <div class="acadmap-price-anchor">
        <span class="acadmap-price-main">${price}</span>
        <p class="acadmap-price-compare">${priceCompare}</p>
      </div>
    `
    : `<strong class="price">${price}</strong>`;
  return `
    <div class="card price-card ${highlighted ? "featured" : ""}"${cardId}>
      <span class="tag">${target}</span>
      <h3>${name}</h3>
      ${priceMarkup}
      <ul>
        ${features.map((item) => `<li>${item}</li>`).join("")}
      </ul>
      <button class="button acadmap-btn ${buttonClass}" type="button" onclick="${buttonAction}">${buttonText}</button>
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
  document.body.classList.remove("admin-mode");
  app.innerHTML = `
    <nav class="home-rail" aria-label="首页章节导航">
      <a class="active" href="#home-hero">概览</a>
      <a href="#home-workflows">场景</a>
      <a href="#home-pi">线索</a>
      <a href="#home-universities">高校</a>
      <a href="#home-modules">能力</a>
      <a href="#home-access">开通</a>
    </nav>
    <section class="acadmap-hero-section" id="home-hero">
      <h1 class="acadmap-hero-title">
        您的学校有多少国际合作关系，<br>已经沉默超过 2 年？
      </h1>
      <p class="acadmap-hero-subtitle">
        大多数国际处不知道这个数字。AcadMap 可以告诉你。
      </p>
      <div class="acadmap-hero-demo">
        <select id="heroUniversitySelect" class="acadmap-hero-select" aria-label="选择学校查看沉默关系">
          <option value="">选择一所学校，立即查看 →</option>
        </select>
        <button class="button acadmap-btn acadmap-btn-primary" type="button" onclick="goToZombies()" data-lead-event="home_hero_zombies_click" data-lead-source="home" data-lead-location="home_hero">免费查看沉默关系</button>
        <a class="button secondary acadmap-hero-sample-link" href="/sample-report.html?utm_source=home&utm_medium=site&utm_campaign=first_customer_202607&utm_content=home-hero-sample" data-lead-event="home_hero_sample_report_click" data-lead-source="home" data-lead-location="home_hero">查看样例报告</a>
      </div>
      <p class="acadmap-hero-note">无需注册，先看公开概况；样例报告展示 10-15 页体验报告结构。</p>
    </section>
    <div class="acadmap-trust-bar">
      <div class="acadmap-trust-item">
        <span class="acadmap-trust-number">147+</span>
        <span class="acadmap-trust-label">双一流高校数据</span>
      </div>
      <div class="acadmap-trust-item">
        <span class="acadmap-trust-number">OpenAlex</span>
        <span class="acadmap-trust-label">国际开放学术数据源</span>
      </div>
      <div class="acadmap-trust-item">
        <span class="acadmap-trust-number">10年</span>
        <span class="acadmap-trust-label">历史合作数据</span>
      </div>
      <div class="acadmap-trust-item">
        <span class="acadmap-trust-number">1-2天</span>
        <span class="acadmap-trust-label">试点账号配置周期</span>
      </div>
    </div>
    <section class="section" id="home-workflows">
      <h2 class="section-title">不是临时报告，而是日常工作入口。</h2>
      <p class="section-copy">围绕国际处最常见的工作场景组织数据：出访准备、伙伴维护、领导汇报和高校对标。</p>
      <div class="scenario-grid">
        ${scenarioCard("出访前查对象", "快速了解目标机构与本校的合作历史、优势学科和近年活跃度。", "查看合作机构", "/institutions")}
        ${scenarioCard("年终证明成效", "用合著规模、覆盖国家、活跃伙伴和学科分布支撑国际化工作汇报。", "查看合作格局", "/map")}
        ${scenarioCard("发现待维护关系", "识别多年没有新成果但仍有历史价值的合作机构，判断是否重新激活。", "查看伙伴维护", "/zombies")}
        ${scenarioCard("对标兄弟高校", "比较同层级高校的合作规模、国家覆盖和伙伴网络，找到差距与机会。", "进入对标分析", "/benchmark")}
      </div>
    </section>
    <section class="section split-section" id="home-pi">
      <div class="split-copy">
        <span class="tag">国际处工作台 / 高潜学者</span>
        <h2 class="section-title">把合作机会拆到重点方向、重点伙伴和具体线索。</h2>
        <p class="section-copy">国际处不仅需要看学校全局，也需要知道哪些方向值得推进、哪些海外学者和机构可以优先跟进。AcadMap 会把开放学术数据整理成可复核的合作线索。</p>
      </div>
      <div class="mini-grid">
        <div class="card mini-card">
          <strong>重点方向识别</strong>
          <p>围绕重点学科查看主题趋势、活跃国家和高产机构，先判断方向是否值得投入。</p>
        </div>
        <div class="card mini-card">
          <strong>高潜学者识别</strong>
          <p>按主题相关度、合作网络和引用表现筛选潜在线索，支持国际处和学院共同复核。</p>
        </div>
        <div class="card mini-card">
          <strong>汇报素材沉淀</strong>
          <p>沉淀中外双方基础对比、代表论文和合作图表，用于出访准备、年度总结和专题汇报。</p>
        </div>
      </div>
    </section>
    <section class="section" id="home-universities">
      <h2 class="section-title">按学校查看国际合作分析。</h2>
      <p class="section-copy">如果你已经有明确学校，可以先进入对应专题页，查看该校适合生成哪些合作地图、伙伴机构、学科热点和对标报告。</p>
      <div class="scenario-grid">
        ${scenarioCard("北京大学国际合作分析", "查看北大合作国家、伙伴机构和完整报告申请入口。", "查看专题页", "/universities/peking-university.html")}
        ${scenarioCard("清华大学国际合作分析", "面向国际处和科研管理场景，梳理可生成的合作洞察。", "查看专题页", "/universities/tsinghua-university.html")}
        ${scenarioCard("山东大学国际合作分析", "结合当前样例数据，查看学校专题分析和申请入口。", "查看专题页", "/universities/shandong-university.html")}
        ${scenarioCard("浏览全部高校专题", "按地区、学校类型和机构名称进入更多高校国际合作分析页。", "进入高校库", "/universities/")}
      </div>
    </section>
    <section class="section" id="home-modules">
      <h2 class="section-title">先免费看到轮廓，再解锁完整细节。</h2>
      <p class="section-copy">公开页面先展示国家、机构、学科和对标的宏观结果；具体机构名单、历史明细、导出报告和后台权限在登录后开放。</p>
      <div class="grid">
        ${moduleCard("合作格局", "国家、机构与论文成果覆盖。", "/map")}
        ${moduleCard("绩效驾驶舱", "形成面向领导汇报的指标看板。", "/?page=dashboard")}
        ${moduleCard("机构排行", "识别核心伙伴与潜力机构。", "/institutions")}
        ${moduleCard("伙伴维护", "找出长期无新成果但值得复盘的合作伙伴。", "/zombies")}
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
          <span>伙伴维护与机会发现</span>
          <p>识别重点伙伴、低质量合作和长期无新成果的关系，形成可跟进的维护清单。</p>
        </div>
        <div class="card revenue-card">
          <strong>导入数据</strong>
          <span>Excel / CSV 授权分析</span>
          <p>支持试点导入学校已有合作清单，与公开学术数据匹配后进行仅本机构可见的分析。</p>
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

async function renderFinder() {
  const params = new URLSearchParams(location.search);
  const keyword = params.get("keyword") || "人工智能";
  const [payload, universities] = await Promise.all([
    api(withUniversityAlways(`/api/collaborators?limit=12&keyword=${encodeURIComponent(keyword)}`)),
    loadUniversities(),
  ]);
  const candidates = payload.items || [];
  const summary = payload.summary || {};
  const top = candidates[0] || {};
  shell(
    "高潜学者",
    "面向国际处和科研管理场景，围绕重点学科识别潜在合作学者、代表论文和可跟进理由。",
    `
      <div class="finder-hero">
        <div>
          <span class="tag">国际处合作线索</span>
          <h2>输入一个重点方向，先找到值得复核的合作线索。</h2>
          <p>基于样例库中的公开论文和合作机构数据，优先返回方向相关、近年活跃、平均影响力较高的候选机构。</p>
        </div>
        <form class="finder-form" id="finderForm">
          <label>研究方向 / 关键词</label>
          <div class="input-action">
            <input id="finderKeyword" value="${keyword}" placeholder="例如：人工智能、材料科学、公共卫生" />
            <button class="button" type="submit">生成合作线索</button>
          </div>
        </form>
      </div>
      <div class="kpis">
        ${kpiCard(fmt(summary.candidates || candidates.length), "候选合作线索", 1)}
        ${kpiCard(summary.top_country || "-", "优先国家/地区", 2, "green")}
        ${kpiCard(summary.top_topic || keyword || "-", "相关主题", 3)}
        ${kpiCard(currentUser ? "已登录" : "公开预览", "当前权限", 4, "green")}
      </div>
      <div class="decision-panel">
        <div class="decision-main">
          <span class="tag">推荐判断</span>
          <h2>${top.institution ? `${top.institution} 可以优先进入复核清单。` : "输入方向后生成候选合作线索。"}</h2>
        </div>
        <div class="decision-judgment">
          <strong>为什么推荐</strong>
          <p>${top.reason || "系统会结合方向匹配、合作论文数量、近年活跃度和平均被引表现进行排序。"}</p>
        </div>
        <div class="decision-actions">
          <strong>下一步</strong>
          <ol>
            <li>确认代表论文是否与重点方向匹配</li>
            <li>筛选 3-5 个机构或学者进入跟进名单</li>
            <li>导出图表用于出访准备或专题汇报</li>
          </ol>
        </div>
      </div>
      <div class="finder-grid">
        ${candidates
          .map(
            (item, index) => `
              <article class="card finder-card">
                <div class="finder-card-head">
                  <span class="tag">推荐 ${index + 1}</span>
                  <strong>${item.score || 0}</strong>
                </div>
                <h3>${item.institution}</h3>
                <p class="muted">${item.country || "-"} · ${item.topic || keyword}</p>
                <div class="mini-metrics">
                  <span><b>${fmt(item.papers)}</b>合作论文</span>
                  <span><b>${item.avg_cited || 0}</b>平均被引</span>
                  <span><b>${item.last_year || "-"}</b>最近合作</span>
                </div>
                <p>${item.reason}</p>
                <div class="paper-snippet">
                  <small>代表论文</small>
                  <span>${item.representative_title || "暂无代表论文标题"}</span>
                </div>
                <em>${item.action}</em>
              </article>
            `
          )
          .join("")}
      </div>
      ${unlockCard("解锁完整高潜学者能力", ["查看更多候选学者和机构线索", "按国家、机构类型和近年活跃度筛选", "导出汇报图表和跟进清单", "生成面向国际处的合作线索简报"])}
    `,
    { universities }
  );
  bindSchoolSelector();
  bindFinderForm();
}

async function renderFinderWorkbench() {
  const params = new URLSearchParams(location.search);
  const keyword = params.get("keyword") || "人工智能";
  const [payload, universities] = await Promise.all([
    api(withUniversityAlways(`/api/collaborators?limit=12&keyword=${encodeURIComponent(keyword)}`)),
    loadUniversities(),
  ]);
  const candidates = payload.items || [];
  const summary = payload.summary || {};
  const top = candidates[0] || {};
  const hasResults = candidates.length > 0;
  const isFallback = Boolean(summary.fallback);
  const scope = currentUser ? selectedUniversity : "公开样例库";
  const statusText = isFallback
    ? `“${keyword}”暂未直接命中，先展示 ${scope} 的高活跃合作对象`
    : hasResults
      ? `已在 ${scope} 中找到 ${fmt(summary.matched_works || 0)} 篇相关合作论文`
      : `暂未在 ${scope} 中找到可推荐对象`;
  const resultRows = hasResults
    ? candidates
        .map(
          (item, index) => `
            <article class="finder-row">
              <div class="finder-rank">${index + 1}</div>
              <div class="finder-main">
                <div class="finder-title-line">
                  <h3>${item.institution}</h3>
                  <span>${item.country || "未标注国家"}</span>
                </div>
                <p>${item.reason}</p>
                <div class="evidence-line">
                  <span>代表论文</span>
                  <strong>${item.representative_title || "暂无代表论文标题"}</strong>
                </div>
              </div>
              <div class="finder-evidence">
                <span><b>${fmt(item.papers)}</b>合作论文</span>
                <span><b>${item.lead_rate || 0}%</b>主导率</span>
                <span><b>${item.avg_cited || 0}</b>平均被引</span>
                <span><b>${item.last_year || "-"}</b>最近合作</span>
              </div>
              <div class="finder-next">
                <strong>建议动作</strong>
                <p>${item.action}</p>
                <button class="button secondary" type="button">加入候选清单</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="card finder-empty">
        <strong>没有直接匹配结果</strong>
        <p>这通常说明当前样例库覆盖还不够，或者关键词过窄。可以先换成上位学科词，例如“材料科学”“物理”“公共卫生”，再逐步缩小方向。</p>
      </div>`;

  shell(
    "高潜学者",
    "把重点方向转成可跟进的合作线索清单，先看证据，再决定是否纳入工作计划。",
    `
      <div class="finder-workbench">
        <section class="finder-query-panel">
          <div>
            <span class="tag">检索任务</span>
            <h2>先确定方向，再生成候选合作线索</h2>
            <p>系统会按“论文匹配、合作频次、影响力、近年活跃度”排序，输出可复核的机构和学者线索。</p>
          </div>
          <form class="finder-form compact" id="finderForm">
            <label>研究方向 / 关键词</label>
            <div class="input-action">
              <input id="finderKeyword" value="${keyword}" placeholder="例如：人工智能、材料科学、公共卫生" />
              <button class="button" type="submit">重新检索</button>
            </div>
          </form>
        </section>

        <section class="finder-status-panel">
          <div class="status-copy">
            <span class="tag">匹配状态</span>
            <h3>${statusText}</h3>
            <p>${isFallback ? "这些不是关键词的直接命中结果，而是用于预览系统能力的真实合作数据。你可以换成更上位的学科词继续检索。" : hasResults ? `当前展示前 ${fmt(candidates.length)} 个候选对象。完整版本可继续下钻到作者、论文、学院和联系记录。` : "建议先扩大关键词，再用候选机构进入人工复核。"}</p>
          </div>
          <div class="finder-metrics">
            <span><b>${fmt(summary.matched_works || 0)}</b>相关合作论文</span>
            <span><b>${fmt(summary.matched_institutions || 0)}</b>匹配机构</span>
            <span><b>${fmt(summary.matched_countries || 0)}</b>国家/地区</span>
            <span><b>${summary.year_range || "-"}</b>数据年份</span>
          </div>
        </section>

        <section class="finder-flow">
          <div class="flow-step active"><b>1</b><span>输入方向</span></div>
          <div class="flow-step active"><b>2</b><span>匹配论文与机构</span></div>
          <div class="flow-step ${hasResults ? "active" : ""}"><b>3</b><span>复核证据</span></div>
          <div class="flow-step"><b>4</b><span>进入跟进计划</span></div>
        </section>

        ${hasResults ? `<section class="finder-recommendation">
          <div>
            <span class="tag">优先建议</span>
            <h3>${top.institution} 可先进入人工复核</h3>
            <p>${top.reason}</p>
          </div>
          <div class="recommendation-actions">
            <a class="button" href="/institutions">查看机构质量</a>
            <a class="button secondary" href="/pricing">导出清单</a>
          </div>
        </section>` : ""}

        <section class="finder-results">
          <div class="section-label">
            <div>
              <span class="tag">候选列表</span>
              <h3>按可行动优先级排序</h3>
            </div>
            <p>每一行都保留推荐依据，方便国际处、学院和科研管理部门共同复核。</p>
          </div>
          ${resultRows}
        </section>

        ${unlockCard("解锁完整高潜学者能力", ["查看更多候选学者和机构线索", "按国家、机构类型和近年活跃度筛选", "导出汇报图表和跟进清单", "生成面向国际处的合作线索简报"])}
      </div>
    `,
    { universities }
  );
  bindSchoolSelector();
  bindFinderForm();
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


function renderPilotReport() {
  const guideHref = appendTracking("/topics/guoji-hezuo-tijian-baogao.html");
  shell(
    "国际合作关系体检报告",
    "先用公开学术数据生成 10-15 页轻量报告，帮助国际处判断哪些合作值得维护、复盘或重新激活。",
    `
      <section class="pilot-hero">
        <div>
          <span class="tag">首期试点</span>
          <h2>先买一份报告，不必立刻采购完整系统。</h2>
          <p>适合年度国际化总结、出访准备、合作协议复盘和学科建设汇报。第一步不要求学校提供内部数据，可先基于公开学术数据生成样例。</p>
          <div class="actions">
            <a class="button" href="#quick-apply" data-lead-event="pilot_hero_apply_click" data-lead-source="pilot" data-lead-location="pilot_hero">申请生成本校样例</a>
            <a class="button secondary" href="/sample-report.html" data-lead-event="pilot_sample_report_click" data-lead-source="pilot" data-lead-location="pilot_hero">查看样例结构</a>
            <a class="button secondary" href="mailto:hello@acadmap.com?subject=申请AcadMap国际合作关系体检报告样例" data-lead-event="pilot_mailto_click" data-lead-source="pilot" data-lead-location="pilot_hero">直接邮件咨询</a>
            <a class="button secondary" href="` + guideHref + `">阅读完整说明</a>
            <a class="button secondary" href="/universities/">查看高校专题页</a>
          </div>
        </div>
        <div class="card pilot-price-card">
          <span class="tag">建议试点价</span>
          <strong>¥1,999 - ¥4,999</strong>
          <p>首客体验报告 + 30 分钟线上解读。后续开通国际处专业版时可抵扣。</p>
        </div>
      </section>
      <section class="section">
        <h2 class="section-title">报告解决什么问题？</h2>
        <div class="scenario-grid">
          ${scenarioCard("活跃伙伴", "识别近几年仍有合作成果的国家、机构和重点方向。", "查看合作格局", "/map")}
          ${scenarioCard("沉默关系", "找出超过 2 年没有新增成果但历史上有合作基础的伙伴。", "查看沉默关系", "/zombies")}
          ${scenarioCard("机构分层", "把合作机构分成核心伙伴、低主导关系、高潜伙伴和待激活对象。", "查看机构排行", "/institutions")}
          ${scenarioCard("汇报材料", "形成适合年度总结、出访准备和合作协议复盘的一页结论。", "申请样例", "#quick-apply")}
        </div>
      </section>
      <section class="section split-section">
        <div class="split-copy">
          <span class="tag">交付内容</span>
          <h2 class="section-title">10-15 页报告 + 30 分钟解读。</h2>
          <p class="section-copy">试点报告先验证管理价值，再决定是否接入学校内部 Excel/CSV 合作清单或开通持续更新的国际处工作台。</p>
        </div>
        <div class="mini-grid">
          <div class="card mini-card"><strong>合作概览</strong><p>合作论文规模、合作国家覆盖、合作机构数量和近年趋势。</p></div>
          <div class="card mini-card"><strong>伙伴治理</strong><p>合作机构排行、沉默关系样例和可跟进的维护清单。</p></div>
          <div class="card mini-card"><strong>对标建议</strong><p>与同类型高校比较合作规模、国家覆盖和伙伴网络。</p></div>
          <a class="card mini-card" href="/sample-report.html"><strong>样例结构</strong><p>先查看 10-15 页体验报告通常包含哪些页面和管理结论。</p></a>
        </div>
      </section>
      <section class="section commercial-section">
        <div class="commercial-copy">
          <span class="tag">适合部门</span>
          <h2 class="section-title">国际处、科研院和学科建设办公室都能使用。</h2>
          <p class="section-copy">报告不替代正式评价，但适合做趋势判断、合作格局复盘和下一步资源投向讨论。</p>
        </div>
        <div class="revenue-grid">
          <div class="card revenue-card"><strong>国际合作处</strong><span>协议复盘 / 出访准备</span><p>快速判断哪些关系值得维护、激活或重新谈判。</p></div>
          <div class="card revenue-card"><strong>科研院</strong><span>论文产出 / 质量分析</span><p>从国际合作论文看合作规模、主导性和质量风险。</p></div>
          <div class="card revenue-card"><strong>学科建设</strong><span>方向选择 / 对标</span><p>把学科热点、合作网络和标杆高校放在同一框架里比较。</p></div>
          <div class="card revenue-card"><strong>校领导汇报</strong><span>一页结论</span><p>把分散数据整理成可汇报、可讨论、可行动的管理建议。</p></div>
        </div>
        <div class="actions">
          <a class="button" href="#quick-apply" data-lead-event="pilot_bottom_apply_click" data-lead-source="pilot" data-lead-location="pilot_bottom">申请本校体检报告</a>
          <a class="button secondary" href="mailto:hello@acadmap.com?subject=申请AcadMap国际合作关系体检报告样例" data-lead-event="pilot_mailto_click" data-lead-source="pilot" data-lead-location="pilot_bottom">邮件联系 AcadMap</a>
          <a class="button secondary" href="/pricing#institution-plan" data-lead-event="pilot_pricing_click" data-lead-source="pilot" data-lead-location="pilot_bottom">了解专业版</a>
        </div>
      </section>
      <section class="section acadmap-pilot-lead-section" id="quick-apply">
        <div class="acadmap-pilot-lead-copy">
          <span class="tag">快速申请</span>
          <h2 class="section-title">先看一页样例，再决定是否做完整报告。</h2>
          <p class="section-copy">填写学校和联系方式即可。我们会先判断是否适合生成公开数据样例，不要求上传内部数据。</p>
          <div class="acadmap-pilot-lead-points">
            <span>1 个工作日内回复</span>
            <span>先给一页样例或沟通建议</span>
            <span>适合国际处、科研院、学科建设部门</span>
          </div>
        </div>
        <form class="acadmap-pilot-lead-form" id="pilotLeadForm">
          <label>学校 / 机构名称</label>
          <input id="pilotLeadOrg" name="organization" placeholder="例如：山东大学" />
          <div class="acadmap-pilot-form-grid">
            <div>
              <label>联系人（可选）</label>
              <input id="pilotLeadName" name="name" placeholder="便于称呼，可不填" />
            </div>
            <div>
              <label>部门 / 职务（可选）</label>
              <input id="pilotLeadRole" name="role" placeholder="例如：国际合作处" value="国际合作处" />
            </div>
          </div>
          <label>联系方式</label>
          <input id="pilotLeadContact" name="contact" placeholder="手机号 / 邮箱 / 微信" />
          <label>主要关注场景</label>
          <textarea id="pilotLeadMessage" name="message" rows="3" placeholder="例如：年度总结、合作伙伴维护、出访准备、科研合作绩效、同类高校对标"></textarea>
          <button class="button acadmap-pilot-lead-submit" type="submit">申请一页样例</button>
          <p class="acadmap-pilot-form-note">提交后仅用于安排样例沟通，不会公开展示您的联系信息。</p>
        </form>
      </section>
    `
  );
  bindPilotLeadForm();
}

function bindPilotLeadForm() {
  const form = document.querySelector("#pilotLeadForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type='submit']");
    const organization = document.querySelector("#pilotLeadOrg")?.value.trim() || "";
    const name = document.querySelector("#pilotLeadName")?.value.trim() || "";
    const role = document.querySelector("#pilotLeadRole")?.value.trim() || "";
    const contact = document.querySelector("#pilotLeadContact")?.value.trim() || "";
    const message = document.querySelector("#pilotLeadMessage")?.value.trim() || "";
    if (!organization || !contact) {
      alert("请填写学校和联系方式，便于我们提供样例。");
      return;
    }
    trackLeadEvent("pilot_lead_form_submit", {
      source: "pilot",
      metadata: {
        organization,
        has_name: Boolean(name),
        has_role: Boolean(role),
        has_message: Boolean(message),
      },
    });
    button.disabled = true;
    button.textContent = "提交中";
    try {
      await postApi("/api/access-requests", {
        phone: currentUser?.phone || contact,
        name: name || "未留姓名",
        organization,
        role: role || "未填写",
        message: [
          "用户在 /pilot 申请国际合作关系体检报告一页样例",
          message ? `需求：${message}` : "",
        ].filter(Boolean).join("\n"),
        source: leadSource("pilot"),
        lead_status: "new",
      });
      form.innerHTML = `
        <div class="acadmap-pilot-lead-success">
          <span class="tag">已提交</span>
          <h3>申请已收到。</h3>
          <p>我们会根据学校和使用场景判断是否适合生成公开数据样例，并尽快通过您留下的联系方式回复。</p>
          <a class="button secondary" href="/topics/guoji-hezuo-tijian-baogao.html">继续查看完整说明</a>
        </div>
      `;
    } catch (error) {
      button.disabled = false;
      button.textContent = "申请一页样例";
      alert(error.message);
    }
  });
}
function renderLogin() {
  const leadInstitution = requestedInstitution();
  const signupInstitution = leadInstitution || selectedUniversity;
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
                  <input id="loginPhone" type="tel" inputmode="tel" placeholder="请输入手机号" />
                  <label>验证码</label>
                  <div class="input-action">
                    <input id="loginCode" inputmode="numeric" placeholder="请输入验证码" />
                    <button type="button" id="sendCodeBtn">获取验证码</button>
                  </div>
                  <button class="button auth-submit" type="submit">登录工作台</button>
                </form>
                <div class="auth-divider"><span>机构开通</span></div>
                <form class="signup-panel" id="signupForm">
                  <label>学校 / 机构名称</label>
                  <input id="signupOrg" placeholder="请输入学校或机构名称" value="${signupInstitution}" />
                  <label>联系人</label>
                  <input id="signupName" placeholder="请输入联系人姓名" />
                  <label>职务 / 部门</label>
                  <input id="signupRole" placeholder="例如：国际合作处、科研院、学院办公室" value="国际合作处" />
                  <label>联系方式</label>
                  <input id="signupContact" placeholder="手机号 / 邮箱 / 微信，便于我们联系演示" />
                  <label>想先解决的问题</label>
                  <textarea id="signupMessage" rows="3" placeholder="例如：想查看本校沉默合作关系、年度国际合作绩效报告、同类高校对标等"></textarea>
                  <button class="button secondary auth-submit" type="submit">申请国际处演示</button>
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
    "国际处专业版",
    "从公开概览到学校国际处工作台，围绕沉默关系、伙伴治理、绩效驾驶舱和对标报告逐步开通。",
    `
      <div class="decision-panel pricing-decision">
        <div class="decision-main">
          <span class="tag">适用场景</span>
          <h2>公开版负责判断是否有价值，专业版负责形成管理动作。</h2>
          <p>公开页面用于了解学校合作格局；开通后查看完整名单、具体论文、导出图表和报告，并可管理团队权限。</p>
        </div>
        <div class="decision-judgment">
          <strong>开通后获得</strong>
          <p>完整机构名单、伙伴维护清单、高潜学者线索、学院和学科下钻、对标报告、报告导出和团队权限。</p>
        </div>
        <div class="decision-actions">
          <strong>建议使用方式</strong>
          <ol>
            <li>先用公开页面查看学校沉默关系和合作概况</li>
            <li>申请演示，确认学校、部门和汇报场景</li>
            <li>开通全校数据、报告模板和团队权限</li>
          </ol>
        </div>
      </div>
      <div class="pricing-grid">
        ${priceCard("免费版", "¥0", "公开概览", ["合作国家地图概览", "合作机构排行 Top5", "沉默关系仅显示数量", "公开数据免费查看"], false, {
          buttonText: "立即免费使用",
          buttonClass: "acadmap-btn-outline-gray",
          buttonAction: "goToApp()",
        })}
        ${priceCard("报告体验版", "申请试用", "单校/单部门试点", ["完整合作机构 Top50", "沉默关系样例清单", "基础对标图表", "单份报告导出"], false, {
          buttonText: "申请试用",
          buttonClass: "acadmap-btn-outline-blue",
          buttonAction: "goToContact()",
        })}
        ${priceCard("国际处专业版", "申请开通", "学校/学院/管理部门", ["全校合作数据配置", "多账号团队权限", "对标分析与报告", "绩效驾驶舱支持"], true, {
          id: "institution-plan",
          buttonText: "申请国际处演示",
          buttonClass: "acadmap-btn-primary acadmap-btn-lg",
          buttonAction: "goToContact()",
          priceCompare: "面向高校国际处、科研院和学科建设部门，按学校和使用范围配置",
        })}
      </div>
      <table class="acadmap-feature-table">
        <thead>
          <tr>
            <th>功能</th>
            <th>免费版</th>
            <th class="acadmap-pi-column">报告体验版</th>
            <th>国际处专业版</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>合作国家地图（概览）</td><td><span class="acadmap-check">✓</span></td><td><span class="acadmap-check">✓</span></td><td><span class="acadmap-check">✓</span></td></tr>
          <tr><td>合作机构排行（完整）</td><td>仅 Top5</td><td><span class="acadmap-check">✓</span></td><td><span class="acadmap-check">✓</span></td></tr>
          <tr><td>沉默关系识别（完整名单）</td><td>仅显示数量</td><td><span class="acadmap-cross">×</span></td><td><span class="acadmap-check">✓</span></td></tr>
          <tr><td>高潜学者与合作线索</td><td><span class="acadmap-cross">×</span></td><td><span class="acadmap-check">✓</span></td><td><span class="acadmap-check">✓</span></td></tr>
          <tr><td>图表导出（PNG/CSV）</td><td><span class="acadmap-cross">×</span></td><td><span class="acadmap-check">✓</span></td><td><span class="acadmap-check">✓</span></td></tr>
          <tr><td>对标分析（多校横向对比）</td><td><span class="acadmap-cross">×</span></td><td><span class="acadmap-cross">×</span></td><td><span class="acadmap-check">✓</span></td></tr>
          <tr><td>绩效驾驶舱 + 一键报告</td><td><span class="acadmap-cross">×</span></td><td><span class="acadmap-cross">×</span></td><td><span class="acadmap-check">✓</span></td></tr>
          <tr><td>多账号与团队权限管理</td><td><span class="acadmap-cross">×</span></td><td><span class="acadmap-cross">×</span></td><td><span class="acadmap-check">✓</span></td></tr>
        </tbody>
      </table>
      <div class="grid two">
        <div class="card">
          <h3>开通后可以解决什么</h3>
          <ul class="business-list">
            <li>减少国际处手工整理论文、机构、国家和学院数据的时间。</li>
            <li>把合作协议和历史关系整理成可维护、可复盘、可汇报的清单。</li>
            <li>帮助国际处围绕重点学科找到高潜学者、代表论文和跟进理由。</li>
            <li>支持年度总结、双一流建设、领导汇报、出访计划和合作项目申报。</li>
          </ul>
        </div>
        <div class="card">
          <h3>适合哪些角色使用</h3>
          <ul class="business-list">
            <li>国际合作处：伙伴维护、出访准备、协议复盘。</li>
            <li>科研院/科技处：国际论文产出、项目布局、质量评估。</li>
            <li>学院/学科建设部门：重点方向识别、高潜学者复核、汇报素材整理。</li>
            <li>学科建设办公室：学科国际影响力和标杆高校对比。</li>
          </ul>
        </div>
      </div>
      <div class="card recommendation">
        <span class="tag">数据导入与合规</span>
        <h3>学校已有 Excel/CSV 合作数据，可以作为试点接入。</h3>
        <p>导入数据仅用于本用户或本机构授权分析，可做字段映射、DOI/标题匹配和公开学术数据融合；不公开展示、不转售，用户可要求删除原始数据和派生结果。</p>
      </div>
      <div class="card recommendation">
        <span class="tag">申请说明</span>
        <h3>提交申请后，我们会根据学校和使用部门确认开通范围。</h3>
        <p>如果需要用于年度总结、专题汇报或同类高校对标，可以在申请时说明具体场景，便于优先配置相应的数据视图和报告模板。</p>
      </div>
      <section class="acadmap-pricing-faq">
        <h2>常见问题</h2>
        <div class="acadmap-faq-list">
          <article class="acadmap-faq-item">
            <h3>Q：数据来源是哪里，准确度如何？</h3>
            <p>A：数据来自 OpenAlex 国际开放学术数据库，收录全球主要高校的国际合作论文，每季度更新。适合趋势分析和合作格局判断，不适合作为正式评估的唯一依据。</p>
          </article>
          <article class="acadmap-faq-item">
            <h3>Q：报告体验版和国际处专业版有什么区别？</h3>
            <p>A：报告体验版适合先验证单校或单部门的分析价值；国际处专业版覆盖全校数据、支持多人账号、对标报告、绩效驾驶舱和持续更新，适合学校层面管理和汇报。</p>
          </article>
          <article class="acadmap-faq-item">
            <h3>Q：申请后多久可以使用？</h3>
            <p>A：提交学校名称、使用部门和主要场景后，通常 1-2 个工作日内完成演示环境或试点账号配置。</p>
          </article>
          <article class="acadmap-faq-item">
            <h3>Q：国际处专业版为什么要申请？</h3>
            <p>A：专业版涉及全校数据配置和多账号管理，需确认学校名称和使用场景，通常 1-2 个工作日内完成开通。</p>
          </article>
        </div>
      </section>
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
      sendCodeBtn.textContent = "获取验证码";
      sendCodeBtn.disabled = true;
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const phone = document.querySelector("#loginPhone").value.trim();
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
  const leadInstitution = requestedInstitution();

  if (sendCodeBtn) {
    sendCodeBtn.addEventListener("click", async () => {
      const phone = document.querySelector("#loginPhone").value.trim();
      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = "发送中";
      try {
        const result = await postApi("/api/auth/send-code", { phone });
        const code = result.debug_code || "";
        sendCodeBtn.textContent = code ? "测试码已生成" : "已发送";
        if (code && window.location.hostname === "127.0.0.1") document.querySelector("#loginCode").value = code;
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
          phone: document.querySelector("#loginPhone").value.trim(),
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
      const contact = document.querySelector("#signupContact")?.value.trim() || "";
      const customMessage = document.querySelector("#signupMessage")?.value.trim() || "";
      const organization = document.querySelector("#signupOrg").value.trim() || selectedUniversity;
      const role = document.querySelector("#signupRole").value.trim();
      const name = document.querySelector("#signupName").value.trim();
      if (!organization || !name || !role || !contact) {
        alert("请填写学校、联系人、部门和联系方式，便于我们安排演示。");
        return;
      }
      try {
        const result = await postApi("/api/access-requests", {
          phone: currentUser?.phone || contact,
          name,
          organization,
          role,
          message: [
            leadInstitution ? `用户申请生成 ${leadInstitution} 完整国际合作分析` : "用户申请国际处演示",
            customMessage ? `需求：${customMessage}` : "",
          ].filter(Boolean).join("\n"),
          source: leadSource(leadInstitution ? `seo:${leadInstitution}` : "pricing"),
          lead_status: "new",
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
  document.body.classList.add("admin-mode");
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
      `,
      { admin: true, pageClass: "admin-page admin-login-page" }
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
    const requests = requestsData.requests || [];
    const users = usersData.users || [];
    const sources = dataStatus.sources || [];
    const jobs = dataStatus.jobs || [];
    const pendingRequests = requests.filter((item) => item.status === "pending");
    const openRequests = requests.filter((item) => item.status === "approved");
    const activeUsers = users.filter((item) => item.status === "active");
    const failedJobs = jobs.filter((item) => item.status === "failed");
    const priority = { pending: 0, approved: 1, rejected: 3 };
    const sortedRequests = [...requests].sort((a, b) => {
      const statusRank = (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
      if (statusRank) return statusRank;
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
    app.innerHTML = `
      <section class="admin-shell">
        <aside class="admin-sidebar">
          <a class="admin-brand" href="/">AcadMap</a>
          <nav>
            <a href="#admin-leads" class="active">开通线索</a>
            <a href="#admin-users">用户账户</a>
            <a href="#admin-data">数据接入</a>
            <a href="#admin-jobs">任务日志</a>
          </nav>
          <button class="admin-logout" id="adminLogoutBtn">退出后台</button>
        </aside>
        <main class="admin-main">
          <header class="admin-header">
            <div>
              <h1>管理后台</h1>
              <p>线索、用户、数据任务集中处理。</p>
            </div>
            <div class="admin-header-actions">
              <a class="button secondary" href="/login">前台登录页</a>
              <a class="button secondary" href="/pricing">开通权益页</a>
            </div>
          </header>
          <div class="admin-metrics">
            ${adminMetric("待审核", pendingRequests.length, "需要今天处理", "red")}
            ${adminMetric("已开通申请", openRequests.length, "可继续转化", "green")}
            ${adminMetric("注册用户", users.length, "全部账户", "blue")}
            ${adminMetric("数据异常", failedJobs.length, "失败任务", failedJobs.length ? "red" : "green")}
          </div>
          ${adminNoticeMarkup()}
          <section class="admin-panel admin-panel-large" id="admin-leads">
            <div class="admin-panel-head">
              <div>
                <h3>开通线索</h3>
                <p>按状态、来源和处理动作快速推进。</p>
              </div>
              <span>${fmt(requests.length)} 条</span>
            </div>
            ${adminRequestsTable(sortedRequests)}
          </section>
          <div class="admin-secondary-grid">
            <section class="admin-panel" id="admin-users">
              <div class="admin-panel-head">
                <div>
                  <h3>用户账户</h3>
                  <p>查看注册与开通状态。</p>
                </div>
                <span>${fmt(activeUsers.length)} active</span>
              </div>
              ${adminUsersTable(users)}
            </section>
            <section class="admin-panel" id="admin-jobs">
              <div class="admin-panel-head">
                <div>
                  <h3>任务日志</h3>
                  <p>最近数据任务状态。</p>
                </div>
                <span>${fmt(jobs.length)} 条</span>
              </div>
              ${adminJobsTable(jobs)}
            </section>
          </div>
          <section class="admin-panel" id="admin-data">
            <div class="admin-panel-head">
              <div>
                <h3>数据源状态</h3>
                <p>学校样本、原始数据和处理结果。</p>
              </div>
              <span>${fmt(sources.length)} 个数据源</span>
            </div>
            ${adminSourcesTable(sources)}
          </section>
        </main>
      </section>
    `;
    updateAuthNav();
    initPageEffects();
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
      `,
      { admin: true, pageClass: "admin-page admin-login-page" }
    );
    bindAdminLogin();
  }
}

function adminMetric(label, value, hint, tone = "blue") {
  return `
    <div class="admin-metric ${tone}">
      <span>${label}</span>
      <strong>${fmt(value)}</strong>
      <small>${hint}</small>
    </div>
  `;
}

function adminRequestsTable(requests) {
  if (!requests.length) return `<p class="muted">暂无开通申请。</p>`;
  const leadLabels = {
    new: "新线索",
    contacted: "已联系",
    data_ready: "已生成数据",
    converted: "已转化",
    abandoned: "已放弃",
  };
  const statusLabels = {
    pending: "待审核",
    approved: "已通过",
    rejected: "已拒绝",
    active: "已开通",
    trial: "试用",
  };
  return `
    <div class="admin-table-wrap">
      <table class="admin-table leads">
        <thead>
          <tr>
            <th>机构/联系人</th>
            <th>来源</th>
            <th>状态</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${requests
            .map(
              (item) => {
                const source = parseLeadSource(item.source);
                const statusText = statusLabels[item.status] || item.status || "-";
                const leadText = leadLabels[item.lead_status] || item.lead_status || "新线索";
                return `
                <tr>
                  <td>
                    <strong>${item.organization || "-"}</strong>
                    <span>${item.name || "-"} · ${item.role || "-"}</span>
                    <small>${item.phone || "-"}</small>
                  </td>
                  <td>
                    <span>${source.label}</span>
                    ${source.detail ? `<small>${source.detail}</small>` : ""}
                    <small>${item.created_at || ""}</small>
                  </td>
                  <td>
                    <em class="status-badge ${item.status}">${statusText}</em>
                    <small>${leadText}</small>
                  </td>
                  <td>
                    <span class="admin-message">${item.message || "-"}</span>
                    ${item.followup_note ? `<small>备注：${item.followup_note}</small>` : ""}
                  </td>
                  <td>
                    <select class="admin-action-select" data-id="${item.id}">
                      <option value="">选择操作</option>
                      ${item.status === "pending" ? `<option value="approve">通过申请</option><option value="reject">拒绝申请</option>` : ""}
                      <option value="contacted">标记已联系</option>
                      <option value="generate-request-data">生成数据</option>
                      <option value="converted">标记已转化</option>
                      <option value="abandoned">标记放弃</option>
                    </select>
                  </td>
                </tr>
              `;
              }
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function adminUsersTable(users) {
  if (!users.length) return `<p class="muted">暂无用户。</p>`;
  return `
    <div class="admin-mini-list">
      ${users
        .slice(0, 8)
        .map(
          (item) => `
            <div class="admin-mini-row">
              <div>
                <strong>${item.name || item.phone}</strong>
                <span>${item.organization || "-"} · ${item.role || "-"}</span>
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
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>学校</th>
            <th>检索名</th>
            <th>原始数据</th>
            <th>已处理</th>
            <th>最后采集</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${sources
            .map(
              (item) => `
                <tr>
                  <td><strong>${item.university}</strong></td>
                  <td>${item.search_name || "-"}</td>
                  <td>${fmt(item.raw_count)}</td>
                  <td>${fmt(item.work_count)}</td>
                  <td>${item.last_fetched_at || "未采集"}</td>
                  <td><em class="status-badge ${item.status}">${item.status}</em></td>
                  <td><div class="admin-actions"><button data-action="refresh-data" data-university="${item.university}">刷新</button></div></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function adminJobsTable(jobs) {
  if (!jobs.length) return `<p class="muted">暂无数据任务。</p>`;
  return `
    <div class="admin-mini-list">
      ${jobs
        .slice(0, 12)
        .map((item) => {
          const retryText = Number(item.retry_count || 0) > 0 ? ` · retry ${item.retry_count}/${item.max_attempts || 5}` : "";
          const nextText = item.next_run_at ? ` · next ${item.next_run_at}` : "";
          return `
            <div class="admin-mini-row">
              <div>
                <strong>${item.university}</strong>
                <span>${item.job_type} · raw ${fmt(item.raw_count)} · processed ${fmt(item.processed_count)}${retryText}</span>
                <small>${item.error || item.finished_at || item.updated_at || item.created_at || ""}${nextText}</small>
              </div>
              <em class="status-badge ${item.status}">${item.status}</em>
            </div>
          `;
        })
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
  document.querySelectorAll(".admin-action-select[data-id]").forEach((select) => {
    select.addEventListener("change", async () => {
      const id = Number(select.dataset.id);
      const value = select.value;
      if (!value) return;
      select.disabled = true;
      if (["contacted", "converted", "abandoned"].includes(value)) {
        try {
          await adminApi("/api/admin/access-requests/lead-status", {
            method: "POST",
            body: JSON.stringify({ id, lead_status: value }),
          });
          renderAdminConsole();
        } catch (error) {
          select.disabled = false;
          select.value = "";
          alert(error.message);
        }
        return;
      }
      if (value === "generate-request-data") {
        try {
          await adminApi("/api/admin/access-requests/generate-data", {
            method: "POST",
            body: JSON.stringify({ id, limit_per_university: 200 }),
          });
          setAdminNotice("数据生成任务已加入队列。OpenAlex 临时不可用时，系统会自动重试，不需要重复点击。", "success");
          renderAdminConsole();
        } catch (error) {
          select.disabled = false;
          select.value = "";
          alert(friendlyAdminError(error));
        }
        return;
      }
      const path = value === "approve" ? "/api/admin/access-requests/approve" : "/api/admin/access-requests/reject";
      try {
        await adminApi(path, { method: "POST", body: JSON.stringify({ id }) });
        renderAdminConsole();
      } catch (error) {
        select.disabled = false;
        select.value = "";
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
        setAdminNotice("刷新任务已加入队列。任务日志会显示 pending、retry、success 或 failed 状态。", "success");
        renderAdminConsole();
      } catch (error) {
        button.disabled = false;
        button.textContent = "刷新";
        alert(friendlyAdminError(error));
      }
    });
  });
}

const routes = {
  "/": renderHome,
  "/map": renderMap,
  "/finder": renderFinderWorkbench,
  "/dashboard": renderDashboard,
  "/performance": renderDashboard,
  "/institutions": renderInstitutions,
  "/zombies": renderZombies,
  "/subjects": renderSubjects,
  "/benchmark": renderBenchmark,
  "/pricing": renderPricing,
  "/pilot": renderPilotReport,
  "/login": renderLogin,
  "/admin": renderAdminConsole,
};

captureTrackingParams();
updateAuthNav();

const queryPage = new URLSearchParams(location.search).get("page");
const routeKey = queryPage ? `/${queryPage}` : location.pathname;

(routes[routeKey] || renderHome)()
  .then(() => {
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: "start" });
  })
  .catch((error) => {
    app.innerHTML = `<section class="section"><div class="card status">页面加载失败：${error.message}</div></section>`;
  });
