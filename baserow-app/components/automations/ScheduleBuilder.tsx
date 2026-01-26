"use client"

import { useState } from "react"
import { Calendar, Clock, Repeat } from "lucide-react"
import type { TriggerConfig } from "@/lib/automations/types"

interface ScheduleBuilderProps {
  config: TriggerConfig
  onChange: (config: TriggerConfig) => void
}

export default function ScheduleBuilder({ config, onChange }: ScheduleBuilderProps) {
  const [interval, setInterval] = useState<'minute' | 'hour' | 'day' | 'week' | 'month'>(config.interval || 'day')
  const [intervalValue, setIntervalValue] = useState<number>(config.interval_value || 1)
  const [time, setTime] = useState<string>(config.time || '09:00')
  const [dayOfWeek, setDayOfWeek] = useState<number>(config.day_of_week ?? 1)
  const [dayOfMonth, setDayOfMonth] = useState<number>(config.day_of_month || 1)

  function updateConfig(updates: Partial<TriggerConfig>) {
    onChange({
      ...config,
      ...updates,
    })
  }

  function handleIntervalChange(newInterval: typeof interval) {
    setInterval(newInterval)
    updateConfig({ interval: newInterval })
    
    // Reset dependent fields
    if (newInterval === 'day') {
      updateConfig({ interval_value: undefined, day_of_week: undefined, day_of_month: undefined })
    } else if (newInterval === 'week') {
      updateConfig({ interval_value: undefined, day_of_month: undefined })
    } else if (newInterval === 'month') {
      updateConfig({ interval_value: undefined, day_of_week: undefined })
    }
  }

  function getScheduleDescription(): string {
    switch (interval) {
      case 'minute':
        return `Every ${intervalValue} minute${intervalValue !== 1 ? 's' : ''}`
      case 'hour':
        return `Every ${intervalValue} hour${intervalValue !== 1 ? 's' : ''}`
      case 'day':
        return `Daily at ${time}`
      case 'week': {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return `Every ${days[dayOfWeek]} at ${time}`
      }
      case 'month':
        return `On the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)} of each month at ${time}`
      default:
        return 'Not scheduled'
    }
  }

  function getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th'
    switch (day % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  function getNextRunPreview(): string {
    const now = new Date()
    const [hours, minutes] = time.split(':').map(Number)
    
    let nextRun = new Date()
    nextRun.setHours(hours, minutes, 0, 0)

    switch (interval) {
      case 'minute':
        nextRun = new Date(now.getTime() + intervalValue * 60 * 1000)
        break
      case 'hour':
        nextRun = new Date(now.getTime() + intervalValue * 60 * 60 * 1000)
        break
      case 'day':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1)
        }
        break
      case 'week': {
        const currentDay = now.getDay()
        let daysUntil = (dayOfWeek - currentDay + 7) % 7
        if (daysUntil === 0 && nextRun <= now) {
          daysUntil = 7
        }
        nextRun.setDate(now.getDate() + daysUntil)
        break
      }
      case 'month': {
        nextRun.setDate(dayOfMonth)
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1)
        }
        break
      }
    }

    return nextRun.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      {/* Schedule Preview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm text-blue-900 mb-1">Schedule Preview</div>
            <div className="text-sm text-blue-800 mb-2">{getScheduleDescription()}</div>
            <div className="text-xs text-blue-700">
              Next run: {getNextRunPreview()}
            </div>
          </div>
        </div>
      </div>

      {/* Interval Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Frequency</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {(['minute', 'hour', 'day', 'week', 'month'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => handleIntervalChange(opt)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                interval === opt
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Interval Value (for minute/hour) */}
      {(interval === 'minute' || interval === 'hour') && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Every how many {interval}s?
          </label>
          <input
            type="number"
            min="1"
            max={interval === 'minute' ? 60 : 24}
            value={intervalValue}
            onChange={(e) => {
              const value = Math.max(1, Math.min(parseInt(e.target.value) || 1, interval === 'minute' ? 60 : 24))
              setIntervalValue(value)
              updateConfig({ interval_value: value })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      )}

      {/* Time Picker */}
      {(interval === 'day' || interval === 'week' || interval === 'month') && (
        <div>
          <label className="block text-sm font-medium mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value)
              updateConfig({ time: e.target.value })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      )}

      {/* Day of Week (for weekly) */}
      {interval === 'week' && (
        <div>
          <label className="block text-sm font-medium mb-1 flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Day of Week
          </label>
          <select
            value={dayOfWeek}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              setDayOfWeek(value)
              updateConfig({ day_of_week: value })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
          </select>
        </div>
      )}

      {/* Day of Month (for monthly) */}
      {interval === 'month' && (
        <div>
          <label className="block text-sm font-medium mb-1">Day of Month</label>
          <input
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            onChange={(e) => {
              const value = Math.max(1, Math.min(31, parseInt(e.target.value) || 1))
              setDayOfMonth(value)
              updateConfig({ day_of_month: value })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Note: If the month has fewer days, it will run on the last day of the month
          </p>
        </div>
      )}
    </div>
  )
}
