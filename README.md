# 高校国际合作智析平台 V2.0

面向高校国际处、科研管理人员和院校管理者的一站式国际合作数据分析平台。项目包含静态 SEO 首页、Streamlit 数据应用、OpenAlex 数据抓取、SQLite 缓存、MySQL 用户和支付审核系统。

## 本地运行

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

## 服务器更新

项目改为 Git 部署后，服务器执行：

```bash
cd /var/www/project
bash deploy.sh
```

## 数据初始化

```bash
python -m data.fetch_openalex
python -m data.process_data
```

## 环境变量

生产环境请通过环境变量覆盖 `config.py` 中的默认值：`MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD`、`ALIYUN_ACCESS_KEY_ID`、`ADMIN_PASSWORD`、`SMTP_USER` 等。
