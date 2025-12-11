"use client";

import { useState, useEffect, useCallback } from "react";
import { Automation } from "@/lib/types/automations";
import { AutomationTrigger, Condition, AutomationAction } from "@/lib/automations/schema";

interface UseAutomationFormProps {
  defaultAutomation?: Automation | null;
}

export function useAutomationForm({ defaultAutomation }: UseAutomationFormProps = {}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"active" | "paused">("active");
  const [trigger, setTrigger] = useState<AutomationTrigger | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load default automation data
  useEffect(() => {
    if (defaultAutomation) {
      setName(defaultAutomation.name || "");
      setStatus(defaultAutomation.status || "active");
      setTrigger(defaultAutomation.trigger || null);
      setConditions(defaultAutomation.conditions || []);
      setActions(defaultAutomation.actions || []);
    } else {
      // Reset to defaults
      setName("");
      setStatus("active");
      setTrigger(null);
      setConditions([]);
      setActions([]);
    }
    setErrors({});
  }, [defaultAutomation]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name || !name.trim()) {
      newErrors.name = "Automation name is required";
    }

    if (!trigger) {
      newErrors.trigger = "Trigger is required";
    } else {
      // Validate trigger based on type
      if (trigger.type === "schedule") {
        const schedule = (trigger as any).schedule;
        if (!schedule || !schedule.frequency) {
          newErrors.trigger = "Schedule frequency is required";
        }
      } else if (
        trigger.type === "record_created" ||
        trigger.type === "record_updated" ||
        trigger.type === "field_match" ||
        trigger.type === "date_approaching"
      ) {
        if (!(trigger as any).table_id) {
          newErrors.trigger = "Table is required for this trigger type";
        }
      }
    }

    if (!actions || actions.length === 0) {
      newErrors.actions = "At least one action is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, trigger, actions]);

  const getFormData = useCallback((): Partial<Automation> => {
    return {
      name: name.trim(),
      status,
      trigger: trigger!,
      conditions,
      actions,
    };
  }, [name, status, trigger, conditions, actions]);

  const save = useCallback(async (): Promise<Automation | null> => {
    if (!validate()) {
      return null;
    }

    const formData = getFormData();

    try {
      const url = defaultAutomation
        ? `/api/automations/${defaultAutomation.id}`
        : "/api/automations";
      const method = defaultAutomation ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save automation");
      }

      const data = await response.json();
      return data.autation || null;
    } catch (error: any) {
      console.error("Error saving automation:", error);
      setErrors({ save: error.message || "Failed to save automation" });
      return null;
    }
  }, [defaultAutomation, validate, getFormData]);

  return {
    // State
    name,
    status,
    trigger,
    conditions,
    actions,
    errors,

    // Setters
    setName,
    setStatus,
    setTrigger,
    setConditions,
    setActions,

    // Methods
    validate,
    save,
    getFormData,
  };
}
