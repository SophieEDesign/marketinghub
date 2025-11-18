import type { Metadata } from 'next'
import './globals.css'
import { AppProviders } from './providers'
import { ThemeProvider } from '@/components/ThemeProvider'
import { DrawerProvider } from '@/lib/drawerState'
import { ModalProvider } from '@/lib/modalState'
import { LinkerProvider } from '@/lib/linkerState'
import Sidebar from '@/components/Sidebar'
import HeaderBar from '@/components/HeaderBar'
import RecordDrawer from '@/components/drawer/RecordDrawer'
import NewContentModal from '@/components/modal/NewContentModal'
import LinkedRecordPicker from '@/components/linker/LinkedRecordPicker'

export const metadata: Metadata = {
  title: 'Marketing Workspace',
  description: 'Marketing Hub Application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
        <AppProviders>
          <DrawerProvider>
            <ModalProvider>
              <LinkerProvider>
                <ThemeProvider>
                  <div className="flex h-screen">
                    <Sidebar />
                    <div className="flex flex-col flex-1">
                      <HeaderBar />
                      <main className="flex-1 overflow-auto p-6">{children}</main>
                    </div>
                  </div>
                  <RecordDrawer />
                  <NewContentModal />
                  <LinkedRecordPicker />
                </ThemeProvider>
              </LinkerProvider>
            </ModalProvider>
          </DrawerProvider>
        </AppProviders>
      </body>
    </html>
  )
}

