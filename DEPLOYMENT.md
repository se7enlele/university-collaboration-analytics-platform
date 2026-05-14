# 阿里云轻量服务器部署说明

服务器信息按当前截图记录：

- 地域：中国香港
- 系统：Ubuntu 24.04
- 公网 IP：47.83.144.162
- 内网 IP：172.21.60.137
- 规格：2 vCPU / 2 GiB / 40 GiB ESSD

## 需要先准备

1. 在阿里云控制台设置服务器登录密码，或绑定 SSH 密钥。
2. 域名解析到 `47.83.144.162`。如果暂时没有域名，可先用公网 IP 访问静态首页。
3. 在阿里云安全组/防火墙放行 `22`、`80`、`443`。
4. 生产环境变量：MySQL、短信、SMTP、管理员密码、支付宝二维码图片。

## 推荐部署方式

把项目推到 Git 仓库后，在服务器执行：

```bash
export REPO_URL="https://github.com/your-org/your-repo.git"
export DOMAIN="your-domain.com"
bash setup.sh
```

`setup.sh` 会安装 Python、Nginx、依赖包，注册 `streamlit-app.service`，并把 Streamlit 反代到 `/app`。

## 上线后常用命令

```bash
sudo systemctl status streamlit-app
sudo journalctl -u streamlit-app -f
sudo nginx -t
sudo systemctl reload nginx
```

## 数据初始化

```bash
cd /var/www/project
source .venv/bin/activate
python -m data.fetch_openalex
python -m data.process_data
sudo systemctl restart streamlit-app
```

## 当前还不能自动完成的部分

需要 SSH 登录信息后，才能直接进入服务器执行安装。请提供以下任一方式：

- SSH 用户名和密码
- SSH 用户名和私钥文件路径
- 阿里云控制台远程连接的一次性登录方式
