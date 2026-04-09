## Resource Library

This project is a simplified resource library for saving useful links with a source, category, notes, saved date, and a tool subcategory for resources in `Tools`.

## Local setup

1. Copy `.env.example` to `.env`
2. Add your Supabase values
3. Run `npm install`
4. Run `npm run dev`

## Supabase setup

Run the SQL in [20260321_create_resources.sql](/Users/yamparalarahul/Desktop/ylog/Yamparalalog/supabase/migrations/20260321_create_resources.sql) and [20260321_add_tool_subcategory_to_resources.sql](/Users/yamparalarahul/Desktop/ylog/Yamparalalog/supabase/migrations/20260321_add_tool_subcategory_to_resources.sql) in the Supabase SQL editor, or apply them with the Supabase CLI.

## Telegram Bot setup

Save links to your resource library by sending them to a Telegram bot.

### 1. Create the bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts, and copy the **bot token**

### 2. Get your chat ID

1. Message your new bot with `/id`
2. Or send `/start` — the bot will reply with your chat ID

### 3. Deploy the Edge Function

```bash
supabase functions deploy telegram-webhook
```

### 4. Set secrets

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=your-bot-token
supabase secrets set TELEGRAM_ALLOWED_CHAT_IDS=your-chat-id
```

`TELEGRAM_ALLOWED_CHAT_IDS` is a comma-separated list. Leave empty to allow anyone (not recommended).

### 5. Register the webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook"
```

### 6. Usage

Send a message to your bot:

- `https://example.com` — saves with category "Other"
- `https://example.com #Tools Great dev tool` — saves under "Tools" with note "Great dev tool"
- Multiple links in one message are supported

## Vercel env vars

Add these variables to Vercel for Production and Preview:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
