"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table } from "@/types/database"

interface ActionDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: any[]
  fields: any[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function ActionDataSettings({
  config,
  tables,
  onUpdate,
}: ActionDataSettingsProps) {
  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-2">
        <Label>Label *</Label>
        <Input
          value={config.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Button label"
        />
      </div>

      {/* Action Type */}
      <div className="space-y-2">
        <Label>Action Type *</Label>
        <Select
          value={config.action_type || "navigate"}
          onValueChange={(value) => onUpdate({ action_type: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="navigate">Navigate</SelectItem>
            <SelectItem value="create_record">Create Record</SelectItem>
            <SelectItem value="redirect">Redirect</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Target based on action type */}
      {config.action_type === "navigate" && (
        <div className="space-y-2">
          <Label>Route</Label>
          <Input
            value={config.route || ""}
            onChange={(e) => onUpdate({ route: e.target.value })}
            placeholder="/pages/123"
          />
        </div>
      )}

      {config.action_type === "create_record" && (
        <div className="space-y-2">
          <Label>Table *</Label>
          <Select
            value={config.table_id || ""}
            onValueChange={(value) => onUpdate({ table_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a table" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.action_type === "redirect" && (
        <div className="space-y-2">
          <Label>URL *</Label>
          <Input
            type="url"
            value={config.url || ""}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
      )}

      {/* Confirmation */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label>Require Confirmation</Label>
          <Switch
            checked={!!config.confirmation_message}
            onCheckedChange={(checked) => {
              if (checked) {
                onUpdate({ confirmation_message: "Are you sure?" })
              } else {
                onUpdate({ confirmation_message: undefined })
              }
            }}
          />
        </div>
        {config.confirmation_message && (
          <Textarea
            value={config.confirmation_message || ""}
            onChange={(e) => onUpdate({ confirmation_message: e.target.value })}
            placeholder="Confirmation message"
            rows={2}
          />
        )}
      </div>
    </div>
  )
}

