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
    await page.waitForTimeout(2000);
    
    // Look for article elements with data-spaces-unit attribute (specific to this website)
    const unitArticles = await page.$$('article[data-spaces-unit]');
    
    console.log(`  Found ${unitArticles.length} unit articles`);
    
    if (unitArticles.length > 0) {
      // Use the structured data from article elements
      for (const article of unitArticles) {
        try {
          // Get unit number from data attribute
          const unitNumber = await article.getAttribute('data-spaces-unit');
          if (!unitNumber) continue;
          
          // Get price from the .spaces-unit-price element
          const priceElement = await article.$('.spaces-unit-price');
          if (!priceElement) continue;
          
          const priceText = await priceElement.textContent();
          const price = parseInt(priceText.replace(/[$,]/g, ''), 10);
          
          if (price < 1000 || price > 20000) continue;
          
          // Get availability date - prioritize the actual text display
          let availability = 'Unknown';
          
          // First: check the availability text element (most accurate for "Available Now")
          const availElement = await article.$('[data-spaces-control="unit-default-available-date"]');
          if (availElement) {
            const availText = await availElement.textContent();
            
            // Check if it says "Now" anywhere
            if (/now/i.test(availText)) {
              availability = 'Available Now';
            } else {
              // Extract the date part (e.g., "Avail.\n Feb 20" -> "Feb 20")
              const dateMatch = availText.match(/([A-Z][a-z]+\s+\d{1,2})/);
              if (dateMatch) {
                availability = dateMatch[1];
              }
            }
          }
          
          // Fallback: if still unknown, try data-spaces-soonest attribute
          if (availability === 'Unknown') {
            const soonestDate = await article.getAttribute('data-spaces-soonest');
            if (soonestDate) {
              // Format: "2026-02-20" -> "Feb 20"
              const date = new Date(soonestDate);
              const month = date.toLocaleDateString('en-US', { month: 'short' });
              const day = date.getDate();
              availability = `${month} ${day}`;
            }
          }
          
          // Extract floor from unit number
          const floorFromUnit = unitNumber.match(/^(\d)/);
          const floor = floorFromUnit ? floorFromUnit[1] : null;
          
          units.push({
            unitNumber,
            floor,
            price,
            priceFormatted: `$${price.toLocaleString()}`,
            availability,
          });
          
          console.log(`    ✓ Unit ${unitNumber}: $${price} - ${availability}`);
          
        } catch (error) {
          console.log(`    ✗ Error processing unit: ${error.message}`);
          continue;
        }
      }
    }
    
    // Fallback: if no articles found, try text-based extraction
    if (units.length === 0) {
      console.log('  No article elements found, trying text-based extraction...');
      
      const bodyText = await page.textContent('body');
      const unitPattern = /Unit\s+(\d{3}-\d{3}|\d{3,4}[A-Z]?)([\s\S]{0,500}?)\$(\d{1,2},?\d{3})\s*\/\s*mo/gi;
      let match;
      
      while ((match = unitPattern.exec(bodyText)) !== null) {
        const unitNumber = match[1];
        const contextText = match[2];
        const priceStr = match[3];
        const price = parseInt(priceStr.replace(/,/g, ''), 10);
        
        if (price >= 1000 && price <= 20000) {
          if (!units.find(u => u.unitNumber === unitNumber)) {
            const floorFromUnit = unitNumber.match(/^(\d)/);
            
            let availability = 'Call for Details';
            if (/Avail\.\s*Now|Available\s*Now/i.test(contextText)) {
              availability = 'Available Now';
            } else {
              const datePatterns = [
                /Avail\.\s*([A-Z][a-z]+\s+\d{1,2})/i,
                /Avail\.\s*(\d{1,2}[\/\-]\d{1,2})/i,
              ];
              
              for (const pattern of datePatterns) {
                const dateMatch = contextText.match(pattern);
                if (dateMatch) {
                  availability = dateMatch[1];
                  break;
                }
              }
            }
            
            units.push({
              unitNumber,
              floor: floorFromUnit ? floorFromUnit[1] : null,
              price,
              priceFormatted: `$${price.toLocaleString()}`,
              availability,
            });
            
            console.log(`    ✓ Unit ${unitNumber}: $${price} - ${availability}`);
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
