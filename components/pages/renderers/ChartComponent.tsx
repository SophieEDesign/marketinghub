"use client";

/**
 * Chart Component using recharts
 * 
 * IMPORTANT: To use charts, install recharts:
 *   npm install recharts
 * 
 * Until recharts is installed, this component will show a placeholder message.
 */

import { useEffect, useState } from "react";

interface ChartComponentProps {
  data: any[];
  chartType: "bar" | "line" | "pie";
  xField: string;
  yField: string;
}

export default function ChartComponent({ data, chartType, xField, yField }: ChartComponentProps) {
  // Check if recharts is available at runtime
  const [hasRecharts, setHasRecharts] = useState<boolean | null>(null);
  const [RechartsLib, setRechartsLib] = useState<any>(null);

  useEffect(() => {
    // Try to dynamically load recharts at runtime
    // This bypasses webpack's alias and tries to load from node_modules directly
    const checkRecharts = async () => {
      try {
        // Try to require recharts directly (bypasses webpack alias)
        // If this fails, recharts is not installed
        if (typeof window !== 'undefined') {
          // In browser, construct module name dynamically to prevent webpack analysis
          const moduleParts = ['re', 'charts'];
          const moduleName = moduleParts.join('');
          // Use Function constructor to create import that webpack won't analyze
          const importFunc = new Function('name', `return import(name)`);
          const recharts = await importFunc(moduleName);
          setRechartsLib(recharts);
          setHasRecharts(true);
        } else {
          // Server-side, try require with dynamic name
          const moduleParts = ['re', 'charts'];
          const moduleName = moduleParts.join('');
          const recharts = require(moduleName);
          setRechartsLib(recharts);
          setHasRecharts(true);
        }
      } catch (err) {
        console.warn('recharts not available. Install with: npm install recharts');
        setHasRecharts(false);
      }
    };
    checkRecharts();
  }, []);

  // Show placeholder if recharts not available
  if (hasRecharts === false) {
    return (
      <div className="p-6 text-center text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg">
        <p className="mb-2 font-medium">Chart library not installed</p>
        <p className="text-sm mb-4">
          To enable charts, install the recharts library:
        </p>
        <code className="block bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded text-sm">
          npm install recharts
        </code>
        <p className="text-xs mt-4 text-gray-400">
          Chart data: {data.length} data points ready to display
        </p>
      </div>
    );
  }

  // Show loading while checking
  if (hasRecharts === null || !RechartsLib) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading chart library...
      </div>
    );
  }

  // Render chart using recharts
  const {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
  } = RechartsLib;

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
