import { NextResponse } from 'next/server'

/**
 * GET /api/openapi - OpenAPI 3.0 specification for Marketing Hub API
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Marketing Hub API',
      description: 'API for tables, pages, dashboard aggregates, and search.',
      version: '1.0.0',
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/api/tables': {
        get: {
          summary: 'List tables',
          tags: ['Tables'],
          responses: { 200: { description: 'List of tables' } },
        },
      },
      '/api/tables/{tableId}': {
        get: {
          summary: 'Get table by ID',
          tags: ['Tables'],
          parameters: [{ name: 'tableId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Table details' },
            404: { description: 'Table not found' },
          },
        },
        patch: {
          summary: 'Update table (admin)',
          tags: ['Tables'],
          parameters: [{ name: 'tableId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    primary_field_name: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Table updated' },
            403: { description: 'Admin required' },
            404: { description: 'Table not found' },
          },
        },
      },
      '/api/tables/{tableId}/fields': {
        get: {
          summary: 'Get table fields',
          tags: ['Tables'],
          parameters: [{ name: 'tableId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'List of fields' } },
        },
      },
      '/api/pages': {
        get: {
          summary: 'List pages',
          tags: ['Pages'],
          responses: { 200: { description: 'List of pages' } },
        },
        post: {
          summary: 'Create page',
          tags: ['Pages'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    settings: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Page created' },
            400: { description: 'Page name required' },
          },
        },
      },
      '/api/pages/{pageId}': {
        get: {
          summary: 'Get page by ID',
          tags: ['Pages'],
          parameters: [{ name: 'pageId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Page details' },
            404: { description: 'Page not found' },
          },
        },
      },
      '/api/pages/{pageId}/blocks': {
        get: {
          summary: 'Get page blocks',
          tags: ['Pages'],
          parameters: [{ name: 'pageId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'List of blocks' } },
        },
        patch: {
          summary: 'Save block layout or update blocks',
          tags: ['Pages'],
          parameters: [{ name: 'pageId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    layout: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          i: { type: 'string' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          w: { type: 'number' },
                          h: { type: 'number' },
                        },
                      },
                    },
                    blocks: { type: 'array' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Blocks updated' } },
        },
      },
      '/api/dashboard/aggregate': {
        post: {
          summary: 'Single aggregate (count, sum, avg)',
          tags: ['Dashboard'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tableId', 'aggregate'],
                  properties: {
                    tableId: { type: 'string' },
                    aggregate: { type: 'string', enum: ['count', 'sum', 'avg'] },
                    fieldName: { type: 'string' },
                    filters: { type: 'array' },
                    comparison: {
                      type: 'object',
                      properties: {
                        dateFieldName: { type: 'string' },
                        currentStart: { type: 'string', format: 'date-time' },
                        currentEnd: { type: 'string', format: 'date-time' },
                        previousStart: { type: 'string', format: 'date-time' },
                        previousEnd: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Aggregate result' } },
        },
      },
      '/api/dashboard/aggregate-batch': {
        post: {
          summary: 'Batch aggregates (multiple blocks)',
          tags: ['Dashboard'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['requests'],
                  properties: {
                    requests: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['tableId', 'aggregate'],
                        properties: {
                          tableId: { type: 'string' },
                          aggregate: { type: 'string', enum: ['count', 'sum', 'avg'] },
                          fieldName: { type: 'string' },
                          filters: { type: 'array' },
                          comparison: { type: 'object' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Array of aggregate results' } },
        },
      },
      '/api/search': {
        get: {
          summary: 'Global search (tables, pages, views)',
          tags: ['Search'],
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['tables', 'pages', 'views'] } },
          ],
          responses: { 200: { description: 'Search results' } },
        },
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sb-access-token',
          description: 'Supabase session cookie',
        },
      },
      security: [{ cookieAuth: [] }],
    },
  }
  return NextResponse.json(spec)
}
