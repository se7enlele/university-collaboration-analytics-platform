from pathlib import Path


INSTITUTIONS = [
    ("peking-university.html", "北京大学", "综合类高校", "北京"),
    ("tsinghua-university.html", "清华大学", "理工类高校", "北京"),
    ("fudan-university.html", "复旦大学", "综合类高校", "上海"),
    ("shanghai-jiao-tong-university.html", "上海交通大学", "综合类高校", "上海"),
    ("zhejiang-university.html", "浙江大学", "综合类高校", "浙江"),
    ("nanjing-university.html", "南京大学", "综合类高校", "江苏"),
    ("university-of-science-and-technology-of-china.html", "中国科学技术大学", "理工类高校", "安徽"),
    ("renmin-university-of-china.html", "中国人民大学", "综合类高校", "北京"),
    ("beijing-normal-university.html", "北京师范大学", "师范类高校", "北京"),
    ("beihang-university.html", "北京航空航天大学", "理工类高校", "北京"),
    ("beijing-institute-of-technology.html", "北京理工大学", "理工类高校", "北京"),
    ("harbin-institute-of-technology.html", "哈尔滨工业大学", "理工类高校", "黑龙江"),
    ("xian-jiaotong-university.html", "西安交通大学", "综合类高校", "陕西"),
    ("tianjin-university.html", "天津大学", "理工类高校", "天津"),
    ("nankai-university.html", "南开大学", "综合类高校", "天津"),
    ("southeast-university.html", "东南大学", "综合类高校", "江苏"),
    ("wuhan-university.html", "武汉大学", "综合类高校", "湖北"),
    ("hust.html", "华中科技大学", "综合类高校", "湖北"),
    ("sun-yat-sen-university.html", "中山大学", "综合类高校", "广东"),
    ("zhongshan-university.html", "中山大学", "综合类高校", "广东"),
    ("sichuan-university.html", "四川大学", "综合类高校", "四川"),
    ("shandong-university.html", "山东大学", "综合类高校", "山东"),
    ("jilin-university.html", "吉林大学", "综合类高校", "吉林"),
    ("hunan-university.html", "湖南大学", "综合类高校", "湖南"),
    ("central-south-university.html", "中南大学", "综合类高校", "湖南"),
    ("chongqing-university.html", "重庆大学", "综合类高校", "重庆"),
    ("dalian-university-of-technology.html", "大连理工大学", "理工类高校", "辽宁"),
    ("northeastern-university.html", "东北大学", "理工类高校", "辽宁"),
    ("northwestern-polytechnical-university.html", "西北工业大学", "理工类高校", "陕西"),
    ("lanzhou-university.html", "兰州大学", "综合类高校", "甘肃"),
    ("xiamen-university.html", "厦门大学", "综合类高校", "福建"),
    ("tongji-university.html", "同济大学", "综合类高校", "上海"),
    ("east-china-normal-university.html", "华东师范大学", "师范类高校", "上海"),
    ("south-china-university-of-technology.html", "华南理工大学", "理工类高校", "广东"),
    ("university-of-electronic-science-and-technology-of-china.html", "电子科技大学", "理工类高校", "四川"),
    ("china-agricultural-university.html", "中国农业大学", "农林类高校", "北京"),
    ("ocean-university-of-china.html", "中国海洋大学", "综合类高校", "山东"),
    ("minzu-university-of-china.html", "中央民族大学", "民族类高校", "北京"),
    ("northwest-af-university.html", "西北农林科技大学", "农林类高校", "陕西"),
    ("national-university-of-defense-technology.html", "国防科技大学", "理工类高校", "湖南"),
    ("beijing-jiaotong-university.html", "北京交通大学", "理工类高校", "北京"),
    ("beijing-university-of-posts-and-telecommunications.html", "北京邮电大学", "理工类高校", "北京"),
    ("beijing-university-of-chemical-technology.html", "北京化工大学", "理工类高校", "北京"),
    ("beijing-forestry-university.html", "北京林业大学", "农林类高校", "北京"),
    ("beijing-university-of-chinese-medicine.html", "北京中医药大学", "医药类高校", "北京"),
    ("capital-medical-university.html", "首都医科大学", "医药类高校", "北京"),
    ("central-university-of-finance-and-economics.html", "中央财经大学", "财经类高校", "北京"),
    ("university-of-international-business-and-economics.html", "对外经济贸易大学", "财经类高校", "北京"),
    ("china-university-of-political-science-and-law.html", "中国政法大学", "政法类高校", "北京"),
    ("communication-university-of-china.html", "中国传媒大学", "传媒类高校", "北京"),
    ("beijing-university-of-technology.html", "北京工业大学", "理工类高校", "北京"),
    ("shanghai-university.html", "上海大学", "综合类高校", "上海"),
    ("east-china-university-of-science-and-technology.html", "华东理工大学", "理工类高校", "上海"),
    ("donghua-university.html", "东华大学", "理工类高校", "上海"),
    ("shanghai-university-of-finance-and-economics.html", "上海财经大学", "财经类高校", "上海"),
    ("soochow-university.html", "苏州大学", "综合类高校", "江苏"),
    ("nanjing-university-of-aeronautics-and-astronautics.html", "南京航空航天大学", "理工类高校", "江苏"),
    ("nanjing-university-of-science-and-technology.html", "南京理工大学", "理工类高校", "江苏"),
    ("hohai-university.html", "河海大学", "理工类高校", "江苏"),
    ("jiangnan-university.html", "江南大学", "综合类高校", "江苏"),
    ("nanjing-agricultural-university.html", "南京农业大学", "农林类高校", "江苏"),
    ("nanjing-normal-university.html", "南京师范大学", "师范类高校", "江苏"),
    ("china-university-of-mining-and-technology.html", "中国矿业大学", "理工类高校", "江苏"),
    ("hefei-university-of-technology.html", "合肥工业大学", "理工类高校", "安徽"),
    ("anhui-university.html", "安徽大学", "综合类高校", "安徽"),
    ("fuzhou-university.html", "福州大学", "理工类高校", "福建"),
    ("nanchang-university.html", "南昌大学", "综合类高校", "江西"),
    ("zhengzhou-university.html", "郑州大学", "综合类高校", "河南"),
    ("china-university-of-geosciences-wuhan.html", "中国地质大学（武汉）", "理工类高校", "湖北"),
    ("wuhan-university-of-technology.html", "武汉理工大学", "理工类高校", "湖北"),
    ("huazhong-agricultural-university.html", "华中农业大学", "农林类高校", "湖北"),
    ("central-china-normal-university.html", "华中师范大学", "师范类高校", "湖北"),
    ("zhongnan-university-of-economics-and-law.html", "中南财经政法大学", "财经政法类高校", "湖北"),
    ("hunan-normal-university.html", "湖南师范大学", "师范类高校", "湖南"),
    ("jnu.html", "暨南大学", "综合类高校", "广东"),
    ("south-china-normal-university.html", "华南师范大学", "师范类高校", "广东"),
    ("guangxi-university.html", "广西大学", "综合类高校", "广西"),
    ("hainan-university.html", "海南大学", "综合类高校", "海南"),
    ("southwest-university.html", "西南大学", "综合类高校", "重庆"),
    ("southwest-jiaotong-university.html", "西南交通大学", "理工类高校", "四川"),
    ("southwestern-university-of-finance-and-economics.html", "西南财经大学", "财经类高校", "四川"),
    ("guizhou-university.html", "贵州大学", "综合类高校", "贵州"),
    ("yunnan-university.html", "云南大学", "综合类高校", "云南"),
    ("northwest-university.html", "西北大学", "综合类高校", "陕西"),
    ("xidian-university.html", "西安电子科技大学", "理工类高校", "陕西"),
    ("shaanxi-normal-university.html", "陕西师范大学", "师范类高校", "陕西"),
    ("qinghai-university.html", "青海大学", "综合类高校", "青海"),
    ("ningxia-university.html", "宁夏大学", "综合类高校", "宁夏"),
    ("xinjiang-university.html", "新疆大学", "综合类高校", "新疆"),
    ("shihezi-university.html", "石河子大学", "综合类高校", "新疆"),
    ("inner-mongolia-university.html", "内蒙古大学", "综合类高校", "内蒙古"),
    ("liaoning-university.html", "辽宁大学", "综合类高校", "辽宁"),
    ("northeast-normal-university.html", "东北师范大学", "师范类高校", "吉林"),
    ("northeast-forestry-university.html", "东北林业大学", "农林类高校", "黑龙江"),
    ("harbin-engineering-university.html", "哈尔滨工程大学", "理工类高校", "黑龙江"),
    ("northeast-agricultural-university.html", "东北农业大学", "农林类高校", "黑龙江"),
    ("hebei-university-of-technology.html", "河北工业大学", "理工类高校", "河北"),
    ("taiyuan-university-of-technology.html", "太原理工大学", "理工类高校", "山西"),
    ("china-academy-of-sciences.html", "中国科学院", "科研机构", "北京"),
    ("university-of-chinese-academy-of-sciences.html", "中国科学院大学", "科研机构", "北京"),
    ("chinese-academy-of-agricultural-sciences.html", "中国农业科学院", "科研机构", "北京"),
    ("chinese-academy-of-medical-sciences.html", "中国医学科学院", "科研机构", "北京"),
]


def render_page(filename: str, name: str, category: str, region: str, links: str) -> str:
    slug = filename.replace(".html", "")
    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{name}国际合作分析 | 合作地图、伙伴机构与学科热点</title>
    <meta name="description" content="AcadMap 面向{name}国际合作、科研管理和学科建设场景，提供合作国家、伙伴机构、学科热点、沉默关系和对标分析，支持按需生成完整报告。" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="https://acadmap.com/universities/{filename}" />
    <script type="application/ld+json">
      {{
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "{name}国际合作分析",
        "url": "https://acadmap.com/universities/{filename}",
        "description": "面向{name}的国际合作数据分析专题页，覆盖合作格局、伙伴机构、学科热点和对标报告。",
        "about": {{
          "@type": "EducationalOrganization",
          "name": "{name}",
          "address": "{region}"
        }},
        "provider": {{
          "@type": "SoftwareApplication",
          "name": "AcadMap",
          "applicationCategory": "BusinessApplication",
          "url": "https://acadmap.com/"
        }}
      }}
    </script>
    <style>
      :root {{
        --ink: #111827;
        --muted: #5f6b7a;
        --line: rgba(15, 23, 42, .10);
        --blue: #0574e8;
        --teal: #0f8b7f;
        --card: rgba(255, 255, 255, .86);
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
        color: var(--ink);
        background:
          linear-gradient(rgba(15, 23, 42, .035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(15, 23, 42, .035) 1px, transparent 1px),
          radial-gradient(circle at 10% 15%, rgba(5, 116, 232, .14), transparent 34%),
          radial-gradient(circle at 88% 8%, rgba(15, 139, 127, .13), transparent 30%),
          #f3f7fb;
        background-size: 96px 96px, 96px 96px, auto, auto, auto;
      }}
      a {{ color: var(--blue); text-decoration: none; }}
      .shell {{ max-width: 1120px; margin: 0 auto; padding: 28px 24px 72px; }}
      .nav {{
        position: sticky;
        top: 16px;
        z-index: 2;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding: 12px 18px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, .84);
        backdrop-filter: blur(18px);
        box-shadow: 0 18px 60px rgba(31, 41, 55, .09);
      }}
      .brand {{ color: var(--ink); font-weight: 800; }}
      .nav-links {{ display: flex; gap: 18px; align-items: center; font-size: 14px; }}
      .hero {{ display: grid; grid-template-columns: minmax(0, 1.1fr) 360px; gap: 32px; align-items: center; padding: 86px 0 56px; }}
      .eyebrow {{ display: inline-flex; gap: 8px; align-items: center; color: #075fc2; font-size: 13px; font-weight: 800; background: rgba(5, 116, 232, .10); border-radius: 999px; padding: 8px 12px; }}
      h1 {{ max-width: 760px; font-size: clamp(42px, 6vw, 74px); line-height: 1.04; margin: 22px 0 20px; letter-spacing: 0; }}
      .lead {{ max-width: 720px; color: #405066; font-size: 20px; line-height: 1.8; margin: 0; }}
      .actions {{ display: flex; gap: 12px; flex-wrap: wrap; margin-top: 30px; }}
      .button, .pill {{ display: inline-flex; align-items: center; justify-content: center; min-height: 46px; border-radius: 999px; padding: 0 20px; font-weight: 800; }}
      .button.primary {{ color: #fff; background: var(--blue); box-shadow: 0 14px 34px rgba(5, 116, 232, .22); }}
      .button.secondary {{ color: var(--blue); border: 1px solid rgba(5, 116, 232, .45); background: rgba(255, 255, 255, .65); }}
      .pill {{ min-height: 36px; color: #fff; background: #111827; padding: 0 16px; }}
      .hero-card {{ padding: 24px; border: 1px solid var(--line); border-radius: 28px; background: var(--card); box-shadow: 0 28px 90px rgba(31, 41, 55, .12); }}
      .hero-card h2 {{ margin: 0 0 18px; font-size: 22px; }}
      .signal {{ display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 15px 0; border-top: 1px solid var(--line); }}
      .signal:first-of-type {{ border-top: 0; }}
      .signal strong {{ font-size: 24px; color: var(--blue); }}
      .signal span {{ color: var(--muted); }}
      section {{ margin-top: 30px; }}
      .section-head {{ display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 18px; }}
      .section-head h2 {{ margin: 0; font-size: clamp(28px, 4vw, 42px); line-height: 1.15; }}
      .section-head p {{ max-width: 520px; margin: 0; color: var(--muted); line-height: 1.7; }}
      .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }}
      .card {{ min-height: 190px; padding: 24px; border: 1px solid var(--line); border-radius: 24px; background: var(--card); box-shadow: 0 24px 70px rgba(31, 41, 55, .09); }}
      .card small {{ display: inline-flex; color: var(--blue); font-weight: 800; background: rgba(5, 116, 232, .10); border-radius: 999px; padding: 6px 10px; }}
      .card h3 {{ margin: 18px 0 10px; font-size: 22px; }}
      .card p {{ margin: 0; color: var(--muted); line-height: 1.75; }}
      .split {{ display: grid; grid-template-columns: minmax(0, 1.2fr) 360px; gap: 18px; align-items: stretch; }}
      .panel {{ padding: 28px; border: 1px solid var(--line); border-radius: 28px; background: rgba(255, 255, 255, .9); box-shadow: 0 24px 70px rgba(31, 41, 55, .09); }}
      .panel h2 {{ margin: 0 0 18px; font-size: 28px; }}
      .check-list {{ display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }}
      .check-list li {{ display: grid; grid-template-columns: 24px 1fr; gap: 10px; color: #3b495c; line-height: 1.7; }}
      .check-list li::before {{ content: "✓"; color: var(--teal); font-weight: 900; }}
      .cta {{ display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center; margin-top: 34px; padding: 34px; border-radius: 30px; color: #fff; background: linear-gradient(135deg, #0b1220, #0b5aa8 58%, #0f8b7f); box-shadow: 0 30px 90px rgba(15, 23, 42, .18); }}
      .cta h2 {{ margin: 0 0 10px; font-size: clamp(28px, 4vw, 44px); }}
      .cta p {{ margin: 0; color: rgba(255, 255, 255, .78); line-height: 1.7; }}
      .cta .button {{ color: #0b1220; background: #fff; }}
      .links {{ columns: 3; padding-left: 20px; color: var(--muted); }}
      .links li {{ margin: 8px 0; break-inside: avoid; }}
      @media (max-width: 900px) {{
        .nav {{ align-items: flex-start; border-radius: 24px; }}
        .nav-links {{ flex-wrap: wrap; justify-content: flex-end; }}
        .hero, .split, .cta {{ grid-template-columns: 1fr; }}
        .grid {{ grid-template-columns: 1fr; }}
        .section-head {{ display: block; }}
        .section-head p {{ margin-top: 10px; }}
        .links {{ columns: 1; }}
      }}
      @media (max-width: 560px) {{
        .shell {{ padding: 18px 16px 54px; }}
        .nav {{ position: static; }}
        .nav-links a:not(.button) {{ display: none; }}
        .hero {{ padding-top: 52px; }}
        .cta {{ padding: 26px; }}
      }}
    </style>
  </head>
  <body>
    <div class="shell">
      <nav class="nav">
        <a class="brand" href="/">高校国际合作智析平台</a>
        <div class="nav-links">
          <a href="/map">合作格局</a>
          <a href="/universities/">高校库</a>
          <a href="/?page=dashboard">绩效驾驶舱</a>
          <a href="/institutions">机构排行</a>
          <a href="/zombies">沉默关系</a>
          <a href="/subjects">学科热力</a>
          <a href="/benchmark">对标分析</a>
          <a href="/pricing">开通权益</a>
          <a class="pill" href="/login?institution={slug}">登录 / 开通</a>
        </div>
      </nav>

      <header class="hero">
        <div>
          <span class="eyebrow">{region} · {category} · 国际合作分析</span>
          <h1>{name}国际合作该看什么，AcadMap 帮你先梳理清楚。</h1>
          <p class="lead">面向国际处、科研院和学科建设部门，把公开论文和机构数据整理成可解释的合作格局、伙伴清单、学科热点和对标结论，帮助判断资源应该投向哪里。</p>
          <div class="actions">
            <a class="button primary" href="/login?institution={slug}">申请生成{name}完整分析</a>
            <a class="button secondary" href="/map">先看平台样例</a>
          </div>
        </div>
        <aside class="hero-card">
          <h2>可生成的分析摘要</h2>
          <div class="signal"><span>合作格局维度</span><strong>4 类</strong></div>
          <div class="signal"><span>机构与国家覆盖</span><strong>按需</strong></div>
          <div class="signal"><span>交付方式</span><strong>页面+报告</strong></div>
          <div class="signal"><span>适用场景</span><strong>国际处</strong></div>
        </aside>
      </header>

      <section>
        <div class="section-head">
          <h2>{name}可以先回答的三个问题</h2>
          <p>这类页面不是简单展示学校名称，而是把潜在客户最关心的问题提前讲清楚，让用户知道完整报告能解决什么。</p>
        </div>
        <div class="grid">
          <article class="card">
            <small>合作格局</small>
            <h3>重点合作国家和区域在哪里？</h3>
            <p>从国家、地区和近年变化看合作集中度，辅助判断出访、协议复盘和资源投入方向。</p>
          </article>
          <article class="card">
            <small>伙伴机构</small>
            <h3>哪些机构值得继续维护？</h3>
            <p>把高频伙伴、低主导伙伴和沉默伙伴拆开，形成可跟进的维护优先级。</p>
          </article>
          <article class="card">
            <small>学科热点</small>
            <h3>优势学科如何形成国际影响？</h3>
            <p>结合论文主题、合作网络和对标高校，发现更适合继续放大的学科合作机会。</p>
          </article>
        </div>
      </section>

      <section class="split">
        <div class="panel">
          <h2>完整报告包含什么</h2>
          <ul class="check-list">
            <li>{name}国际合作国家/地区分布与趋势判断</li>
            <li>高频合作机构、潜在优质伙伴和沉默关系清单</li>
            <li>学科热点、论文主题和国际合作质量指标</li>
            <li>同区域、同层次高校的对标分析和可汇报结论</li>
            <li>适合年度总结、领导汇报、出访准备和合作复盘的材料</li>
          </ul>
        </div>
        <aside class="panel">
          <h2>适合谁使用</h2>
          <ul class="check-list">
            <li>国际合作处</li>
            <li>科研院/科技处</li>
            <li>学科建设办公室</li>
            <li>学院国际化负责人</li>
          </ul>
        </aside>
      </section>

      <section class="cta">
        <div>
          <h2>需要{name}的完整国际合作分析？</h2>
          <p>提交申请后，我们会优先生成该机构样例数据，并通过邮件提醒团队跟进。早期可先按需生成，不必一次性覆盖全部机构。</p>
        </div>
        <a class="button" href="/login?institution={slug}">申请生成报告</a>
      </section>

      <section class="panel">
      <h2>主流高校与科研机构</h2>
        <ul class="links">{links}</ul>
      </section>
    </div>
  </body>
</html>
"""


def render_index_page() -> str:
    cards = "\n".join(
        f"""
        <a class="school-card" href="/universities/{filename}">
          <span>{region} · {category}</span>
          <strong>{name}</strong>
          <p>查看{name}国际合作专题页，了解合作格局、伙伴机构、学科热点和完整报告申请入口。</p>
        </a>
        """
        for filename, name, category, region in INSTITUTIONS
    )
    regions = sorted({region for _, _, _, region in INSTITUTIONS})
    region_links = "".join(f'<a href="#region-{region}">{region}</a>' for region in regions)
    grouped = []
    for region in regions:
        region_cards = "\n".join(
            f'<li><a href="/universities/{filename}">{name}国际合作分析</a><span>{category}</span></li>'
            for filename, name, category, item_region in INSTITUTIONS
            if item_region == region
        )
        grouped.append(
            f"""
            <section class="region-section" id="region-{region}">
              <h2>{region}高校与机构</h2>
              <ul>{region_cards}</ul>
            </section>
            """
        )
    grouped_html = "\n".join(grouped)
    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>高校国际合作分析库 | AcadMap 学校专题入口</title>
    <meta name="description" content="AcadMap 高校国际合作分析库，按学校和地区查看高校国际合作专题页，覆盖合作国家、伙伴机构、学科热点、沉默关系和对标分析申请入口。" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="https://acadmap.com/universities/" />
    <script type="application/ld+json">
      {{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "高校国际合作分析库",
        "url": "https://acadmap.com/universities/",
        "description": "按学校和地区浏览高校国际合作分析专题页。",
        "provider": {{
          "@type": "SoftwareApplication",
          "name": "AcadMap",
          "url": "https://acadmap.com/"
        }}
      }}
    </script>
    <style>
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
        color: #111827;
        background:
          linear-gradient(rgba(15, 23, 42, .035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(15, 23, 42, .035) 1px, transparent 1px),
          radial-gradient(circle at 12% 8%, rgba(5, 116, 232, .14), transparent 34%),
          radial-gradient(circle at 86% 10%, rgba(15, 139, 127, .13), transparent 30%),
          #f3f7fb;
        background-size: 96px 96px, 96px 96px, auto, auto, auto;
      }}
      a {{ color: #0574e8; text-decoration: none; }}
      .shell {{ max-width: 1120px; margin: 0 auto; padding: 28px 24px 72px; }}
      .nav {{
        position: sticky;
        top: 16px;
        z-index: 2;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding: 12px 18px;
        border: 1px solid rgba(15, 23, 42, .10);
        border-radius: 999px;
        background: rgba(255, 255, 255, .84);
        backdrop-filter: blur(18px);
        box-shadow: 0 18px 60px rgba(31, 41, 55, .09);
      }}
      .brand {{ color: #111827; font-weight: 800; }}
      .nav-links {{ display: flex; gap: 18px; align-items: center; font-size: 14px; }}
      .hero {{ padding: 86px 0 46px; }}
      .eyebrow {{ display: inline-flex; color: #075fc2; font-size: 13px; font-weight: 800; background: rgba(5, 116, 232, .10); border-radius: 999px; padding: 8px 12px; }}
      h1 {{ max-width: 820px; font-size: clamp(42px, 6vw, 74px); line-height: 1.04; margin: 22px 0 20px; letter-spacing: 0; }}
      .lead {{ max-width: 760px; color: #405066; font-size: 20px; line-height: 1.8; margin: 0; }}
      .region-nav {{ display: flex; flex-wrap: wrap; gap: 10px; margin: 28px 0 0; }}
      .region-nav a {{ border: 1px solid rgba(5, 116, 232, .28); background: rgba(255,255,255,.72); border-radius: 999px; padding: 8px 12px; font-weight: 700; }}
      .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }}
      .school-card {{ display: block; min-height: 178px; padding: 22px; border: 1px solid rgba(15, 23, 42, .10); border-radius: 24px; background: rgba(255,255,255,.86); box-shadow: 0 24px 70px rgba(31, 41, 55, .09); }}
      .school-card span {{ display: inline-flex; color: #075fc2; font-size: 13px; font-weight: 800; background: rgba(5, 116, 232, .10); border-radius: 999px; padding: 6px 10px; }}
      .school-card strong {{ display: block; color: #111827; font-size: 24px; margin: 18px 0 10px; }}
      .school-card p {{ margin: 0; color: #5f6b7a; line-height: 1.7; }}
      .region-section {{ margin-top: 34px; padding: 28px; border: 1px solid rgba(15,23,42,.10); border-radius: 28px; background: rgba(255,255,255,.88); }}
      .region-section h2 {{ margin: 0 0 16px; font-size: 28px; }}
      .region-section ul {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 22px; margin: 0; padding: 0; list-style: none; }}
      .region-section li {{ display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid rgba(15,23,42,.08); padding-top: 12px; color: #5f6b7a; }}
      .cta {{ margin-top: 34px; padding: 34px; border-radius: 30px; color: #fff; background: linear-gradient(135deg, #0b1220, #0b5aa8 58%, #0f8b7f); }}
      .cta h2 {{ margin: 0 0 10px; font-size: 34px; }}
      .cta p {{ margin: 0 0 20px; color: rgba(255,255,255,.78); line-height: 1.7; }}
      .button, .pill {{ display: inline-flex; align-items: center; justify-content: center; min-height: 46px; border-radius: 999px; padding: 0 20px; color: #0b1220; background: #fff; font-weight: 800; }}
      .pill {{ min-height: 36px; color: #fff; background: #111827; padding: 0 16px; }}
      @media (max-width: 900px) {{ .grid, .region-section ul {{ grid-template-columns: 1fr; }} .nav {{ position: static; border-radius: 24px; align-items: flex-start; }} .nav-links {{ flex-wrap: wrap; justify-content: flex-end; }} }}
      @media (max-width: 560px) {{ .shell {{ padding: 18px 16px 54px; }} .nav-links a:not(:last-child) {{ display: none; }} .hero {{ padding-top: 52px; }} }}
    </style>
  </head>
  <body>
    <div class="shell">
      <nav class="nav">
        <a class="brand" href="/">高校国际合作智析平台</a>
        <div class="nav-links">
          <a href="/map">合作格局</a>
          <a href="/universities/">高校库</a>
          <a href="/?page=dashboard">绩效驾驶舱</a>
          <a href="/institutions">机构排行</a>
          <a href="/zombies">沉默关系</a>
          <a href="/subjects">学科热力</a>
          <a href="/benchmark">对标分析</a>
          <a href="/pricing">开通权益</a>
          <a class="pill" href="/login">登录 / 开通</a>
        </div>
      </nav>
      <header class="hero">
        <span class="eyebrow">高校国际合作分析库</span>
        <h1>从学校入口进入，快速查看国际合作分析专题。</h1>
        <p class="lead">按学校和地区浏览 AcadMap 的高校国际合作专题页。每个专题页都说明该校可生成哪些合作地图、伙伴机构、学科热点、沉默关系和对标报告。</p>
        <div class="region-nav">{region_links}</div>
      </header>
      <section class="grid">{cards}</section>
      {grouped_html}
      <section class="cta">
        <h2>没有找到目标学校？</h2>
        <p>可以直接提交学校或机构名称，我们会优先生成对应的国际合作分析样例。</p>
        <a class="button" href="/login">申请生成学校分析</a>
      </section>
    </div>
  </body>
</html>
"""


def write_sitemap() -> None:
    pages = [
        ("/", "1.0", "weekly"),
        ("/universities/", "0.9", "weekly"),
        ("/map", "0.8", "weekly"),
        ("/institutions", "0.8", "weekly"),
        ("/subjects", "0.8", "weekly"),
        ("/zombies", "0.7", "weekly"),
        ("/benchmark", "0.8", "weekly"),
        ("/pricing", "0.7", "monthly"),
    ]
    urls = []
    for path, priority, changefreq in pages:
        urls.append(f"""  <url>
    <loc>https://acadmap.com{path}</loc>
    <changefreq>{changefreq}</changefreq>
    <priority>{priority}</priority>
  </url>""")
    for filename, _, _, _ in INSTITUTIONS:
        urls.append(f"""  <url>
    <loc>https://acadmap.com/universities/{filename}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.55</priority>
  </url>""")
    Path("web/sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n",
        encoding="utf-8",
    )


def main() -> None:
    output_dir = Path("web/universities")
    output_dir.mkdir(parents=True, exist_ok=True)
    links = "".join(
        f'<li><a href="/universities/{filename}">{name}国际合作分析</a></li>'
        for filename, name, _, _ in INSTITUTIONS[:40]
    )
    for filename, name, category, region in INSTITUTIONS:
        (output_dir / filename).write_text(render_page(filename, name, category, region, links), encoding="utf-8")
    (output_dir / "index.html").write_text(render_index_page(), encoding="utf-8")
    write_sitemap()


if __name__ == "__main__":
    main()
