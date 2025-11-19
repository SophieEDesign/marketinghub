"use client";

import { useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { Field, FieldType, FieldOption } from "./fields";

export function useFieldManager(tableId: string) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFields = useCallback(async (): Promise<Field[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("order", { ascending: true });

      if (fetchError) {
        console.error("Error fetching fields:", fetchError);
        setError(fetchError.message);
        return [];
      }

      const parsedFields = (data || []).map((f) => ({
        ...f,
        options: typeof f.options === "string" ? JSON.parse(f.options) : f.options,
      })) as Field[];

      setFields(parsedFields);
      return parsedFields;
    } catch (err: any) {
      console.error("Error in getFields:", err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  const addField = useCallback(
    async (label: string, type: FieldType, required: boolean = false): Promise<Field | null> => {
      setLoading(true);
      setError(null);
      try {
        // Generate field_key from label
        const fieldKey = label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

        // Get max order
        const { data: existingFields } = await supabase
          .from("table_fields")
          .select("order")
          .eq("table_id", tableId)
          .order("order", { ascending: false })
          .limit(1);

        const maxOrder = existingFields && existingFields.length > 0 ? existingFields[0].order : -1;
        const newOrder = maxOrder + 1;

        // Prepare options for select types
        let optionsValue: any = null;
        if (type === "single_select" || type === "multi_select") {
          optionsValue = { values: [] };
        }

        const { data, error: insertError } = await supabase
          .from("table_fields")
          .insert([
            {
              table_id: tableId,
              field_key: fieldKey,
              label,
              type,
              options: optionsValue ? JSON.stringify(optionsValue) : null,
              order: newOrder,
              required,
              visible: true,
            },
          ])
          .select()
          .single();

        if (insertError) {
          console.error("Error adding field:", insertError);
          setError(insertError.message);
          return null;
        }

        const newField: Field = {
          ...data,
          options: optionsValue,
        };

        await getFields();
        return newField;
      } catch (err: any) {
        console.error("Error in addField:", err);
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [tableId, getFields]
  );

  const deleteField = useCallback(
    async (fieldId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const { error: deleteError } = await supabase
          .from("table_fields")
          .delete()
          .eq("id", fieldId);

        if (deleteError) {
          console.error("Error deleting field:", deleteError);
          setError(deleteError.message);
          return false;
        }

        await getFields();
        return true;
      } catch (err: any) {
        console.error("Error in deleteField:", err);
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [getFields]
  );

  const updateField = useCallback(
    async (fieldId: string, changes: Partial<Field>): Promise<Field | null> => {
      setLoading(true);
      setError(null);
      try {
        const updateData: any = { ...changes };
        if (updateData.options && typeof updateData.options === "object") {
          updateData.options = JSON.stringify(updateData.options);
        }

        const { data, error: updateError } = await supabase
          .from("table_fields")
          .update(updateData)
          .eq("id", fieldId)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating field:", updateError);
          setError(updateError.message);
          return null;
        }

        const updatedField: Field = {
          ...data,
          options: typeof data.options === "string" ? JSON.parse(data.options) : data.options,
        };

        await getFields();
        return updatedField;
      } catch (err: any) {
        console.error("Error in updateField:", err);
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getFields]
  );

  const reorderFields = useCallback(
    async (fieldIds: string[]): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        // Update order for each field
        const updates = fieldIds.map((id, index) => ({
          id,
          order: index,
        }));

        for (const update of updates) {
          const { error: updateError } = await supabase
            .from("table_fields")
            .update({ order: update.order })
            .eq("id", update.id);

          if (updateError) {
            console.error("Error reordering fields:", updateError);
            setError(updateError.message);
            return false;
          }
        }

        await getFields();
        return true;
      } catch (err: any) {
        console.error("Error in reorderFields:", err);
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [getFields]
  );

  const addSelectOption = useCallback(
    async (fieldId: string, option: { id: string; label: string; color?: string }): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const field = fields.find((f) => f.id === fieldId);
        if (!field) {
          setError("Field not found");
          return false;
        }

        const currentOptions = field.options?.values || [];
        const updatedOptions = {
          values: [...currentOptions, option],
        };

        const result = await updateField(fieldId, { options: updatedOptions });
        return result !== null;
      } catch (err: any) {
        console.error("Error in addSelectOption:", err);
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fields, updateField]
  );

  const removeSelectOption = useCallback(
    async (fieldId: string, optionId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const field = fields.find((f) => f.id === fieldId);
        if (!field) {
          setError("Field not found");
          return false;
        }

        const currentOptions = field.options?.values || [];
        const updatedOptions = {
          values: currentOptions.filter((opt: any) => opt.id !== optionId),
        };

        const result = await updateField(fieldId, { options: updatedOptions });
        return result !== null;
      } catch (err: any) {
        console.error("Error in removeSelectOption:", err);
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fields, updateField]
  );

  const updateSelectOption = useCallback(
    async (
      fieldId: string,
      optionId: string,
      changes: Partial<FieldOption>
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const field = fields.find((f) => f.id === fieldId);
        if (!field) {
          setError("Field not found");
          return false;
        }

        const currentOptions = field.options?.values || [];
        const updatedOptions = {
          values: currentOptions.map((opt: any) =>
            opt.id === optionId ? { ...opt, ...changes } : opt
          ),
        };

        const result = await updateField(fieldId, { options: updatedOptions });
        return result !== null;
      } catch (err: any) {
        console.error("Error in updateSelectOption:", err);
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fields, updateField]
  );

  return {
    fields,
    loading,
    error,
    getFields,
    addField,
    deleteField,
    updateField,
    reorderFields,
    addSelectOption,
    removeSelectOption,
    updateSelectOption,
  };
}

