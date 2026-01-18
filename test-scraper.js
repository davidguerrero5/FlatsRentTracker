import { chromium } from 'playwright';

async function testScrape() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false }); // Set to false to see what's happening
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    const url = 'https://citylineflats.com/apartments/?spaces_tab=plan-detail&detail=162036';
    console.log('Navigating to:', url);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Page loaded!');
    
    // Wait for content
    await page.waitForTimeout(5000);
    
    // Take a screenshot
    await page.screenshot({ path: 'screenshot.png', fullPage: true });
    console.log('Screenshot saved to screenshot.png');
    
    // Get all text content
    const bodyText = await page.locator('body').textContent();
    console.log('\n--- Page Text (first 2000 chars) ---');
    console.log(bodyText.substring(0, 2000));
    
    // Look for unit patterns
    console.log('\n--- Looking for Unit Listings ---');
    const unitPattern = /Unit\s+(\d{3}-\d{3}|\d{3,4}[A-Z]?)[\s\S]{0,500}?\$(\d{1,2},?\d{3})\s*\/\s*mo/gi;
    let match;
    const foundUnits = [];
    
    while ((match = unitPattern.exec(bodyText)) !== null) {
      const unitNumber = match[1];
      const price = match[2];
      foundUnits.push({ unitNumber, price: `$${price}` });
    }
    
    if (foundUnits.length > 0) {
      console.log(`Found ${foundUnits.length} unit listings:`);
      foundUnits.forEach(unit => {
        console.log(`  - Unit ${unit.unitNumber}: ${unit.price}/mo`);
      });
    } else {
      console.log('No unit listings found with pattern "Unit XXX-XXX $X,XXX /mo"');
    }
    
    // Look for all prices
    console.log('\n--- All Prices Found on Page ---');
    const priceMatches = bodyText.match(/\$[\d,]+/g);
    if (priceMatches) {
      const uniquePrices = [...new Set(priceMatches)].slice(0, 15);
      console.log('Unique prices (first 15):', uniquePrices.join(', '));
    }
    
    // Look for unit containers
    console.log('\n--- Looking for Unit Container Elements ---');
    const containerSelectors = ['.unit-card', '.apartment-card', '.unit-item', '.availability-item', '.spaces-item', '[data-unit-id]'];
    for (const selector of containerSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements with selector: ${selector}`);
      }
    }
    
    // Wait before closing so you can inspect
    console.log('\nBrowser will stay open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testScrape();
