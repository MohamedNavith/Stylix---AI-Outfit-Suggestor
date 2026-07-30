import httpx
import os

def restart_bot():
    try:
        from config_keys import DEFAULT_TELEGRAM_BOT_TOKEN
    except ImportError:
        DEFAULT_TELEGRAM_BOT_TOKEN = ""
    
    token = os.environ.get("TELEGRAM_BOT_TOKEN") or DEFAULT_TELEGRAM_BOT_TOKEN or "8644241761:AAGbiyoxVblpjhJDyObvAhbQYCUd2mkZy_w"
    webhook_url = "https://stylix-backend.vercel.app/api/webhooks/telegram"
    
    print(f"Restarting Telegram Bot... (Token: {token[:15]}...)")
    
    # 1. Delete Webhook
    delete_url = f"https://api.telegram.org/bot{token}/deleteWebhook?drop_pending_updates=true"
    res = httpx.post(delete_url)
    print("Delete Webhook Status:", res.status_code, res.json())
    
    # 2. Set Webhook
    set_url = f"https://api.telegram.org/bot{token}/setWebhook?url={webhook_url}"
    res2 = httpx.post(set_url)
    print("Set Webhook Status:", res2.status_code, res2.json())
    
    # 3. Get Webhook Info
    info_url = f"https://api.telegram.org/bot{token}/getWebhookInfo"
    res3 = httpx.get(info_url)
    print("Webhook Info Status:", res3.status_code, res3.json())

if __name__ == "__main__":
    restart_bot()
