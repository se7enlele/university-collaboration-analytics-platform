# 服务器部署执行步骤

当前服务器：

- 公网 IP：`47.83.144.162`
- 登录用户：`admin`
- 系统：Ubuntu 24.04 LTS
- 推荐项目目录：`/var/www/project`

## 方式一：本地上传项目后在服务器安装

在本地 PowerShell 执行：

```powershell
scp -r C:\Users\admin\Documents\Codex\2026-05-14\v2-0-ppt-19-9-2 admin@47.83.144.162:/home/admin/project
```

输入服务器密码后，回到阿里云 Web 终端执行：

```bash
sudo mkdir -p /var/www/project
sudo rsync -a --delete /home/admin/project/ /var/www/project/
sudo chown -R admin:admin /var/www/project
cd /var/www/project
chmod +x setup.sh
DOMAIN=47.83.144.162 bash setup.sh
```

完成后访问：

```text
http://47.83.144.162/
http://47.83.144.162/app
```

## 方式二：先推到 Git 仓库，再由服务器拉取

在服务器执行：

```bash
export REPO_URL="https://github.com/your-org/your-repo.git"
export DOMAIN="47.83.144.162"
bash setup.sh
```

## 验证命令

```bash
sudo systemctl status streamlit-app
sudo journalctl -u streamlit-app -n 80 --no-pager
sudo nginx -t
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/app
```

## 后续更新

项目接入 Git 仓库后，每次服务器更新执行：

```bash
cd /var/www/project
bash deploy.sh
```

## 初始化数据

在服务器项目根目录执行：

```bash
cd /var/www/project
source .venv/bin/activate
python -m data.fetch_openalex
python -m data.process_data
sudo systemctl restart streamlit-app
```

## 注意

当前项目还需要配置生产环境变量、MySQL RDS、短信服务和支付宝二维码图片。未配置前，页面可以启动，但登录、短信和付费审核不能完整用于生产。
