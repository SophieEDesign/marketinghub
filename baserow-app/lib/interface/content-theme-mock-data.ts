/**
 * Mock data for Content Theme Block (self-contained until Supabase wiring).
 */

export type ContentThemeStatus = 'Previous' | 'Active' | 'Upcoming'

export interface ContentThemeIdea {
  id: string
  title: string
}

export interface ContentThemeItem {
  id: string
  title: string
  quarter: string
  status: ContentThemeStatus
  themeType: string
  description?: string
  ideas: ContentThemeIdea[]
  accent: 'blue' | 'purple' | 'green' | 'red'
}

export const MOCK_CONTENT_THEMES: ContentThemeItem[] = [
  {
    id: 'theme-1',
    title: 'Planning & Preparation',
    quarter: 'Q1',
    status: 'Previous',
    themeType: 'Annual theme',
    ideas: [{ id: 'idea-1', title: "Why Shipping Shouldn't Be an Afterthought" }],
    accent: 'blue',
  },
  {
    id: 'theme-2',
    title: 'Operational / Credibility',
    quarter: 'Q2',
    status: 'Active',
    themeType: 'Annual theme',
    ideas: [
      {
        id: 'idea-2',
        title:
          'Global Forwarding Is Becoming More Complex, But Customers Expect It to Become Simpler',
      },
      {
        id: 'idea-3',
        title: 'The Middle East Is Still Moving, But the Route Looks Different',
      },
      { id: 'idea-4', title: 'The Return of Stockholding' },
    ],
    accent: 'purple',
  },
  {
    id: 'theme-3',
    title: 'Reliability & Execution',
    quarter: 'Q3',
    status: 'Upcoming',
    themeType: 'Annual theme',
    ideas: [],
    accent: 'green',
  },
  {
    id: 'theme-4',
    title: 'Risk, Control & Reflection',
    quarter: 'Q4',
    status: 'Upcoming',
    themeType: 'Annual theme',
    ideas: [],
    accent: 'red',
  },
]
