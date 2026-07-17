# Airtable-Style Grid System

A complete, production-ready grid system with all Airtable features implemented.

## ✅ Features Implemented

- ✅ **Column Resizing** - Drag column borders to resize, persisted to localStorage
- ✅ **Column Reorder** - Drag & drop columns using @dnd-kit
- ✅ **Frozen First Column** - Row numbers stay visible while scrolling
- ✅ **Inline Cell Editing** - Click any cell to edit, auto-save on blur/Enter
- ✅ **Select & Multi-Select Pills** - Beautiful tag-based UI for select fields
- ✅ **Attachment Thumbnails** - Upload, preview, delete attachments via Supabase Storage
- ✅ **Virtualized Rows** - Smooth scrolling for 10k+ rows
- ✅ **Scroll Sync** - Header and body scroll together horizontally
- ✅ **Dynamic Field Types** - Automatically detects and renders correct cell type
- ✅ **Dynamic Columns** - Works with any Supabase table structure
- ✅ **Clean Tailwind UI** - Modern, responsive design

## 📁 File Structure

```
baserow-app/
├── components/grid/
│   ├── AirtableGridView.tsx      # Main grid component
│   ├── GridColumnHeader.tsx      # Column header with resize/reorder
│   ├── CellFactory.tsx            # Dynamic cell component resolver
│   └── cells/
│       ├── TextCell.tsx
│       ├── LongTextCell.tsx
│       ├── NumberCell.tsx
│       ├── DateCell.tsx
│       ├── SelectCell.tsx
│       ├── MultiSelectCell.tsx
│       ├── CheckboxCell.tsx
│       ├── AttachmentCell.tsx
│       ├── UrlCell.tsx
│       ├── EmailCell.tsx
│       └── JsonCell.tsx
├── lib/
│   ├── grid/
│   │   └── useGridData.ts         # Data loading/saving hook
│   └── icons.ts                   # Field type icons
└── types/
    └── fields.ts                   # Field type definitions
```

## 🚀 Usage

### Basic Example

```tsx
import AirtableGridView from '@/components/grid/AirtableGridView'
import type { TableField } from '@/types/fields'

function MyGrid() {
  const fields: TableField[] = [
    {
      id: '1',
      table_id: 'table-1',
      name: 'Name',
      type: 'text',
      position: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      table_id: 'table-1',
      name: 'Email',
      type: 'text', // Will be auto-detected as email
      position: 1,
      created_at: new Date().toISOString(),
    },
    // ... more fields
  ]

  return (
    <AirtableGridView
      tableName="contacts"
      viewName="default"
      rowHeight="medium"
      editable={true}
      fields={fields}
      onAddField={() => console.log('Add field')}
      onEditField={(fieldName) => console.log('Edit', fieldName)}
    />
  )
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tableName` | `string` | **required** | Supabase table name |
| `viewName` | `string` | `'default'` | View name for localStorage keys |
| `rowHeight` | `'short' \| 'medium' \| 'tall'` | `'medium'` | Row height preset |
| `editable` | `boolean` | `true` | Enable/disable cell editing |
| `fields` | `TableField[]` | `[]` | Field definitions |
| `onAddField` | `() => void` | `undefined` | Callback for add column button |
| `onEditField` | `(fieldName: string) => void` | `undefined` | Callback for edit column |

## 🔧 Field Types Supported

| Field Type | Cell Component | Features |
|------------|---------------|----------|
| `text` | TextCell | Single-line input |
| `long_text` | LongTextCell | Multi-line textarea |
| `number` | NumberCell | Number input with precision |
| `date` | DateCell | Date picker |
| `single_select` | SelectCell | Dropdown with pills |
| `multi_select` | MultiSelectCell | Multi-select with tags |
| `checkbox` | CheckboxCell | Boolean checkbox |
| `attachment` | AttachmentCell | File upload/thumbnail/preview |
| `url` | UrlCell | Clickable links |
| `email` | EmailCell | Mailto links |
| `json` | JsonCell | Read-only JSON viewer |

## 📦 Dependencies

All required dependencies are already in `package.json`:

- `@dnd-kit/core` - Drag and drop
- `@dnd-kit/sortable` - Sortable lists
- `@dnd-kit/utilities` - DnD utilities
- `@supabase/supabase-js` - Database client
- `date-fns` - Date formatting
- `lucide-react` - Icons

## 🗄️ Database Setup

### Supabase Storage Bucket

Create a storage bucket named `attachments`:

```sql
-- In Supabase Dashboard > Storage
-- Create bucket: "attachments"
-- Set to public or configure RLS policies
```

### Table Structure

The grid works with **any** Supabase table. It automatically:
- Detects column types from PostgreSQL metadata
- Maps types to appropriate cell components
- Handles all CRUD operations

## 💾 Persistence

Column widths and order are automatically saved to `localStorage`:
- Key format: `grid_{tableName}_{viewName}_widths`
- Key format: `grid_{tableName}_{viewName}_order`

## 🎨 Styling

All components use Tailwind CSS. Customize by:
1. Modifying Tailwind classes in components
2. Adding custom CSS classes
3. Using Tailwind config for theme customization

## 🔍 Virtualization

The grid uses custom virtualization:
- Only renders visible rows + buffer
- Smooth scrolling for 10k+ rows
- Automatic height calculation
- Efficient re-renders

## 📱 Mobile Support

- Touch-friendly drag handles
- Responsive column widths
- Scroll works on mobile
- Editing disabled on mobile (can be enabled)

## 🐛 Troubleshooting

### Attachments not uploading
- Ensure `attachments` bucket exists in Supabase Storage
- Check bucket permissions (public or RLS policies)
- Verify Supabase client is configured correctly

### Columns not saving order/width
- Check browser localStorage is enabled
- Verify no storage quota exceeded
- Check console for errors

### Performance issues
- Reduce `limit` in `useGridData` if loading too many rows
- Check network tab for slow queries
- Consider adding indexes to frequently filtered/sorted columns

## 🚧 Future Enhancements

Potential additions:
- [ ] Column filtering UI
- [ ] Row grouping
- [ ] Column hiding/showing
- [ ] Export to CSV/Excel
- [ ] Bulk edit mode
- [ ] Row selection
- [ ] Keyboard navigation (arrow keys, tab)

## 📝 Notes

- All table/field names are dynamic - no hardcoding
- Works with any Supabase table structure
- Fully typed with TypeScript
- Production-ready error handling
- Optimistic UI updates
