import 'dotenv/config';
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
 * @param {Object} report - Report object with date and plans
 * @returns {string} - HTML email content
 */
function generateEmailHtml(report) {
  const { date, plans } = report;
  
  // Generate HTML for each plan
  const plansHtml = plans
    .map((plan) => {
      const priceRangeText = plan.priceRange
        ? `$${plan.priceRange.min.toLocaleString()} - $${plan.priceRange.max.toLocaleString()}`
        : 'N/A';
      
      const unitsHtml = plan.units
        .map((unit) => {
          const format = formatChange(unit);
          const unitLabel = unit.unitNumber ? `Unit ${unit.unitNumber}` : 'Unit';
          const priceDisplay = unit.currentPrice
            ? `$${unit.currentPrice.toLocaleString()}/mo`
            : 'N/A';
          const previousDisplay = unit.previousPrice
            ? `$${unit.previousPrice.toLocaleString()}`
            : '–';
          
          // Format availability prominently - always show it
          const availabilityText = unit.availability || 'Unknown';
          const availabilityHtml = `<div style="margin-top: 6px; padding: 4px 10px; background-color: #f0fdf4; color: #16a34a; border-radius: 4px; font-size: 12px; font-weight: 500; display: inline-block;">📅 ${availabilityText}</div>`;
          
          return `
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                <div style="font-weight: 600; font-size: 15px; color: #1f2937; margin-bottom: 4px;">${unitLabel}</div>
                ${availabilityHtml}
              </td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: top;">
                <span style="font-size: 18px; font-weight: 700; color: #1f2937;">${priceDisplay}</span>
                ${unit.previousPrice ? `<br><span style="color: #9ca3af; font-size: 11px;">was ${previousDisplay}/mo</span>` : ''}
              </td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: ${format.bgColor}; color: ${format.color}; font-size: 12px; font-weight: 500;">
                  ${format.icon} ${format.text}
                </span>
              </td>
            </tr>
          `;
        })
        .join('');
      
      return `
        <div style="margin-bottom: 24px;">
          <div style="background-color: #f9fafb; padding: 12px 16px; border-left: 4px solid #3b82f6;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #1f2937;">
              ${plan.planName}
            </h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">
              ${plan.totalUnits} unit${plan.totalUnits !== 1 ? 's' : ''} available • Price range: ${priceRangeText}
            </p>
          </div>
          <table style="width: 100%; border-collapse: collapse; background-color: white;">
            <thead>
              <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Unit & Availability</th>
                <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Monthly Rent</th>
                <th style="padding: 10px 16px; text-align: center; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Change</th>
              </tr>
            </thead>
            <tbody>
              ${unitsHtml}
            </tbody>
          </table>
        </div>
      `;
    })
    .join('');
  
  // Count all unit changes across all plans
  const allUnits = plans.flatMap(p => p.units);
  const summary = {
    decreased: allUnits.filter((u) => u.status === 'decreased').length,
    increased: allUnits.filter((u) => u.status === 'increased').length,
    unchanged: allUnits.filter((u) => u.status === 'unchanged').length,
    new: allUnits.filter((u) => u.status === 'new').length,
    removed: allUnits.filter((u) => u.status === 'removed').length,
  };
  
  const summaryParts = [];
  if (summary.decreased > 0) summaryParts.push(`${summary.decreased} price drop${summary.decreased > 1 ? 's' : ''}`);
  if (summary.increased > 0) summaryParts.push(`${summary.increased} increase${summary.increased > 1 ? 's' : ''}`);
  if (summary.new > 0) summaryParts.push(`${summary.new} new unit${summary.new > 1 ? 's' : ''}`);
  if (summary.removed > 0) summaryParts.push(`${summary.removed} removed`);
  if (summary.unchanged > 0) summaryParts.push(`${summary.unchanged} unchanged`);
  
  const summaryText = summaryParts.length > 0 ? summaryParts.join(' • ') : 'No units found';
  
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
        
        <!-- Plans and Units -->
        <div style="padding: 20px; background-color: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          ${plansHtml}
        </div>
        
        <!-- Footer -->
        <div style="padding: 24px; text-align: center;">
          <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
            View listings directly:
          </p>
          <p style="margin: 0; font-size: 12px;">
            ${plans.map((p) => `<a href="${p.url}" style="color: #3b82f6; text-decoration: none;">${p.planName}</a>`).join(' • ')}
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
 * @param {Object} report - Report object with date and plans
 * @returns {string} - Plain text email content
 */
function generateEmailText(report) {
  const { date, plans } = report;
  
  let text = `RENT PRICE REPORT - ${date}\n`;
  text += `CityLine Flats\n`;
  text += '='.repeat(70) + '\n\n';
  
  for (const plan of plans) {
    const priceRangeText = plan.priceRange
      ? `$${plan.priceRange.min.toLocaleString()} - $${plan.priceRange.max.toLocaleString()}`
      : 'N/A';
    
    text += `${plan.planName}\n`;
    text += `  URL: ${plan.url}\n`;
    text += `  Total Units: ${plan.totalUnits}\n`;
    text += `  Price Range: ${priceRangeText}\n`;
    text += `  Units:\n`;
    
    for (const unit of plan.units) {
      const format = formatChange(unit);
      const unitLabel = unit.unitNumber || 'Unit';
      const floorLabel = unit.floor ? ` (Floor ${unit.floor})` : '';
      const priceDisplay = unit.currentPrice
        ? `$${unit.currentPrice.toLocaleString()}`
        : 'N/A';
      
      text += `    • ${unitLabel}${floorLabel}: ${priceDisplay} - ${format.text}\n`;
      if (unit.availability && unit.availability !== 'Unknown') {
        text += `      Available: ${unit.availability}\n`;
      }
    }
    
    text += '\n';
  }
  
  text += '-'.repeat(70) + '\n';
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
  
  // Support multiple recipients - comma-separated string becomes array
  const recipients = recipientEmail.includes(',')
    ? recipientEmail.split(',').map(e => e.trim())
    : recipientEmail;
  
  console.log(`Sending email report to ${Array.isArray(recipients) ? recipients.join(', ') : recipients}...`);
  
  try {
    const result = await resend.emails.send({
      from: senderEmail,
      to: recipients,
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
    plans: [
      {
        planName: 'Plan B',
        url: 'https://citylineflats.com/apartments/?spaces_tab=plan-detail&detail=162036',
        totalUnits: 3,
        priceRange: { min: 5010, max: 5114 },
        units: [
          {
            unitNumber: '350-201',
            floor: '3',
            currentPrice: 5010,
            previousPrice: 5100,
            difference: -90,
            status: 'decreased',
            availability: 'Available Now',
          },
          {
            unitNumber: '345-305',
            floor: '3',
            currentPrice: 5064,
            previousPrice: 5064,
            difference: 0,
            status: 'unchanged',
            availability: '01/25/2026',
          },
          {
            unitNumber: '412-109',
            floor: '4',
            currentPrice: 5114,
            previousPrice: null,
            difference: 0,
            status: 'new',
            availability: '02/10/2026',
          },
        ],
      },
      {
        planName: 'Plan C + Den',
        url: 'https://citylineflats.com/apartments/?spaces_tab=plan-detail&detail=162039',
        totalUnits: 3,
        priceRange: { min: 5411, max: 5426 },
        units: [
          {
            unitNumber: '350-227',
            floor: '3',
            currentPrice: 5411,
            previousPrice: null,
            difference: 0,
            status: 'new',
            availability: 'Available Now',
          },
          {
            unitNumber: '345-222',
            floor: '3',
            currentPrice: 5426,
            previousPrice: null,
            difference: 0,
            status: 'new',
            availability: 'Available Now',
          },
          {
            unitNumber: '345-208',
            floor: '3',
            currentPrice: 5426,
            previousPrice: null,
            difference: 0,
            status: 'new',
            availability: 'Available Now',
          },
        ],
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
