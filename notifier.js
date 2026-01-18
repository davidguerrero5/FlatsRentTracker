import { Resend } from 'resend';

/**
 * Format a price change for display
 * @param {Object} change - Change object with status and price info
 * @returns {Object} - Formatted change with color and text
 */
function formatChange(change) {
  const { status, currentPrice, previousPrice, difference } = change;
  
  switch (status) {
    case 'decreased':
      return {
        color: '#16a34a', // green
        bgColor: '#dcfce7',
        icon: '↓',
        text: `Decreased by $${Math.abs(difference).toLocaleString()}`,
      };
    case 'increased':
      return {
        color: '#dc2626', // red
        bgColor: '#fee2e2',
        icon: '↑',
        text: `Increased by $${Math.abs(difference).toLocaleString()}`,
      };
    case 'new':
      return {
        color: '#2563eb', // blue
        bgColor: '#dbeafe',
        icon: '★',
        text: 'New Listing',
      };
    case 'unchanged':
    default:
      return {
        color: '#6b7280', // gray
        bgColor: '#f3f4f6',
        icon: '–',
        text: 'No change',
      };
  }
}

/**
 * Generate HTML email content from the report
 * @param {Object} report - Report object with date and changes
 * @returns {string} - HTML email content
 */
function generateEmailHtml(report) {
  const { date, changes } = report;
  
  const changesHtml = changes
    .map((change) => {
      const format = formatChange(change);
      const priceDisplay = change.currentPrice
        ? `$${change.currentPrice.toLocaleString()}`
        : 'N/A';
      const previousDisplay = change.previousPrice
        ? `$${change.previousPrice.toLocaleString()}`
        : '–';
      
      return `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
            <strong>${change.name}</strong>
            ${change.availability ? `<br><span style="color: #6b7280; font-size: 12px;">${change.availability}</span>` : ''}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <span style="font-size: 18px; font-weight: 600;">${priceDisplay}</span>
            ${change.previousPrice ? `<br><span style="color: #9ca3af; font-size: 12px;">was ${previousDisplay}</span>` : ''}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: ${format.bgColor}; color: ${format.color}; font-size: 13px; font-weight: 500;">
              ${format.icon} ${format.text}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');
  
  // Count changes by type
  const summary = {
    decreased: changes.filter((c) => c.status === 'decreased').length,
    increased: changes.filter((c) => c.status === 'increased').length,
    unchanged: changes.filter((c) => c.status === 'unchanged').length,
    new: changes.filter((c) => c.status === 'new').length,
  };
  
  const summaryParts = [];
  if (summary.decreased > 0) summaryParts.push(`${summary.decreased} price drop${summary.decreased > 1 ? 's' : ''}`);
  if (summary.increased > 0) summaryParts.push(`${summary.increased} increase${summary.increased > 1 ? 's' : ''}`);
  if (summary.new > 0) summaryParts.push(`${summary.new} new listing${summary.new > 1 ? 's' : ''}`);
  if (summary.unchanged > 0) summaryParts.push(`${summary.unchanged} unchanged`);
  
  const summaryText = summaryParts.length > 0 ? summaryParts.join(' • ') : 'No changes detected';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
            🏠 Rent Price Report
          </h1>
          <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
            CityLine Flats • ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <!-- Summary -->
        <div style="background-color: white; padding: 16px 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #4b5563; font-size: 14px; text-align: center;">
            ${summaryText}
          </p>
        </div>
        
        <!-- Table -->
        <div style="background-color: white; border-radius: 0 0 12px 12px; overflow: hidden; border: 1px solid #e5e7eb; border-top: none;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Floor Plan</th>
                <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Price</th>
                <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${changesHtml}
            </tbody>
          </table>
        </div>
        
        <!-- Footer -->
        <div style="padding: 24px; text-align: center;">
          <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
            View listings directly:
          </p>
          <p style="margin: 0; font-size: 12px;">
            ${changes.map((c) => `<a href="${c.url}" style="color: #3b82f6; text-decoration: none;">${c.name}</a>`).join(' • ')}
          </p>
          <p style="margin: 16px 0 0 0; color: #d1d5db; font-size: 11px;">
            This report is generated automatically by Flats Rent Tracker
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text email content from the report
 * @param {Object} report - Report object with date and changes
 * @returns {string} - Plain text email content
 */
function generateEmailText(report) {
  const { date, changes } = report;
  
  let text = `RENT PRICE REPORT - ${date}\n`;
  text += `CityLine Flats\n`;
  text += '='.repeat(50) + '\n\n';
  
  for (const change of changes) {
    const format = formatChange(change);
    const priceDisplay = change.currentPrice
      ? `$${change.currentPrice.toLocaleString()}`
      : 'N/A';
    
    text += `${change.name}\n`;
    text += `  Price: ${priceDisplay}\n`;
    text += `  Status: ${format.text}\n`;
    if (change.availability) {
      text += `  Availability: ${change.availability}\n`;
    }
    text += `  URL: ${change.url}\n`;
    text += '\n';
  }
  
  text += '-'.repeat(50) + '\n';
  text += 'Generated by Flats Rent Tracker\n';
  
  return text;
}

/**
 * Send the price report via email using Resend
 * @param {Object} report - Report object with date and changes
 * @returns {Promise<Object>} - Result from Resend API
 */
export async function sendReport(report) {
  const apiKey = process.env.RESEND_API_KEY;
  const recipientEmail = process.env.RECIPIENT_EMAIL;
  const senderEmail = process.env.SENDER_EMAIL || 'onboarding@resend.dev';
  
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  
  if (!recipientEmail) {
    throw new Error('RECIPIENT_EMAIL environment variable is not set');
  }
  
  const resend = new Resend(apiKey);
  
  const subject = `🏠 Rent Report: ${report.date} - CityLine Flats`;
  
  console.log(`Sending email report to ${recipientEmail}...`);
  
  try {
    const result = await resend.emails.send({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: generateEmailHtml(report),
      text: generateEmailText(report),
    });
    
    console.log('Email sent successfully!');
    console.log('Email ID:', result.data?.id || result.id);
    
    return result;
  } catch (error) {
    console.error('Failed to send email:', error.message);
    throw error;
  }
}

/**
 * Create a test report for development/testing
 * @returns {Object} - Sample report object
 */
export function createTestReport() {
  return {
    date: new Date().toISOString().split('T')[0],
    changes: [
      {
        name: 'Plan B',
        url: 'https://citylineflats.com/apartments/?spaces_tab=plan-detail&detail=162036',
        currentPrice: 1850,
        previousPrice: 1900,
        difference: -50,
        status: 'decreased',
        availability: 'Available Now',
      },
      {
        name: 'Plan C + Den',
        url: 'https://citylineflats.com/apartments/?spaces_tab=plan-detail&detail=162039',
        currentPrice: 2100,
        previousPrice: 2100,
        difference: 0,
        status: 'unchanged',
        availability: '2 Units Available',
      },
    ],
  };
}

// Allow running directly for testing
if (process.argv[1] && process.argv[1].endsWith('notifier.js')) {
  const testReport = createTestReport();
  console.log('Test Report:');
  console.log(JSON.stringify(testReport, null, 2));
  console.log('\nGenerated HTML Preview:');
  console.log(generateEmailHtml(testReport));
  
  // Only send if API key is set
  if (process.env.RESEND_API_KEY && process.env.RECIPIENT_EMAIL) {
    sendReport(testReport)
      .then(() => console.log('Test email sent!'))
      .catch((error) => console.error('Failed to send test email:', error));
  } else {
    console.log('\nSkipping email send (RESEND_API_KEY or RECIPIENT_EMAIL not set)');
  }
}
