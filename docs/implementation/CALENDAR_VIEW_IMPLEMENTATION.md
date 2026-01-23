# Hybrid Calendar View Implementation

A complete, production-ready hybrid calendar view system for the Marketing Hub.

## ✅ Features Implemented

### 1. Calendar View Definition
- ✅ Calendar view type stored in `views` table
- ✅ Configuration stored in `views.config` JSONB field:
  - `calendar_date_field` - Single date field
  - `calendar_start_field` - Start date for multi-day events
  - `calendar_end_field` - End date for multi-day events
  - `calendar_color_field` - Select field for color coding
  - `first_day_of_week` - Configurable (0-6)
  - `show_weekends` - Toggle weekends
  - `event_density` - Compact or expanded mode

### 2. Hybrid Layout
- ✅ **Month Grid** - Google Calendar style
  - 7 columns (Mon-Sun, configurable start day)
  - 5-6 rows as needed
  - Today highlighted
  - Fade for outside-month days
  - Event cards inside cells
  - Multi-day events as horizontal spanning bars
  - Drag events between days
  - Resize event duration by dragging edges

- ✅ **Agenda Panel** (Right-side)
  - Shows events for selected day
  - Sorted by time
  - Click event to open record
  - "+ Add event" button

- ✅ **Top Toolbar**
  - Month selector (prev/next)
  - Date picker
  - "Today" button
  - Settings gear icon
  - Month/Agenda toggle
  - Search bar

### 3. Data Loading
- ✅ Loads rows dynamically from any Supabase table
- ✅ Auto-detects date fields
- ✅ Maps rows to event objects
- ✅ Supports single date OR start+end dates

### 4. Event Rendering
- ✅ Single-day events as colored chips
- ✅ Multi-day events as spanning bars
- ✅ Color coding from select fields
- ✅ Default pastel color palette

### 5. Event Editing
- ✅ Click event → opens record (navigates to row detail)
- ✅ Drag event → moves to new date
- ✅ Drag edge → resizes event range
- ✅ Auto-saves to Supabase

### 6. Event Creation
- ✅ Click cell → opens create modal
- ✅ "+ Add event" button in agenda
- ✅ Auto-fills date from selection
- ✅ Supports single or start+end dates

### 7. Settings Drawer
- ✅ Choose date field(s)
- ✅ Choose color field
- ✅ First day of week
- ✅ Show/hide weekends
- ✅ Event density mode
- ✅ Saves to `views.config`

### 8. Accessibility & UX
- ✅ Keyboard navigation ready
- ✅ Focus states
- ✅ Smooth transitions
- ✅ shadcn components used
- ✅ Responsive design

## 📁 Files Created

### Calendar Components
- `components/calendar/CalendarView.tsx` - Main calendar component
- `components/calendar/MonthGrid.tsx` - Month grid with drag-drop
- `components/calendar/AgendaPanel.tsx` - Right-side agenda panel
- `components/calendar/EventCard.tsx` - Event card component
- `components/calendar/CreateEventModal.tsx` - Event creation modal
- `components/calendar/CalendarSettings.tsx` - Settings drawer

### UI Components (Created/Updated)
- `components/ui/calendar.tsx` - Date picker component
- `components/ui/sheet.tsx` - Sheet/drawer component
- `components/ui/switch.tsx` - Toggle switch component

### Integration
- `baserow-app/app/tables/[tableId]/views/[viewId]/page.tsx` - Updated to use new CalendarView

## 🔧 Configuration

Calendar settings are stored in the `views` table's `config` JSONB field:

```json
{
  "calendar_date_field": "event_date",
  "calendar_start_field": null,
  "calendar_end_field": null,
  "calendar_color_field": "category",
  "first_day_of_week": 1,
  "show_weekends": true,
  "event_density": "compact"
}
```

## 🎯 Usage

The calendar view is automatically used when:
1. A view with `type = 'calendar'` exists
2. The view page loads and detects calendar type
3. CalendarView component receives:
   - `tableId` - Table ID
   - `viewId` - View ID
   - `rows` - Array of row data
   - `visibleFields` - Array of visible fields

## 🔄 Auto-Detection

The calendar automatically:
- Detects date fields in the table
- Suggests start/end fields if they exist
- Uses first text field as event title
- Maps select field values to colors

## 💾 Data Flow

1. **Load Config**: Reads from `views.config`
2. **Load Fields**: Fetches from `/api/tables/{tableId}/fields`
3. **Process Events**: Maps rows to CalendarEvent objects
4. **Update Events**: Saves to Supabase table directly
5. **Create Events**: Inserts new rows with date fields

## 🎨 Styling

- Uses Tailwind CSS
- Responsive design
- Mobile-friendly
- Smooth animations
- Accessible color contrast

## 🚀 Next Steps

The calendar is fully functional. Optional enhancements:
- [ ] Keyboard shortcuts (arrow keys, etc.)
- [ ] Week view
- [ ] Day view
- [ ] Event recurrence
- [ ] Time-based events (not just all-day)
- [ ] Event categories/colors UI
- [ ] Export to iCal

## 📝 Notes

- **Fully Dynamic**: No hardcoded tables or fields
- **Works with ANY table**: Automatically adapts to table structure
- **Type-Safe**: Full TypeScript support
- **Production-Ready**: Error handling, loading states, optimistic updates
