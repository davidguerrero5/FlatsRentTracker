import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { scrapeAllPlans } from './scraper.js';
import { sendReport } from './notifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HISTORY_FILE = join(__dirname, 'data', 'history.json');

/**
 * Load price history from the JSON file
 * @returns {Promise<Array>} - Array of historical entries
 */
async function loadHistory() {
  try {
    const data = await readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('History file not found, starting fresh');
      return [];
    }
    throw error;
  }
}

/**
 * Save price history to the JSON file
 * @param {Array} history - Array of historical entries
 */
async function saveHistory(history) {
  // Ensure data directory exists
  const dataDir = dirname(HISTORY_FILE);
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }
  
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log(`History saved to ${HISTORY_FILE}`);
}

/**
 * Get the last entry from history
 * @param {Array} history - Array of historical entries
 * @returns {Object|null} - Last entry or null if empty
 */
function getLastEntry(history) {
  if (!history || history.length === 0) {
    return null;
  }
  return history[history.length - 1];
}

/**
 * Compare current prices with previous prices and generate a change report
 * @param {Object} currentData - Today's scraped data
 * @param {Object|null} previousData - Previous entry from history
 * @returns {Object} - Report object with changes
 */
function comparePrices(currentData, previousData) {
  const changes = [];
  
  // Create a map of previous prices by plan name for easy lookup
  const previousPrices = new Map();
  if (previousData && previousData.plans) {
    for (const plan of previousData.plans) {
      previousPrices.set(plan.name, plan);
    }
  }
  
  // Compare each current plan with previous
  for (const currentPlan of currentData.plans) {
    const previousPlan = previousPrices.get(currentPlan.name);
    
    let status;
    let previousPrice = null;
    let difference = 0;
    
    if (!previousPlan) {
      // New listing (not seen before)
      status = 'new';
    } else if (currentPlan.price === null || previousPlan.price === null) {
      // Can't compare if either price is missing
      status = 'unchanged';
      previousPrice = previousPlan.price;
    } else {
      previousPrice = previousPlan.price;
      difference = currentPlan.price - previousPrice;
      
      if (difference < 0) {
        status = 'decreased';
      } else if (difference > 0) {
        status = 'increased';
      } else {
        status = 'unchanged';
      }
    }
    
    changes.push({
      name: currentPlan.name,
      url: currentPlan.url,
      currentPrice: currentPlan.price,
      previousPrice,
      difference,
      status,
      availability: currentPlan.availability,
    });
  }
  
  // Check for plans that were in previous but not in current (removed listings)
  if (previousData && previousData.plans) {
    const currentNames = new Set(currentData.plans.map((p) => p.name));
    for (const previousPlan of previousData.plans) {
      if (!currentNames.has(previousPlan.name)) {
        changes.push({
          name: previousPlan.name,
          url: previousPlan.url,
          currentPrice: null,
          previousPrice: previousPlan.price,
          difference: 0,
          status: 'removed',
          availability: 'No longer listed',
        });
      }
    }
  }
  
  return {
    date: currentData.date,
    timestamp: currentData.timestamp,
    changes,
  };
}

/**
 * Print a summary of the report to console
 * @param {Object} report - Report object with changes
 */
function printReportSummary(report) {
  console.log('\n' + '='.repeat(60));
  console.log(`RENT PRICE REPORT - ${report.date}`);
  console.log('='.repeat(60) + '\n');
  
  for (const change of report.changes) {
    const priceStr = change.currentPrice
      ? `$${change.currentPrice.toLocaleString()}`
      : 'N/A';
    
    let statusStr;
    switch (change.status) {
      case 'decreased':
        statusStr = `↓ DECREASED by $${Math.abs(change.difference).toLocaleString()}`;
        break;
      case 'increased':
        statusStr = `↑ INCREASED by $${Math.abs(change.difference).toLocaleString()}`;
        break;
      case 'new':
        statusStr = '★ NEW LISTING';
        break;
      case 'removed':
        statusStr = '✕ REMOVED';
        break;
      default:
        statusStr = '– No change';
    }
    
    console.log(`${change.name}`);
    console.log(`  Price: ${priceStr}`);
    console.log(`  Status: ${statusStr}`);
    if (change.availability) {
      console.log(`  Availability: ${change.availability}`);
    }
    console.log();
  }
  
  console.log('='.repeat(60) + '\n');
}

/**
 * Main function - orchestrates the entire process
 */
async function main() {
  console.log('Starting Rent Price Tracker...\n');
  
  try {
    // Step 1: Scrape current prices
    console.log('Step 1: Scraping current prices...');
    const currentData = await scrapeAllPlans();
    
    // Step 2: Load history
    console.log('\nStep 2: Loading history...');
    const history = await loadHistory();
    const previousData = getLastEntry(history);
    
    if (previousData) {
      console.log(`Found previous entry from ${previousData.date}`);
    } else {
      console.log('No previous data found (first run)');
    }
    
    // Step 3: Compare prices
    console.log('\nStep 3: Comparing prices...');
    const report = comparePrices(currentData, previousData);
    
    // Print summary to console
    printReportSummary(report);
    
    // Step 4: Send email notification
    console.log('Step 4: Sending email report...');
    try {
      await sendReport(report);
    } catch (error) {
      console.error('Warning: Could not send email:', error.message);
      console.log('Continuing to save history...');
    }
    
    // Step 5: Save to history
    console.log('\nStep 5: Saving to history...');
    history.push(currentData);
    await saveHistory(history);
    
    console.log('\nRent Price Tracker completed successfully!');
    
  } catch (error) {
    console.error('Error running Rent Price Tracker:', error);
    process.exit(1);
  }
}

// Run the main function
main();
