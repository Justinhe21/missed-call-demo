# Missed-Call Text-Back

When someone calls your Twilio number and nobody answers, this server automatically
texts them back with a friendly message and a booking link.

**Call flow:**
```
Caller → Twilio number → (hold message plays) → forwards to MY_CELL_NUMBER
                                                        ↓ no answer / busy
                                               SMS sent to original caller
```

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# then edit .env with your real values
```

### 3. Expose your local server to Twilio

Twilio needs a public URL to send webhooks. Use [ngrok](https://ngrok.com) (free tier works):

```bash
ngrok http 3000
# Copy the https://xxxx.ngrok.io URL — you'll paste it into Twilio below
```

### 4. Start the server

```bash
npm run dev   # uses nodemon for auto-restart on file changes
# or
npm start
```

### 5. Point Twilio at your server

1. Open [Twilio Console → Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/active)
2. Click your Twilio number
3. Under **Voice & Fax → A call comes in**, set:
   - **Webhook:** `https://xxxx.ngrok.io/voice`
   - **HTTP method:** POST
4. Save

---

## Deploying to Railway

Railway is the easiest way to keep this running 24/7 for a few dollars a month.

### Step 1 — Push your code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/missed-call-textback.git
git push -u origin main
```

### Step 2 — Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your `missed-call-textback` repo
4. Railway will detect Node.js automatically and run `npm start`

### Step 3 — Add environment variables

1. In your Railway project, click the **service** card, then **Variables**
2. Click **Add Variable** for each of the following (copy from your `.env`):

| Variable | Example value |
|---|---|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | `your_token` |
| `TWILIO_PHONE_NUMBER` | `+1XXXXXXXXXX` |
| `MY_CELL_NUMBER` | `+1XXXXXXXXXX` |
| `SHOP_NAME` | `Acme Plumbing` |
| `BOOKING_LINK` | `https://calendly.com/your-link` |

> Railway automatically provides the `PORT` variable — don't set it yourself.

### Step 4 — Get your public URL

1. In Railway, click **Settings → Networking → Generate Domain**
2. Your URL will look like `https://missed-call-textback-production.up.railway.app`

### Step 5 — Update Twilio's webhook

Repeat the Twilio step from local development, but use your Railway URL:

- **Webhook:** `https://YOUR-RAILWAY-URL.up.railway.app/voice`

### Step 6 — Test it

Call your Twilio number from a real phone. Let it ring past 20 seconds without
answering on `MY_CELL_NUMBER`. You should receive a text within a few seconds.

---

## Reusing for a new client

1. Duplicate the project on Railway (or create a new service in the same project)
2. Change `MY_CELL_NUMBER`, `SHOP_NAME`, and `BOOKING_LINK` in the Variables tab
3. Buy a new Twilio number, point its webhook at the new Railway URL
4. Done — the client gets a fresh isolated setup

---

## Environment variable reference

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account identifier (starts with `AC`) |
| `TWILIO_AUTH_TOKEN` | Twilio secret key — keep this private |
| `TWILIO_PHONE_NUMBER` | Twilio number that receives calls and sends SMS |
| `MY_CELL_NUMBER` | Business owner's real number to forward calls to |
| `SHOP_NAME` | Inserted into the auto-text message |
| `BOOKING_LINK` | Link inserted into the auto-text (Calendly, website, etc.) |
