"use client"

import { useState } from "react"
import { Sparkles, X } from "lucide-react"
import { AUTOMATION_TEMPLATES, getTemplatesByCategory, type AutomationTemplate } from "@/lib/automations/templates"

interface AutomationTemplatesProps {
  onSelectTemplate: (template: AutomationTemplate) => void
  onClose: () => void
}

export default function AutomationTemplates({ onSelectTemplate, onClose }: AutomationTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const categories = getTemplatesByCategory()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              Choose a Template
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Start with a pre-built automation and customize it to your needs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Categories */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Templates
          </button>
          {Object.keys(categories).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(selectedCategory
              ? categories[selectedCategory] || []
              : AUTOMATION_TEMPLATES
            ).map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  onSelectTemplate(template)
                  onClose()
                }}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl flex-shrink-0">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1 group-hover:text-blue-600 transition-colors">
                      {template.name}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{template.description}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {template.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        {template.actions.length} action{template.actions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Templates are starting points - you can customize everything after selecting one
          </p>
        </div>
      </div>
    </div>
  )
}
