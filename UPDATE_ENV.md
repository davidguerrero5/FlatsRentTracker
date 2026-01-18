# Update Your .env File

Your `.env` file needs to be updated to remove the second recipient email.

## Quick Fix

Open your `.env` file and change this line:

```bash
RECIPIENT_EMAIL=dguerrero5296@gmail.com,taitran.tct@gmail.com
```

To:

```bash
RECIPIENT_EMAIL=dguerrero5296@gmail.com
```

## Or Run This Command

```bash
cat > .env << 'EOF'
# Resend API Configuration for Local Testing
RESEND_API_KEY=re_fJLV23XF_8mZzLcnfFjrAiPyohDbNHkSq
RECIPIENT_EMAIL=dguerrero5296@gmail.com
SENDER_EMAIL=onboarding@resend.dev
EOF
```

## Forwarding Emails to taitran.tct@gmail.com

Since Resend's free sender only allows sending to your registered email, you have two options:

### Option 1: Gmail Auto-Forward (Recommended - Easy)

1. Open Gmail → Settings (gear icon) → **See all settings**
2. Go to **Filters and Blocked Addresses** tab
3. Click **Create a new filter**
4. Fill in:
   - **From:** `onboarding@resend.dev`
   - **Subject:** `Rent Report`
5. Click **Create filter**
6. Check **Forward it to** and enter: `taitran.tct@gmail.com`
7. Click **Create filter**

Now all rent reports will automatically forward to Tai!

### Option 2: Verify a Custom Domain (Advanced)

1. Go to https://resend.com/domains
2. Add your domain (e.g., `yourdomain.com`)
3. Add the DNS records they provide
4. Update `SENDER_EMAIL` to use your domain (e.g., `noreply@yourdomain.com`)
5. Then you can send to multiple recipients directly

## Test It

After updating `.env`:

```bash
npm start
```

You should receive the email at dguerrero5296@gmail.com successfully!
