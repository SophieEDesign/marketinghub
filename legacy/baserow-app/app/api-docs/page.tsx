import WorkspaceShellWrapper from '@/components/layout/WorkspaceShellWrapper'
import ApiDocsClient from './ApiDocsClient'

export default function ApiDocsPage() {
  return (
    <WorkspaceShellWrapper title="API Documentation">
      <ApiDocsClient />
    </WorkspaceShellWrapper>
  )
}
