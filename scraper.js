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
    
    let price = null;
    let availability = 'Unknown';
    let planName = plan.name;
    
    // Try multiple selectors for price (apartment sites vary in structure)
    const priceSelectors = [
      '.price',
      '.rent-price',
      '.unit-price',
      '[data-price]',
      '.starting-at',
      '.plan-price',
      '.detail-price',
      '.spaces-detail-price',
      '.spaces-price',
    ];
    
    // Try to find price using various selectors
    for (const selector of priceSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          const extractedPrice = extractPrice(text);
          if (extractedPrice) {
            price = extractedPrice;
            break;
          }
        }
      } catch {
        // Selector not found, continue to next
      }
    }
    
    // If no price found with specific selectors, search the page content
    if (!price) {
      const pageContent = await page.content();
      
      // Look for price patterns in the page
      const pricePatterns = [
        /Starting\s+(?:at\s+)?\$[\d,]+/gi,
        /\$[\d,]+\s*(?:\/\s*mo|per\s+month|monthly)/gi,
        /rent[:\s]+\$[\d,]+/gi,
        /price[:\s]+\$[\d,]+/gi,
      ];
      
      for (const pattern of pricePatterns) {
        const match = pageContent.match(pattern);
        if (match) {
          const extractedPrice = extractPrice(match[0]);
          if (extractedPrice && extractedPrice > 500 && extractedPrice < 10000) {
            price = extractedPrice;
            break;
          }
        }
      }
    }
    
    // Try to find availability information
    const availabilitySelectors = [
      '.availability',
      '.available-units',
      '.units-available',
      '.move-in-date',
      '.available-date',
      '.spaces-availability',
    ];
    
    for (const selector of availabilitySelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text && text.trim()) {
            availability = text.trim();
            break;
          }
        }
      } catch {
        // Selector not found, continue
      }
    }
    
    // Look for availability in page text if not found
    if (availability === 'Unknown') {
      const bodyText = await page.locator('body').textContent();
      
      // Check for common availability patterns
      if (/available\s+now/i.test(bodyText)) {
        availability = 'Available Now';
      } else if (/no\s+units?\s+available/i.test(bodyText)) {
        availability = 'No Units Available';
      } else {
        // Look for date patterns
        const dateMatch = bodyText.match(/available\s+(\w+\s+\d{1,2}(?:,?\s+\d{4})?)/i);
        if (dateMatch) {
          availability = `Available ${dateMatch[1]}`;
        }
      }
    }
    
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
    
    return {
      name: planName,
      url: plan.url,
      price,
      priceFormatted: price ? `$${price.toLocaleString()}` : 'N/A',
      availability,
      scrapedAt: new Date().toISOString(),
      success: true,
    };
  } catch (error) {
    console.error(`Error scraping ${plan.name}:`, error.message);
    return {
      name: plan.name,
      url: plan.url,
      price: null,
      priceFormatted: 'N/A',
      availability: 'Error',
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
