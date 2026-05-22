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
    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{name}国际合作分析 | 合作国家、机构排行与学科热点</title>
    <meta name="description" content="查看{name}国际合作论文、合作国家、合作机构排行、学科热点和近年合作趋势。当前提供低成本公开摘要，完整数据可按需生成。" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="https://fencingai.uk/universities/{filename}" />
    <script type="application/ld+json">
      {{
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        "name": "{name}",
        "url": "https://fencingai.uk/universities/{filename}",
        "description": "{name}国际合作分析摘要，覆盖合作国家、合作机构和学科热点。"
      }}
    </script>
    <style>
      body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: linear-gradient(135deg, #eef7ff, #f7fbf9); }}
      main {{ max-width: 960px; margin: 0 auto; padding: 64px 24px; }}
      h1 {{ font-size: clamp(36px, 6vw, 64px); line-height: 1.05; margin: 0 0 20px; letter-spacing: 0; }}
      p {{ color: #4b5563; font-size: 18px; line-height: 1.8; }}
      .tag {{ display: inline-flex; gap: 10px; color: #075fc2; font-weight: 700; background: rgba(7,116,232,.1); border-radius: 999px; padding: 8px 12px; }}
      .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 36px 0; }}
      .card {{ background: rgba(255,255,255,.86); border: 1px solid rgba(148,163,184,.25); border-radius: 20px; padding: 24px; box-shadow: 0 24px 80px rgba(31,41,55,.10); }}
      .card strong {{ display:block; font-size: 22px; margin-bottom: 8px; }}
      .panel {{ margin-top: 32px; background: rgba(255,255,255,.9); border-radius: 24px; padding: 28px; }}
      a.button {{ display: inline-block; border-radius: 999px; background: #0574e8; color: #fff; padding: 14px 22px; text-decoration: none; font-weight: 700; }}
      ul {{ columns: 2; padding-left: 20px; color: #4b5563; }}
      li {{ margin: 8px 0; }}
      a {{ color: #075fc2; }}
      @media (max-width: 720px) {{ .grid {{ grid-template-columns: 1fr; }} ul {{ columns: 1; }} }}
    </style>
  </head>
  <body>
    <main>
      <a href="/">高校国际合作智析平台</a>
      <p class="tag">{region} · {category}</p>
      <h1>{name}国际合作分析</h1>
      <p>面向{name}国际合作管理与科研决策场景，先提供可被检索的公开摘要页。用户产生明确需求后，再按需生成完整合作国家、合作机构、论文样本、学科热点和对标报告。</p>
      <section class="grid">
        <div class="card"><strong>合作国家</strong><span>识别重点区域和潜力市场</span></div>
        <div class="card"><strong>合作机构</strong><span>梳理高频伙伴和维护优先级</span></div>
        <div class="card"><strong>学科热点</strong><span>发现优势方向和国际合作机会</span></div>
      </section>
      <section class="panel">
        <h2>申请生成完整分析</h2>
        <p>如果你需要{name}的完整国际合作数据，我们可以优先生成该机构的合作地图、机构排行、沉默关系和对标分析。</p>
        <p><a class="button" href="/login?institution={filename.replace('.html', '')}">申请生成{name}完整分析</a></p>
      </section>
      <h2>主流高校与科研机构</h2>
      <ul>{links}</ul>
    </main>
  </body>
</html>
"""


def write_sitemap() -> None:
    pages = [
        ("/", "1.0", "weekly"),
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
    <loc>https://fencingai.uk{path}</loc>
    <changefreq>{changefreq}</changefreq>
    <priority>{priority}</priority>
  </url>""")
    for filename, _, _, _ in INSTITUTIONS:
        urls.append(f"""  <url>
    <loc>https://fencingai.uk/universities/{filename}</loc>
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
    write_sitemap()


if __name__ == "__main__":
    main()
