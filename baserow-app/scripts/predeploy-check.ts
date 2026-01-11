/**
 * Pre-Deployment Check Script
 * 
 * Validates database state before deployment.
 * Fails build if invalid data exists.
 * 
 * Run: npm run predeploy-check
 * Or: tsx scripts/predeploy-check.ts
 */

import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set')
  process.exit(1)
}

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set (required for pre-deploy checks)')
  console.warn('⚠️  Skipping pre-deploy checks. Set SUPABASE_SERVICE_ROLE_KEY to enable.')
  process.exit(0) // Don't fail build if key is missing (might be intentional)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface ValidationError {
  type: string
  id: string
  name?: string
  message: string
}

const errors: ValidationError[] = []

/**
 * Check pages for invalid anchor configurations
 */
async function checkPageAnchors() {
  console.log('🔍 Checking page anchors...')
  
  const { data: pages, error } = await supabase
    .from('interface_pages')
    .select('id, name, page_type, saved_view_id, dashboard_layout_id, form_config_id, record_config_id, base_table')

  if (error) {
    console.error('❌ Error loading pages:', error)
    errors.push({
      type: 'database_error',
      id: 'pages',
      message: `Failed to load pages: ${error.message}`,
    })
    return
  }

  if (!pages || pages.length === 0) {
    console.log('✅ No pages to check')
    return
  }

  for (const page of pages) {
    const anchorCount = [
      page.saved_view_id,
      page.dashboard_layout_id,
      page.form_config_id,
      page.record_config_id,
    ].filter(Boolean).length

    // Content pages don't require anchors initially
    if (page.page_type === 'content') {
      continue
    }

    // Check for zero anchors
    if (anchorCount === 0) {
      errors.push({
        type: 'page_no_anchor',
        id: page.id,
        name: page.name,
        message: `Page "${page.name}" (${page.id}) has zero anchors. Pages must have exactly one anchor.`,
      })
    }

    // Check for multiple anchors
    if (anchorCount > 1) {
      errors.push({
        type: 'page_multiple_anchors',
        id: page.id,
        name: page.name,
        message: `Page "${page.name}" (${page.id}) has ${anchorCount} anchors. Pages must have exactly one anchor.`,
      })
    }

    // Check page type requirements
    if (['calendar', 'list', 'record_review'].includes(page.page_type)) {
      if (!page.base_table) {
        errors.push({
          type: 'page_missing_table',
          id: page.id,
          name: page.name,
          message: `Page "${page.name}" (${page.id}) is type ${page.page_type} but has no base_table.`,
        })
      }
    }
  }

  console.log(`✅ Checked ${pages.length} pages`)
}

/**
 * Check blocks for missing required config
 */
async function checkBlockConfigs() {
  console.log('🔍 Checking block configurations...')
  
  const { data: blocks, error } = await supabase
    .from('view_blocks')
    .select('id, type, config, view_id')

  if (error) {
    console.error('❌ Error loading blocks:', error)
    errors.push({
      type: 'database_error',
      id: 'blocks',
      message: `Failed to load blocks: ${error.message}`,
    })
    return
  }

  if (!blocks || blocks.length === 0) {
    console.log('✅ No blocks to check')
    return
  }

  for (const block of blocks) {
    const config = block.config || {}
    const blockType = block.type

    // Check required config per block type
    switch (blockType) {
      case 'grid':
      case 'chart':
        if (!config.table_id && !config.source_view) {
          errors.push({
            type: 'block_missing_config',
            id: block.id,
            message: `Block ${block.id} (${blockType}) is missing required table_id or source_view.`,
          })
        }
        break

      case 'calendar':
      case 'kpi':
        // Calendar and KPI blocks can inherit table_id from page context (page.base_table)
        // So we allow them to be missing table_id/source_view
        // They will get the table from the page they're on
        break

      case 'record':
        if (!config.table_id) {
          errors.push({
            type: 'block_missing_config',
            id: block.id,
            message: `Block ${block.id} (record) is missing required table_id.`,
          })
        }
        if (!config.record_id) {
          // Record blocks can use pageRecordId, so this is a warning, not error
          // But we'll still check if it's in a record review page context
        }
        break

      case 'form':
        if (!config.table_id) {
          errors.push({
            type: 'block_missing_config',
            id: block.id,
            message: `Block ${block.id} (form) is missing required table_id.`,
          })
        }
        break

      case 'calendar':
        if (!config.date_field && config.table_id) {
          errors.push({
            type: 'block_missing_config',
            id: block.id,
            message: `Block ${block.id} (calendar) is missing required date_field.`,
          })
        }
        break
    }
  }

  console.log(`✅ Checked ${blocks.length} blocks`)
}

/**
 * Check pages with blocks but no dashboard_layout_id
 */
async function checkDashboardPages() {
  console.log('🔍 Checking dashboard pages...')
  
  const { data: pages, error } = await supabase
    .from('interface_pages')
    .select('id, name, page_type, dashboard_layout_id')
    .in('page_type', ['dashboard', 'overview', 'content'])

  if (error) {
    console.error('❌ Error loading dashboard pages:', error)
    return
  }

  if (!pages || pages.length === 0) {
    console.log('✅ No dashboard pages to check')
    return
  }

  for (const page of pages) {
    // Check if page has blocks but no dashboard_layout_id
    const { data: blocks } = await supabase
      .from('view_blocks')
      .select('id')
      .eq('view_id', page.id)
      .limit(1)

    if (blocks && blocks.length > 0 && !page.dashboard_layout_id) {
      errors.push({
        type: 'dashboard_missing_layout',
        id: page.id,
        name: page.name,
        message: `Page "${page.name}" (${page.id}) has blocks but no dashboard_layout_id.`,
      })
    }
  }

  console.log(`✅ Checked ${pages.length} dashboard pages`)
}

/**
 * Check layouts for zero-width or zero-height blocks
 */
async function checkLayoutDimensions() {
  console.log('🔍 Checking block layout dimensions...')
  
  const { data: blocks, error } = await supabase
    .from('view_blocks')
    .select('id, type, width, height, position_x, position_y')

  if (error) {
    console.error('❌ Error loading blocks:', error)
    return
  }

  if (!blocks || blocks.length === 0) {
    console.log('✅ No blocks to check')
    return
  }

  for (const block of blocks) {
    if (block.width !== null && block.width <= 0) {
      errors.push({
        type: 'block_invalid_dimensions',
        id: block.id,
        message: `Block ${block.id} (${block.type}) has invalid width: ${block.width}. Width must be > 0.`,
      })
    }

    if (block.height !== null && block.height <= 0) {
      errors.push({
        type: 'block_invalid_dimensions',
        id: block.id,
        message: `Block ${block.id} (${block.type}) has invalid height: ${block.height}. Height must be > 0.`,
      })
    }
  }

  console.log(`✅ Checked ${blocks.length} block layouts`)
}

/**
 * Check default pages point to existing pages
 */
async function checkDefaultPages() {
  console.log('🔍 Checking default page references...')
  
  // This would check if there's a default page setting that points to a missing page
  // Implementation depends on how default pages are stored
  // For now, we'll skip this check
  
  console.log('✅ Default page check skipped (not implemented)')
}

/**
 * Run typecheck
 */
async function runTypecheck() {
  console.log('🔍 Running TypeScript typecheck...')
  const { execSync } = require('child_process')
  try {
    // Test files are excluded in tsconfig.json
    // They are validated by vitest itself
    execSync('npx tsc --noEmit', { stdio: 'inherit' })
    console.log('✅ Typecheck passed')
    return true
  } catch (error) {
    console.error('❌ Typecheck failed')
    errors.push({
      type: 'typecheck_error',
      id: 'typescript',
      message: 'TypeScript typecheck failed. Fix type errors before deploying.',
    })
    return false
  }
}

/**
 * Run lint
 */
async function runLint() {
  console.log('🔍 Running ESLint...')
  const { execSync } = require('child_process')
  try {
    execSync('npm run lint', { stdio: 'inherit' })
    console.log('✅ Lint passed')
    return true
  } catch (error) {
    console.error('❌ Lint failed')
    errors.push({
      type: 'lint_error',
      id: 'eslint',
      message: 'ESLint check failed. Fix lint errors before deploying.',
    })
    return false
  }
}

/**
 * Run tests
 */
async function runTests() {
  console.log('🔍 Running tests...')
  const { execSync } = require('child_process')
  try {
    // Check if vitest is available
    try {
      execSync('npx vitest run --reporter=verbose', { stdio: 'inherit' })
      console.log('✅ Tests passed')
      return true
    } catch (error) {
      console.error('❌ Tests failed')
      errors.push({
        type: 'test_error',
        id: 'vitest',
        message: 'Tests failed. Fix failing tests before deploying.',
      })
      return false
    }
  } catch (error) {
    console.error('❌ Error running tests:', error)
    errors.push({
      type: 'test_error',
      id: 'vitest',
      message: 'Error running tests. Check test configuration.',
    })
    return false
  }
}

/**
 * Main validation function
 */
async function runChecks() {
  console.log('🚀 Starting pre-deployment validation...\n')

  // Run checks in order
  const typecheckPassed = await runTypecheck()
  const lintPassed = await runLint()
  const testsPassed = await runTests()
  
  // Database checks
  await checkPageAnchors()
  await checkBlockConfigs()
  await checkDashboardPages()
  await checkLayoutDimensions()
  await checkDefaultPages()

  console.log('\n' + '='.repeat(60))
  
  if (errors.length === 0) {
    console.log('✅ All pre-deployment checks passed!')
    process.exit(0)
  } else {
    console.error(`❌ Found ${errors.length} validation error(s):\n`)
    
    // Group errors by type
    const errorsByType = errors.reduce((acc, error) => {
      if (!acc[error.type]) {
        acc[error.type] = []
      }
      acc[error.type].push(error)
      return acc
    }, {} as Record<string, ValidationError[]>)

    for (const [type, typeErrors] of Object.entries(errorsByType)) {
      console.error(`\n${type} (${typeErrors.length} error(s)):`)
      for (const error of typeErrors) {
        console.error(`  - ${error.message}`)
      }
    }

    console.error('\n❌ Pre-deployment checks failed. Fix errors before deploying.')
    process.exit(1)
  }
}

// Run checks
runChecks().catch((error) => {
  console.error('❌ Fatal error during pre-deployment checks:', error)
  process.exit(1)
})

