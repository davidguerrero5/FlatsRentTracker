import { chromium } from 'playwright';

/**
 * Floor plans to track with their URLs
 */
const FLOOR_PLANS = [
  {
    name: 'Plan B',
    url: 'https://citylineflats.com/apartments/?spaces_tab=plan-detail&detail=162036',
  },
  {
    name: 'Plan C + Den',
    url: 'https://citylineflats.com/apartments/?spaces_tab=plan-detail&detail=162039',
  },
];

/**
 * Extract price from text (handles formats like "$1,234", "$1234", "Starting at $1,234")
 * @param {string} text - Text containing a price
 * @returns {number|null} - Price as number or null if not found
 */
function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/\$[\d,]+/);
  if (match) {
    return parseInt(match[0].replace(/[$,]/g, ''), 10);
  }
  return null;
}

/**
 * Extract individual units from the page
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {Array} - Array of unit objects
 */
async function extractUnits(page) {
  const units = [];
  
  // Try to find unit tables or lists
  const unitRows = await page.$$('tr[data-unit], .unit-row, .available-unit, tbody tr');
  
  for (const row of unitRows) {
    try {
      const rowText = await row.textContent();
      
      // Skip header rows
      if (/unit|apartment|floor|price|rent|available/i.test(rowText) && rowText.length < 50) {
        continue;
      }
      
      // Extract unit number
      const unitMatch = rowText.match(/(?:Unit\s+)?([A-Z]?\d+[A-Z]?)/i);
      const unitNumber = unitMatch ? unitMatch[1] : null;
      
      // Extract floor
      const floorMatch = rowText.match(/(?:Floor\s+)?(\d+)(?:st|nd|rd|th)?/i);
      const floor = floorMatch ? floorMatch[1] : null;
      
      // Extract price
      const priceMatch = rowText.match(/\$[\d,]+/);
      const price = priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, ''), 10) : null;
      
      // Extract availability date
      let availability = 'Unknown';
      if (/available now|immediate/i.test(rowText)) {
        availability = 'Available Now';
      } else {
        const dateMatch = rowText.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/);
        if (dateMatch) {
          availability = dateMatch[1];
        }
      }
      
      // Only add if we found a price (main indicator of a valid unit)
      if (price && price > 1000 && price < 20000) {
        units.push({
          unitNumber,
          floor,
          price,
          priceFormatted: `$${price.toLocaleString()}`,
          availability,
        });
      }
    } catch (error) {
      // Skip problematic rows
      continue;
    }
  }
  
  return units;
}

/**
 * Scrape a single floor plan page for price and availability
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Object} plan - Plan object with name and url
 * @returns {Object} - Scraped data for the plan
 */
async function scrapePlan(page, plan) {
  console.log(`Scraping ${plan.name}...`);
  
  try {
    // Use 'domcontentloaded' instead of 'networkidle' for better reliability
    await page.goto(plan.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for the page to fully render
    await page.waitForTimeout(3000);
    
    let planName = plan.name;
    let units = [];
    
    // Extract individual units from the page
    units = await extractUnits(page);
    
    console.log(`  Found ${units.length} units for ${plan.name}`);
    
    // Try to get the actual plan name from the page
    const nameSelectors = [
      '.plan-name',
      '.floor-plan-name',
      '.unit-name',
      'h1',
      'h2',
      '.spaces-detail-name',
    ];
    
    for (const selector of nameSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text && text.trim() && text.trim().length < 50) {
            // Only use if it looks like a plan name
            if (/plan|bed|studio|den/i.test(text)) {
              planName = text.trim();
              break;
            }
          }
        }
      } catch {
        // Selector not found, continue
      }
    }
    
    // If no units found, try to get at least a summary price
    if (units.length === 0) {
      const bodyText = await page.locator('body').textContent();
      const priceMatches = bodyText.match(/\$[\d,]+/g);
      
      if (priceMatches) {
        console.log(`  No structured units found, but found prices: ${priceMatches.slice(0, 5).join(', ')}`);
        
        // Extract unique prices that look like rents (between $1,000 and $20,000)
        const validPrices = [...new Set(priceMatches)]
          .map(p => parseInt(p.replace(/[$,]/g, ''), 10))
          .filter(p => p > 1000 && p < 20000)
          .sort((a, b) => a - b);
        
        // Create a unit entry for each unique price
        validPrices.forEach((price, index) => {
          units.push({
            unitNumber: `Unit ${index + 1}`,
            floor: null,
            price,
            priceFormatted: `$${price.toLocaleString()}`,
            availability: 'Call for Details',
          });
        });
      }
    }
    
    return {
      name: planName,
      url: plan.url,
      units,
      totalUnits: units.length,
      priceRange: units.length > 0 ? {
        min: Math.min(...units.map(u => u.price)),
        max: Math.max(...units.map(u => u.price)),
      } : null,
      scrapedAt: new Date().toISOString(),
      success: true,
    };
  } catch (error) {
    console.error(`Error scraping ${plan.name}:`, error.message);
    return {
      name: plan.name,
      url: plan.url,
      units: [],
      totalUnits: 0,
      priceRange: null,
      scrapedAt: new Date().toISOString(),
      success: false,
      error: error.message,
    };
  }
}

/**
 * Scrape all floor plans and return the results
 * @returns {Promise<Object>} - Object containing date and array of plan data
 */
export async function scrapeAllPlans() {
  console.log('Starting scraper...');
  
  const browser = await chromium.launch({
    headless: true,
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  
  const page = await context.newPage();
  const results = [];
  
  try {
    for (const plan of FLOOR_PLANS) {
      const data = await scrapePlan(page, plan);
      results.push(data);
    }
  } finally {
    await browser.close();
  }
  
  const scraperResult = {
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    plans: results,
  };
  
  console.log('Scraping complete!');
  console.log(JSON.stringify(scraperResult, null, 2));
  
  return scraperResult;
}

// Allow running directly for testing
if (process.argv[1] && process.argv[1].endsWith('scraper.js')) {
  scrapeAllPlans()
    .then((result) => {
      console.log('\nFinal Result:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error('Scraper failed:', error);
      process.exit(1);
    });
}
