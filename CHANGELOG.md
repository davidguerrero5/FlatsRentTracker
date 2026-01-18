# Changelog

## 2026-01-18 - Individual Unit Tracking

### Major Changes

#### 1. Unit-Level Price Tracking
- **Previous behavior**: Tracked one price per floor plan
- **New behavior**: Tracks individual units with their own prices, floor numbers, and availability

#### 2. Enhanced Scraper
- Extracts individual unit listings from each floor plan page
- Captures unit number, floor, price, and availability date
- Falls back to extracting all prices found if structured unit data isn't available
- More resilient timeout handling (60s timeout, `domcontentloaded` instead of `networkidle`)

#### 3. Improved Email Reports
- Shows all available units grouped by floor plan
- Displays price range for each plan
- Individual unit details with:
  - Unit number and floor
  - Current and previous prices
  - Change status (new, increased, decreased, unchanged, removed)
  - Availability date

#### 4. Better Console Output
- Detailed summary showing all units
- Price ranges per plan
- Individual unit status changes

### Data Structure Changes

**Old structure:**
```json
{
  "date": "2026-01-18",
  "plans": [
    {
      "name": "Plan B",
      "price": 5010,
      "availability": "Available Now"
    }
  ]
}
```

**New structure:**
```json
{
  "date": "2026-01-18",
  "plans": [
    {
      "name": "Plan B",
      "totalUnits": 3,
      "priceRange": { "min": 5010, "max": 5114 },
      "units": [
        {
          "unitNumber": "201",
          "floor": "2",
          "price": 5010,
          "availability": "Available Now"
        }
      ]
    }
  ]
}
```

### Files Modified

- **scraper.js**: Added `extractUnits()` function to parse individual unit data
- **index.js**: Updated comparison logic to track individual units
- **notifier.js**: Redesigned email template to show units grouped by plan
- **.gitignore**: Added screenshot.png to ignored files

### Testing

Test the new functionality:

```bash
# Clear old history to start fresh
echo "[]" > data/history.json

# Run the scraper
npm start

# Or test just the email template
node notifier.js
```

### Backwards Compatibility

⚠️ **Breaking Change**: The old `history.json` format is not compatible with the new structure. Clear your history file before running the updated version.
