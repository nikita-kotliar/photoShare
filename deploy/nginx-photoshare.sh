#!/bin/bash
set -u
F=/etc/nginx/sites-available/kotdenik.conf
B="$F.bak-$(date +%F-%H%M%S)"
cp "$F" "$B"
grep -qF "snippets/photoshare.conf" "$F" || perl -0pi -e 's{\n(\s*)(location\s+/api/\s*\{)}{\n$1include snippets/photoshare.conf;\n$1$2}' "$F"
grep -n "photoshare" "$F"
if nginx -t; then
  systemctl reload nginx && echo NGINX_OK
else
  cp "$B" "$F"
  rm -f /etc/nginx/snippets/photoshare.conf
  echo "ПОМИЛКА, повернув як було"
fi
