# Custom Email Subject Lines

The rent tracker automatically generates custom subject lines based on what changed in the latest scan.

## Subject Line Examples

### 1. 📊 No Changes
**When:** All units have the same prices and availability as the last check.

**Example:**
```
📊 No Changes - 2026-01-18
```

**Email shows:** All units with "No change" status.

---

### 2. ✨ New Listings Available
**When:** One or more new units become available (that weren't listed before).

**Examples:**
```
✨ 1 New Listing Available - 2026-01-18
✨ 3 New Listings Available - 2026-01-18
```

**Email shows:** New units marked with ★ "New Listing" badge.

---

### 3. 💰 Price Changes
**When:** Prices increased or decreased, but no new or removed listings.

**Examples:**
```
💰 Price Changes: 2 ↓ - 2026-01-18
💰 Price Changes: 1 ↓, 3 ↑ - 2026-01-18
💰 Price Changes: 5 ↑ - 2026-01-18
```

**Email shows:** 
- ↓ Units with decreased prices (green badge)
- ↑ Units with increased prices (red badge)
- Previous prices shown as "was $X,XXX/mo"

---

### 4. 🚫 Listings Removed
**When:** One or more previously available units are no longer available.

**Examples:**
```
🚫 1 Listing Removed - 2026-01-18
🚫 3 Listings Removed - 2026-01-18
```

**Email shows:**
- Removed units with **strikethrough** text
- ✕ "Removed" badge (red)
- Faded appearance (60% opacity)
- Red availability badge

---

## Priority Order

If multiple changes happen at once, the subject line follows this priority:

1. **Listings Removed** (highest priority)
2. **New Listings**
3. **Price Changes**
4. **No Changes** (lowest priority)

### Example Scenario

If in the same update:
- 2 units are removed
- 1 new unit appears
- 3 prices increase

**Subject line will be:** `🚫 2 Listings Removed - 2026-01-18`

The email body will show all changes (removed, new, and price changes), but the subject highlights the most important change (removals).

---

## Visual Styling

### Removed Units
- Text has strikethrough
- Entire row is faded (60% opacity)
- Red availability badge instead of green
- Makes it immediately obvious which units are gone

### New Units
- Blue ★ badge
- Normal styling
- Stands out from unchanged units

### Price Changes
- Green ↓ for decreases
- Red ↑ for increases
- Shows previous price below current

### Unchanged Units
- Gray – badge
- Regular styling
- "No change" text
