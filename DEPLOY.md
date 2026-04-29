# Zerkalo — Deployment Guide

## Prerequisites

- Node.js 20+ (`node -v`)
- npm 10+ (`npm -v`)
- Nginx or Caddy (reverse proxy)
- SSL certificate (Let's Encrypt / certbot)

## 1. Clone and Build

```bash
cd /opt
git clone https://github.com/gnabriverner-pixel/Zerkalo.git zerkalo
cd zerkalo
npm install
npm run build
```

## 2. Create .env

```bash
cp .env.production.example .env
nano .env
```

Fill in:
- `GEMINI_API_KEY` — optional, for AI-enhanced generation
- `TELEGRAM_BOT_TOKEN` — for lead notifications (same token as your DCS bot)
- `TELEGRAM_ADMIN_CHAT_ID` — your personal Telegram user ID

## 3. Test Locally

```bash
NODE_ENV=production npm run start
# Should print: Server running on http://localhost:3001
curl http://localhost:3001/health
# Should return: {"status":"ok","service":"zerkalo","version":"0.1.0"}
```

## 4. Install systemd Service

```bash
sudo cp deploy/zerkalo.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable zerkalo
sudo systemctl start zerkalo
sudo systemctl status zerkalo
```

## 5. Configure Nginx

```bash
sudo cp deploy/zerkalo.nginx.conf /etc/nginx/sites-available/zerkalo
sudo ln -s /etc/nginx/sites-available/zerkalo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d zerkalo.yourdomain.ru
```

## 7. Verify

```bash
curl https://zerkalo.yourdomain.ru/health
```

## Important

- Do NOT touch the Telegram bot service (`dcs-bot.service`)
- Zerkalo runs on PORT=3001, the bot uses polling (no port conflict)
- `leads.json` is stored in `/opt/zerkalo/` — back it up regularly
- Logs: `journalctl -u zerkalo -f`
