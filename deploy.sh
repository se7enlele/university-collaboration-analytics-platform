#!/usr/bin/env bash
set -euo pipefail

cd /var/www/project
git pull --ff-only

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

. .venv/bin/activate
pip install -r requirements.txt

sudo systemctl restart streamlit-app
sudo systemctl status streamlit-app --no-pager
