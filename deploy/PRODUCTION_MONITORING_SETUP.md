# Production Monitoring Setup (выполняется из среды с действующим SSH)

Одноразовая установка мониторинга здоровья пары на прод-хосте `217.12.37.223`.
Требует: root (или sudo), каталог текущего Web-релиза в `/opt/zerkalo-releases/`.

## 1. Проверить имена юнитов

```bash
systemctl list-units --type=service | grep -Ei 'zerkalo|digital-code'
```

Если фактические имена отличаются от
`zerkalo.service digital-code-bridge.service digital-code-v2-prod.service` —
передать их через `MONITOR_UNITS` (шаг 3), не редактируя скрипт.

## 2. Установить скрипт и state-каталог

```bash
install -m 755 /opt/zerkalo-releases/<current-sha>/deploy/health_monitor.sh /usr/local/bin/zerkalo-health-monitor.sh
install -d -m 700 /var/lib/zerkalo-health-monitor
```

## 3. Учётные данные уведомлений (не в git!)

Создать отдельного бота-монитора или использовать текущего бота; chat_id владельца.
`MONITOR_BOT_TOKEN` — только для отправки сообщений владельцу (не основной бот-токен, если это можно).

```bash
cat >/etc/default/zerkalo-health-monitor <<'EOF'
MONITOR_BOT_TOKEN=<token>
MONITOR_CHAT_ID=<chat_id>
MONITOR_STATE_DIR=/var/lib/zerkalo-health-monitor
# MONITOR_UNITS=zerkalo.service digital-code-bridge.service digital-code-v2-prod.service
EOF
chmod 600 /etc/default/zerkalo-health-monitor
```

## 4. Установить systemd timer

```bash
cp /opt/zerkalo-releases/<current-sha>/deploy/zerkalo-health-monitor.service /etc/systemd/system/
cp /opt/zerkalo-releases/<current-sha>/deploy/zerkalo-health-monitor.timer    /etc/systemd/system/
# В service файле при необходимости поправить ExecStart на /usr/local/bin/zerkalo-health-monitor.sh
systemctl daemon-reload
systemctl enable --now zerkalo-health-monitor.timer
systemctl start zerkalo-health-monitor.service   # первый прогон
journalctl -u zerkalo-health-monitor.service -n 20 --no-pager
```

## 5. Синтетическая проверка (Gate 4)

```bash
# 5.1 Норма: healthy, без уведомлений
/usr/local/bin/zerkalo-health-monitor.sh && echo OK

# 5.2 Синтетическая неисправность: подменить URL health во временной копии окружения
WEB_HEALTH_URL=https://zerkalosebya.ru/health-NOTFOUND WEB_READY_URL=https://zerkalosebya.ru/ready-NOTFOUND \
  /usr/local/bin/zerkalo-health-monitor.sh; echo "rc=$? (ожидаем 1 + уведомление 🔴 в Telegram)"

# 5.3 Восстановление: снова запустить без подмены — должно прийти уведомление 🟢
/usr/local/bin/zerkalo-health-monitor.sh && echo OK

# 5.4 Антиспам: ещё два прогона без изменений состояния — уведомлений быть НЕ должно
/usr/local/bin/zerkalo-health-monitor.sh; /usr/local/bin/zerkalo-health-monitor.sh

# 5.5 Рестарт-алерт (опционально): рестартнуть юнит дважды и убедиться в одном уведомлении о росте NRestarts
# systemctl restart zerkalo.service; systemctl restart zerkalo.service; /usr/local/bin/zerkalo-health-monitor.sh
```

## 6. Environment SHA сервиса (устранение root cause инцидента)

Инцидент 49k рестартов возник из-за ссылки юнита на удалённый release-каталог.
Правило: `ExecStart` systemd-юнитов всегда указывает на текущий релизный каталог;
после деплоя — `daemon-reload` + `systemctl restart`, удаление старого каталога —
только после переключения. Проверка:

```bash
systemctl cat zerkalo.service | grep -E 'ExecStart|WorkingDirectory'
ls -ld $(dirname "$(systemctl show -p ExecStart --value zerkalo.service | sed 's/^ExecStart=//;s/ .*//')")
systemctl show -p NRestarts zerkalo.service digital-code-bridge.service digital-code-v2-prod.service
```
