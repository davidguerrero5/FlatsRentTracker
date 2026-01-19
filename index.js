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
 * @returns {Object} - Report object with changes by plan
 */
function comparePrices(currentData, previousData) {
  const planReports = [];
  
  // Create a map of previous plans by name for easy lookup
  const previousPlans = new Map();
  if (previousData && previousData.plans) {
    for (const plan of previousData.plans) {
      previousPlans.set(plan.name, plan);
    }
  }
  
  // Compare each current plan with previous
  for (const currentPlan of currentData.plans) {
    const previousPlan = previousPlans.get(currentPlan.name);
    const unitChanges = [];
    
    // Create map of previous units by a unique key (unit number + price)
    const previousUnits = new Map();
    if (previousPlan && previousPlan.units) {
      for (const unit of previousPlan.units) {
        const key = `${unit.unitNumber || 'unknown'}-${unit.floor || 'unknown'}`;
        previousUnits.set(key, unit);
      }
    }
    
    // Compare each current unit
    for (const currentUnit of currentPlan.units || []) {
      const unitKey = `${currentUnit.unitNumber || 'unknown'}-${currentUnit.floor || 'unknown'}`;
      const previousUnit = previousUnits.get(unitKey);
      
      let status = 'new';
      let previousPrice = null;
      let difference = 0;
      
      if (previousUnit) {
        previousPrice = previousUnit.price;
        difference = currentUnit.price - previousPrice;
        
        if (difference < 0) {
          status = 'decreased';
        } else if (difference > 0) {
          status = 'increased';
        } else {
          status = 'unchanged';
        }
      }
      
      unitChanges.push({
        unitNumber: currentUnit.unitNumber,
        floor: currentUnit.floor,
        currentPrice: currentUnit.price,
        previousPrice,
        difference,
        status,
        availability: currentUnit.availability,
      });
    }
    
    // Check for units that were removed
    if (previousPlan && previousPlan.units) {
      const currentUnitKeys = new Set(
        (currentPlan.units || []).map(u => `${u.unitNumber || 'unknown'}-${u.floor || 'unknown'}`)
      );
      
      for (const prevUnit of previousPlan.units) {
        const unitKey = `${prevUnit.unitNumber || 'unknown'}-${prevUnit.floor || 'unknown'}`;
        if (!currentUnitKeys.has(unitKey)) {
          unitChanges.push({
            unitNumber: prevUnit.unitNumber,
            floor: prevUnit.floor,
            currentPrice: null,
            previousPrice: prevUnit.price,
            difference: 0,
            status: 'removed',
            availability: 'No longer available',
          });
        }
      }
    }
    
    planReports.push({
      planName: currentPlan.name,
      url: currentPlan.url,
      totalUnits: currentPlan.totalUnits,
      priceRange: currentPlan.priceRange,
      units: unitChanges,
    });
  }
  
  return {
    date: currentData.date,
    timestamp: currentData.timestamp,
    plans: planReports,
  };
}

/**
 * Check if the report contains any meaningful updates
 * @param {Object} report - Report object with plan reports
 * @returns {boolean} - True if there are new, removed, increased, or decreased units
 */
function hasUpdates(report) {
  const allUnits = report.plans.flatMap(p => p.units);
  const hasChanges = allUnits.some(unit => 
    unit.status === 'new' || 
    unit.status === 'removed' || 
    unit.status === 'increased' || 
    unit.status === 'decreased'
  );
  return hasChanges;
}

/**
 * Print a summary of the report to console
 * @param {Object} report - Report object with plan reports
 */
function printReportSummary(report) {
  console.log('\n' + '='.repeat(70));
  console.log(`RENT PRICE REPORT - ${report.date}`);
  console.log('='.repeat(70) + '\n');
  
  for (const planReport of report.plans) {
    console.log(`${planReport.planName}`);
    console.log(`  URL: ${planReport.url}`);
    console.log(`  Total Units: ${planReport.totalUnits}`);
    
    if (planReport.priceRange) {
      console.log(`  Price Range: $${planReport.priceRange.min.toLocaleString()} - $${planReport.priceRange.max.toLocaleString()}`);
    }
    
    console.log('  Units:');
    
    for (const unit of planReport.units) {
      const unitLabel = unit.unitNumber || 'Unknown';
      const floorLabel = unit.floor ? ` (Floor ${unit.floor})` : '';
      const priceStr = unit.currentPrice ? `$${unit.currentPrice.toLocaleString()}` : 'N/A';
      
      let statusStr;
      switch (unit.status) {
        case 'decreased':
          statusStr = `↓ DECREASED by $${Math.abs(unit.difference).toLocaleString()}`;
          break;
        case 'increased':
          statusStr = `↑ INCREASED by $${Math.abs(unit.difference).toLocaleString()}`;
          break;
        case 'new':
          statusStr = '★ NEW';
          break;
        case 'removed':
          statusStr = '✕ REMOVED';
          break;
        default:
          statusStr = '– No change';
      }
      
      console.log(`    • ${unitLabel}${floorLabel}: ${priceStr} - ${statusStr}`);
      if (unit.availability && unit.availability !== 'Unknown') {
        console.log(`      Available: ${unit.availability}`);
      }
    }
    
    console.log();
  }
  
  console.log('='.repeat(70) + '\n');
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
    
    // Step 4: Send email notification (conditional based on SEND_MODE)
    console.log('Step 4: Checking if email should be sent...');
    const sendMode = process.env.SEND_MODE || 'always';
    const reportHasUpdates = hasUpdates(report);
    
    console.log(`Send mode: ${sendMode}`);
    console.log(`Report has updates: ${reportHasUpdates}`);
    
    let shouldSendEmail = false;
    
    if (sendMode === 'always') {
      console.log('Mode is "always" - sending email regardless of updates');
      shouldSendEmail = true;
    } else if (sendMode === 'conditional') {
      if (reportHasUpdates) {
        console.log('Mode is "conditional" and updates found - sending email');
        shouldSendEmail = true;
      } else {
        console.log('Mode is "conditional" but no updates found - skipping email');
        shouldSendEmail = false;
      }
    } else {
      console.log(`Unknown send mode "${sendMode}" - defaulting to always send`);
      shouldSendEmail = true;
    }
    
    if (shouldSendEmail) {
      console.log('Sending email report...');
      try {
        await sendReport(report);
      } catch (error) {
        console.error('Warning: Could not send email:', error.message);
        console.log('Continuing to save history...');
      }
    } else {
      console.log('Email sending skipped (no updates for conditional send)');
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
