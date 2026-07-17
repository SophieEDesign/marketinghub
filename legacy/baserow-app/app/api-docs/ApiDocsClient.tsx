'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

/**
 * API Documentation - Swagger UI (loaded from CDN)
 */
export default function ApiDocsClient() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!ready || !containerRef.current || typeof window === 'undefined') return
    const SwaggerUIBundle = (window as any).SwaggerUIBundle
    if (!SwaggerUIBundle) return
    SwaggerUIBundle({
      url: '/api/openapi',
      domNode: containerRef.current,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset,
      ],
      layout: 'BaseLayout',
    })
  }, [ready])

  return (
    <div className="min-h-[60vh] bg-white rounded-lg border">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div className="border-b bg-gray-50 px-4 py-3 rounded-t-lg">
        <p className="text-sm text-gray-600">
          OpenAPI spec: <a href="/api/openapi" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">/api/openapi</a>
        </p>
      </div>
      <div ref={containerRef} id="swagger-ui" className="p-4" />
    </div>
  )
}
