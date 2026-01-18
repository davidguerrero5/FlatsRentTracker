# Setup Guide for Rent Price Tracker

## Quick Setup for Local Testing

### 1. Create a `.env` file

**Option A: Use the setup script (easiest)**

```bash
./setup-env.sh
```

**Option B: Create manually**

Create a file called `.env` in the root directory with the following content:

```bash
RESEND_API_KEY=re_fJLV23XF_8mZzLcnfFjrAiPyohDbNHkSq
RECIPIENT_EMAIL=dguerrero5296@gmail.com
SENDER_EMAIL=onboarding@resend.dev
```

**Option C: Export in terminal (temporary)**

```bash
export RESEND_API_KEY=re_fJLV23XF_8mZzLcnfFjrAiPyohDbNHkSq
export RECIPIENT_EMAIL=dguerrero5296@gmail.com
export SENDER_EMAIL=onboarding@resend.dev
```

**Note**: The `.env` file is already in `.gitignore` and will not be committed to git.

### 2. Install Dependencies

```bash
npm install
npx playwright install chromium
```

### 3. Test the Scraper

Run the diagnostic test script first:

```bash
node test-scraper.js
```

This will:
- Open a browser window (so you can see what's happening)
- Take a screenshot of the page
- Print out text content and potential price elements
- Help identify the correct selectors

### 4. Run the Full Script

```bash
npm start
```

This will scrape prices, compare with history, and send an email report.

## GitHub Actions Setup

### Adding Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

   - **Name**: `RESEND_API_KEY`
     - **Value**: `re_fJLV23XF_8mZzLcnfFjrAiPyohDbNHkSq`
   
   - **Name**: `RECIPIENT_EMAIL`
     - **Value**: `dguerrero5296@gmail.com`
   
   - **Name**: `SENDER_EMAIL` (optional)
     - **Value**: `onboarding@resend.dev`

### Testing the Workflow

You can manually trigger the workflow to test it:

1. Go to the **Actions** tab in your GitHub repository
2. Click on **Daily Rent Price Check** workflow
3. Click **Run workflow** → **Run workflow**
4. Monitor the job progress and check for any errors

## Troubleshooting

### Issue: "Timeout 30000ms exceeded"

**Solution**: The scraper has been updated to use `domcontentloaded` instead of `networkidle` and increased timeout to 60 seconds. If you still see timeouts:

1. Check if the website is accessible from your location
2. Try increasing the timeout in `scraper.js`
3. Check if the website requires JavaScript to load content

### Issue: "Price is null" or "N/A"

**Solution**: Run the diagnostic script to see what's on the page:

```bash
node test-scraper.js
```

This will help identify the correct CSS selectors for prices.

### Issue: Email not sending

**Possible causes**:
1. Invalid Resend API key
2. Recipient email not verified (for custom domains)
3. Network connectivity issues

**Check**:
- Verify your API key is correct in Resend dashboard
- Check the console output for specific error messages
- For custom domains, make sure your domain is verified in Resend

### Issue: GitHub Actions not running daily

**Solution**:
1. Make sure the workflow file is in the `main` or default branch
2. Check that the repository is not archived
3. Verify the workflow is enabled in Settings → Actions → General
4. Note: First scheduled run may take up to 24 hours to trigger

## Clearing History

If you want to start fresh and clear the price history:

```bash
echo "[]" > data/history.json
```

## Testing Email Without Scraping

You can test just the email functionality:

```bash
node notifier.js
```

This will send a test email with sample data.
