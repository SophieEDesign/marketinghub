"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { automationTemplates, getTemplatesByCategory, AutomationTemplate } from "./templates";

interface TemplatePickerProps {
  onSelectTemplate: (template: AutomationTemplate) => void;
}

export default function TemplatePicker({ onSelectTemplate }: TemplatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const categories = getTemplatesByCategory();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <FileText className="w-4 h-4" />
        Create from Template
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[9997]"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[9998] max-h-[500px] overflow-y-auto">
            <div className="p-2">
              {Object.entries(categories).map(([category, templates]) => (
                <div key={category} className="mb-4">
                  <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {category}
                  </h3>
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        onSelectTemplate(template);
                        setIsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                        {template.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
