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
  
  try {
    // Wait for unit listings to load
    await page.waitForTimeout(1000);
    
    // Look for unit cards or containers - these appear to be the main unit listings
    // Based on the user's example, units have: unit number, price, availability, bed/bath, sq ft, plan name
    const unitContainers = await page.$$('.unit-card, .apartment-card, .unit-item, .availability-item, .spaces-item, [data-unit-id]');
    
    console.log(`  Found ${unitContainers.length} potential unit containers`);
    
    for (const container of unitContainers) {
      try {
        const containerText = await container.textContent();
        
        // Must contain a unit number pattern like "Unit 350-227" or similar
        const unitMatch = containerText.match(/Unit\s+(\d{3}-\d{3}|\d{3,4}[A-Z]?)/i);
        if (!unitMatch) continue;
        
        const unitNumber = unitMatch[1];
        
        // Must contain a price (monthly rent)
        const priceMatch = containerText.match(/\$[\d,]+\s*\/\s*mo/i);
        if (!priceMatch) continue;
        
        const price = parseInt(priceMatch[0].replace(/[$,\/mo]/gi, '').trim(), 10);
        
        // Only valid rental prices
        if (price < 1000 || price > 20000) continue;
        
        // Extract availability
        let availability = 'Unknown';
        if (/Avail\.\s*Now|Available\s*Now|Immediate/i.test(containerText)) {
          availability = 'Available Now';
        } else {
          // Look for date patterns
          const dateMatch = containerText.match(/Avail\.\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
          if (dateMatch) {
            availability = dateMatch[1];
          }
        }
        
        // Extract floor from unit number (e.g., Unit 350-227 -> floor 3, Unit 345-222 -> floor 3)
        const floorFromUnit = unitNumber.match(/^(\d)/);
        const floor = floorFromUnit ? floorFromUnit[1] : null;
        
        units.push({
          unitNumber,
          floor,
          price,
          priceFormatted: `$${price.toLocaleString()}`,
          availability,
        });
        
        console.log(`    ✓ Unit ${unitNumber}: $${price}`);
        
      } catch (error) {
        continue;
      }
    }
    
    // If no units found with the above method, try a more generic approach
    if (units.length === 0) {
      console.log('  Trying alternative extraction method...');
      
      // Get all text content
      const bodyText = await page.textContent('body');
      
      // Split into sections and look for unit patterns
      // Pattern: "Unit XXX-XXX" followed by "$X,XXX /mo" within a reasonable distance
      const unitPattern = /Unit\s+(\d{3}-\d{3}|\d{3,4}[A-Z]?)[\s\S]{0,500}?\$(\d{1,2},?\d{3})\s*\/\s*mo/gi;
      let match;
      
      while ((match = unitPattern.exec(bodyText)) !== null) {
        const unitNumber = match[1];
        const priceStr = match[2];
        const price = parseInt(priceStr.replace(/,/g, ''), 10);
        
        if (price >= 1000 && price <= 20000) {
          // Check if we already have this unit
          if (!units.find(u => u.unitNumber === unitNumber)) {
            const floorFromUnit = unitNumber.match(/^(\d)/);
            units.push({
              unitNumber,
              floor: floorFromUnit ? floorFromUnit[1] : null,
              price,
              priceFormatted: `$${price.toLocaleString()}`,
              availability: 'Call for Details',
            });
            
            console.log(`    ✓ Unit ${unitNumber}: $${price}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.log('  Error extracting units:', error.message);
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
    
    // Log a warning if no units found
    if (units.length === 0) {
      console.log(`  ⚠️  No units found for ${plan.name}. The page may have loaded incorrectly.`);
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
