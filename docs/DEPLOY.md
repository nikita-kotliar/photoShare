# Деплой

Застосунок розгорнуто на спільному сервері з HTTPS, де вже працюють інші сайти. PhotoShare ділить з ними лише сервер, домен і SSL-сертифікат: своя база, свій Docker-проєкт і свій файл nginx ([D-43](DECISIONS.md)).

| Що               | Адреса                                      |
| ---------------- | ------------------------------------------- |
| Сайт             | https://kotdenik.cx.ua/photoshare/          |
| API              | https://kotdenik.cx.ua/photoshare-api/      |
| Документація API | https://kotdenik.cx.ua/photoshare-api/docs/ |

## Як влаштовано

| Частина             | Де живе на сервері                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Фронтенд            | статичні файли в `/var/www/photoshare/`, їх віддає nginx сервера                                          |
| Бекенд і PostgreSQL | Docker-проєкт `photoshare` у `/opt/photoshare/` (`docker-compose.prod.yml` з репозиторію)                 |
| nginx               | `/etc/nginx/snippets/photoshare.conf` (з `deploy/photoshare.conf`) і один рядок `include` у конфігу сайту |
| Секрети             | `/opt/photoshare/.env`, лише на сервері                                                                   |
| Резервні копії      | `/root/backups/photoshare-*.sql.gz`                                                                       |

- Бекенд слухає лише `127.0.0.1:8100`, назовні доступний тільки через nginx. Порт бази назовні не відкритий.
- nginx пересилає `/photoshare-api/...` на `/api/...` бекенду, тож маршрути в коді не змінюються.
- Фронтенд збирається командою `npm run build:deploy`: базовий шлях `/photoshare/`, API на `/photoshare-api`.
- Cookie називається `photoshare_token`, має `Path=/photoshare-api/`, `Secure`, `HttpOnly`, `SameSite=Lax`, тому не перетинається з cookie інших сайтів на домені.
- Міграції бази застосовуються автоматично при кожному старті контейнера бекенду (`prisma migrate deploy`).

## Що потрібно

- Git Bash, SSH-ключ до сервера, Node.js 22 (для збірки фронтенду).
- Ключі Cloudinary (у production без них бекенд не стартує).

На початку кожної сесії в Git Bash:

```bash
export DEPLOY_SERVER=root@<адреса сервера>
export DEPLOY_KEY=~/.ssh/kotdenik_ed25519
K=$DEPLOY_KEY; S=$DEPLOY_SERVER
```

## Перший деплой

Усі команди запускаються з кореня репозиторію.

**1. Перевірити ресурси і що порт та адреси вільні.** Порт 8100 не має з'явитися у виводі `ss`, а `grep` має вивести «адреса вільна». Якщо пам'яті вільно менше 600 МБ, спершу розібратися з цим.

```bash
ssh -i "$K" "$S" 'free -h; df -h /; ss -ltnp | grep -E ":81[0-9]{2} " || echo "порти 8100-8199 вільні"; ls /var/www /opt; grep -n "photoshare" /etc/nginx/sites-available/kotdenik.conf || echo "адреса вільна"'
```

Якщо 8100 зайнятий, обрати інший вільний порт з 8100-8199, дописати `API_PORT=<порт>` у `.env` на кроці 2 і замінити `8100` у `deploy/photoshare.conf`.

**2. Теки і секрети.** Паролі генеруються на сервері й ніде не показуються. Має вивести `READY`.

```bash
ssh -i "$K" "$S" 'mkdir -p /opt/photoshare /var/www/photoshare && cd /opt/photoshare && { [ -f .env ] || printf "DB_PASSWORD=%s\nJWT_SECRET=%s\n" "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env; } && chmod 600 .env && echo READY'
```

**3. Ключі Cloudinary.** Секрет вводиться приховано. Має вивести `SAVED`.

```bash
ssh -t -i "$K" "$S" 'cd /opt/photoshare && read -p "CLOUDINARY_CLOUD_NAME: " a && read -p "CLOUDINARY_API_KEY: " b && read -s -p "CLOUDINARY_API_SECRET: " c && echo && printf "CLOUDINARY_CLOUD_NAME=%s\nCLOUDINARY_API_KEY=%s\nCLOUDINARY_API_SECRET=%s\n" "$a" "$b" "$c" >> .env && echo SAVED'
```

**4. Бекенд і база.** Збирає образ на сервері, піднімає контейнери, застосовує міграції. У виводі `docker compose ps` обидва сервіси мають бути `Up`, бекенд `(healthy)`, у логах `PhotoShare API: http://localhost:3000/api`.

```bash
./deploy/update.sh backend
```

**5. Фронтенд.** Збирає локально і заливає готову теку. Має вивести `assets favicon.svg index.html`.

```bash
./deploy/update.sh frontend
```

**6. nginx.** Підключає сніпет. Якщо `nginx -t` не проходить, скрипт сам повертає конфіг як було. Має вивести `NGINX_OK`.

```bash
cat deploy/photoshare.conf | ssh -i "$K" "$S" 'cat > /etc/nginx/snippets/photoshare.conf'
ssh -i "$K" "$S" 'bash -s' < deploy/nginx-photoshare.sh
```

**7. Перевірка.** Очікувано: `200`, `200`, `200`, `401`, і ще два `200` для інших сайтів на сервері, які мають працювати як раніше.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://kotdenik.cx.ua/photoshare/
curl -s -o /dev/null -w "%{http_code}\n" https://kotdenik.cx.ua/photoshare-api/health
curl -s -o /dev/null -w "%{http_code}\n" https://kotdenik.cx.ua/photoshare-api/docs/
curl -s -o /dev/null -w "%{http_code}\n" https://kotdenik.cx.ua/photoshare-api/users/me
curl -s -o /dev/null -w "%{http_code}\n" https://kotdenik.cx.ua/
curl -s -o /dev/null -w "%{http_code}\n" https://kotdenik.cx.ua/api/health
```

**8. Адміністратор.** Перший зареєстрований користувач отримує роль ADMIN. Одразу після деплою зареєструватися на сайті самому, поки посилання ніхто не бачив.

## Оновлення

```bash
./deploy/update.sh            # бекенд і фронтенд
./deploy/update.sh backend    # лише бекенд
./deploy/update.sh frontend   # лише фронтенд
```

Перед оновленням бекенду скрипт сам робить резервну копію бази, бо при старті можуть застосуватися нові міграції. Деплоїти лише з `main`, після зеленого CI.

## Резервні копії і логи

```bash
./deploy/update.sh backup
ssh -i "$K" "$S" 'cd /opt/photoshare && docker compose logs --tail 50 backend'
```

Відновлення з копії (замінює поточні дані):

```bash
ssh -i "$K" "$S" 'cd /opt/photoshare && gunzip -c /root/backups/photoshare-<дата>.sql.gz | docker compose exec -T db psql -U photoshare -d photoshare'
```

## Правила на спільному сервері

- `docker compose` запускати лише з `/opt/photoshare`. Не чіпати чужі контейнери, теки `/opt/*`, `/var/www/*` і конфіги nginx, крім своїх.
- Ніяких `docker system prune`, `docker volume prune`, `docker image prune -a`.
- Секрети не комітити і не показувати в чаті. `.env` лежить лише на сервері.

## Прибрати проєкт із сервера

1. Прибрати рядок `include snippets/photoshare.conf;` з `/etc/nginx/sites-available/kotdenik.conf` і сам сніпет, потім `nginx -t && systemctl reload nginx`.
2. `cd /opt/photoshare && docker compose down -v` (видаляє і базу).
3. Видалити `/opt/photoshare` і `/var/www/photoshare`.
