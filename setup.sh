#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/var/www/project"
REPO_URL="${REPO_URL:-https://github.com/your-org/your-repo.git}"
DOMAIN="${DOMAIN:-your-domain.com}"

sudo apt-get update
sudo apt-get install -y git nginx ufw python3 python3-venv python3-pip

if [ -f "$PROJECT_DIR/app.py" ]; then
  echo "Using existing project files in $PROJECT_DIR"
elif [ ! -d "$PROJECT_DIR/.git" ]; then
  sudo mkdir -p "$PROJECT_DIR"
  sudo chown -R "$USER":"$USER" "$PROJECT_DIR"
  git clone "$REPO_URL" "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

sudo sed -i "s/server_name your-domain.com;/server_name ${DOMAIN};/" nginx.conf
sudo cp nginx.conf /etc/nginx/sites-available/international-collab
sudo ln -sf /etc/nginx/sites-available/international-collab /etc/nginx/sites-enabled/international-collab
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

sudo cp streamlit-app.service /etc/systemd/system/streamlit-app.service
sudo systemctl daemon-reload
sudo systemctl enable streamlit-app
sudo systemctl restart streamlit-app
sudo systemctl restart nginx

sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "Deployment complete. Configure domain, HTTPS, and production environment variables before public launch."
