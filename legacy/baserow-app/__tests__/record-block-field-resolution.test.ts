import { describe, it, expect } from "vitest"
import {
  resolveRecordBlockFields,
  resolveRecordBlockEditability,
} from "@/lib/interface/record-block-field-resolution"
import type { TableField } from "@/types/fields"
import type { BlockConfig } from "@/lib/interface/types"

const tableFields: TableField[] = [
  { id: "f1", name: "name", type: "text", table_id: "t1", position: 0 } as TableField,
  { id: "f2", name: "email", type: "email", table_id: "t1", position: 1 } as TableField,
  { id: "f3", name: "type", type: "single_select", table_id: "t1", position: 2 } as TableField,
]

describe("resolveRecordBlockFields", () => {
  it("honors detail_fields first", () => {
    const result = resolveRecordBlockFields(
      { detail_fields: ["name"], visible_fields: ["email"], modal_fields: ["type"] } as BlockConfig,
      tableFields
    )
    expect(result.fieldNames).toEqual(["name"])
  })

  it("detail_fields takes precedence over modal_fields", () => {
    const result = resolveRecordBlockFields(
      { detail_fields: ["email"], modal_fields: ["name", "type"] } as BlockConfig,
      tableFields
    )
    expect(result.fieldNames).toEqual(["email"])
    expect(result.fieldNames).not.toContain("type")
  })

  it("falls back to visible_fields when detail_fields empty", () => {
    const result = resolveRecordBlockFields(
      { visible_fields: ["name", "type"] } as BlockConfig,
      tableFields
    )
    expect(result.fieldNames).toEqual(["name", "type"])
  })

  it("falls back to modal_fields legacy", () => {
    const result = resolveRecordBlockFields(
      { modal_fields: ["email"] } as any,
      tableFields
    )
    expect(result.fieldNames).toEqual(["email"])
  })

  it("renders all non-system fields when no selection configured", () => {
    const result = resolveRecordBlockFields({}, tableFields)
    expect(result.fieldNames).toEqual(["name", "email", "type"])
  })

  it("ignores missing configured fields and lists them", () => {
    const result = resolveRecordBlockFields(
      { detail_fields: ["name", "deleted_field"] } as BlockConfig,
      tableFields
    )
    expect(result.fieldNames).toEqual(["name"])
    expect(result.missingFieldNames).toContain("deleted_field")
  })

  it("uses field_layout when no string arrays configured", () => {
    const result = resolveRecordBlockFields(
      {
        field_layout: [
          {
            field_id: "f2",
            field_name: "email",
            order: 0,
            editable: true,
            visible_in_canvas: true,
          },
        ],
      } as BlockConfig,
      tableFields
    )
    expect(result.fieldNames).toContain("email")
  })
})

describe("resolveRecordBlockEditability", () => {
  it("returns false when allow_editing is false", () => {
    expect(
      resolveRecordBlockEditability({ allow_editing: false } as BlockConfig, true, false)
    ).toBe(false)
  })

  it("returns false when pageEditable is false", () => {
    expect(resolveRecordBlockEditability({ allow_editing: true } as BlockConfig, false, false)).toBe(
      false
    )
  })

  it("returns false in layout edit mode", () => {
    expect(resolveRecordBlockEditability({ allow_editing: true } as BlockConfig, true, true)).toBe(
      false
    )
  })

  it("returns false when permissions.mode is view", () => {
    expect(
      resolveRecordBlockEditability(
        { permissions: { mode: "view" } } as BlockConfig,
        true,
        false
      )
    ).toBe(false)
  })

  it("returns true when all gates pass", () => {
    expect(resolveRecordBlockEditability({ allow_editing: true } as BlockConfig, true, false)).toBe(
      true
    )
  })
})
