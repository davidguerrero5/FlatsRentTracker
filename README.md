# Flats Rent Tracker

A Node.js application that monitors apartment prices at CityLine Flats and sends daily email reports with price changes.

## Features

- Scrapes floor plan prices using Playwright (headless browser)
- Tracks price history in a local JSON file
- Compares current prices with historical data
- Sends formatted email reports via Resend
- Automated daily runs via GitHub Actions

## Tracked Floor Plans

- **Plan B**: [View on CityLine Flats](https://citylineflats.com/apartments/?spaces_tab=plan-detail&detail=162036)
- **Plan C + Den**: [View on CityLine Flats](https://citylineflats.com/apartments/?spaces_tab=plan-detail&detail=162039)

## Setup

### Prerequisites

- Node.js 18 or higher
- A [Resend](https://resend.com) account for email delivery

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd FlatsRentTracker
   ```

2. Install dependencies:
   ```bash
   npm install
   npx playwright install chromium
   ```

3. Create a `.env` file in the root directory:
   ```bash
   RESEND_API_KEY=your_resend_api_key
   RECIPIENT_EMAIL=your@email.com
   SENDER_EMAIL=onboarding@resend.dev
   ```

   See [SETUP.md](SETUP.md) for detailed configuration instructions.

### Running Locally

Test the scraper first:
```bash
node test-scraper.js
```

Run the full tracker:
```bash
npm start
```

For detailed setup and troubleshooting, see [SETUP.md](SETUP.md).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | Yes | API key from your Resend dashboard |
| `RECIPIENT_EMAIL` | Yes | Email address to receive the daily reports |
| `SENDER_EMAIL` | No | Verified sender email in Resend (defaults to `onboarding@resend.dev` for testing) |

## GitHub Actions Setup

The repository includes a GitHub Actions workflow that runs daily at 8:00 AM UTC.

### Required Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `RESEND_API_KEY`: Your Resend API key
- `RECIPIENT_EMAIL`: The email address for reports

### Manual Trigger

You can also trigger the workflow manually from the Actions tab in GitHub.

## Project Structure

```
FlatsRentTracker/
├── package.json          # Project dependencies and scripts
├── index.js              # Entry point - orchestrates scraper and notifier
├── scraper.js            # Playwright scraping logic
├── notifier.js           # Email formatting and sending
├── data/
│   └── history.json      # Price history storage
└── .github/
    └── workflows/
        └── daily_check.yml  # GitHub Actions workflow
```

## License

MIT
