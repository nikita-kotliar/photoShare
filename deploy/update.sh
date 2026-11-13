#!/bin/bash
set -euo pipefail
export MSYS_NO_PATHCONV=1

K=${DEPLOY_KEY:-~/.ssh/kotdenik_ed25519}
S=${DEPLOY_SERVER:?вкажіть DEPLOY_SERVER=root@адреса-сервера}
cd "$(dirname "$0")/.."

remote() { ssh -i "$K" "$S" "$@"; }

backup() {
  remote 'cd /opt/photoshare && if [ -n "$(docker compose ps -q db 2>/dev/null)" ]; then mkdir -p /root/backups && docker compose exec -T db pg_dump -U photoshare photoshare | gzip > /root/backups/photoshare-$(date +%F-%H%M).sql.gz && ls -lh /root/backups | grep photoshare | tail -1; else echo "бази ще немає, копію пропускаю"; fi'
}

backend() {
  backup
  tar -czf - --exclude=node_modules --exclude=coverage --exclude=.env \
    --transform='s,^docker-compose.prod.yml$,docker-compose.yml,' docker-compose.prod.yml backend |
    remote 'cd /opt/photoshare && tar -xzf - --no-same-owner && docker compose up -d --build && sleep 15 && docker compose ps && docker compose logs --tail 20 backend'
}

frontend() {
  (cd frontend && npm ci --no-audit --no-fund && npm run build:deploy)
  tar -czf - -C frontend/dist . |
    remote 'rm -rf /var/www/photoshare/* && tar -xzf - --no-same-owner -C /var/www/photoshare && ls /var/www/photoshare'
}

case "${1:-all}" in
  backend) backend ;;
  frontend) frontend ;;
  backup) backup ;;
  all) backend && frontend ;;
  *) echo "використання: deploy/update.sh [all|backend|frontend|backup]" && exit 1 ;;
esac
