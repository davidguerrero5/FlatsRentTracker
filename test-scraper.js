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
    
    // Look for price patterns
    console.log('\n--- Looking for prices ---');
    const priceMatches = bodyText.match(/\$[\d,]+/g);
    if (priceMatches) {
      console.log('Found prices:', priceMatches.slice(0, 10));
    }
    
    // Get page HTML structure
    console.log('\n--- HTML Structure ---');
    const html = await page.content();
    
    // Look for elements with common price class names
    const selectors = ['.price', '.rent', '.starting', '[data-price]', '.amount'];
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements with selector: ${selector}`);
        const text = await elements[0].textContent();
        console.log(`  First element text: ${text}`);
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
