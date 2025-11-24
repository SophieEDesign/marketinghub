import type { Metadata } from 'next'
import { Inter, League_Spartan } from "next/font/google"
import './globals.css'
import { AppProviders } from './providers'
import { ThemeProvider } from '@/components/ThemeProvider'
import { DrawerProvider } from '@/lib/drawerState'
import { ModalProvider } from '@/lib/modalState'
import { LinkerProvider } from '@/lib/linkerState'
import { SettingsProvider } from '@/lib/settingsState'
import { SearchProvider } from '@/components/search/SearchProvider'
import { RecordDrawerProvider } from '@/components/record-drawer/RecordDrawerProvider'
import Sidebar from '@/components/sidebar/Sidebar'
import HeaderBar from '@/components/HeaderBar'
import RecordDrawer from '@/components/record-drawer/RecordDrawer'
import NewRecordModal from '@/components/modal/NewRecordModal'
import LinkedRecordPicker from '@/components/linker/LinkedRecordPicker'
import GlobalSearch from '@/components/search/GlobalSearch'
import { ToastContainer } from '@/components/ui/Toast'
import CommandPalette from '@/components/command-palette/CommandPalette'
import NewPageModalProvider from '@/components/pages/NewPageModalProvider'

const inter = Inter({ subsets: ["latin"], variable: "--font-body" })
const spartan = League_Spartan({ subsets: ["latin"], variable: "--font-heading" })

export const dynamic = 'force-dynamic';

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
      <body className={`${inter.variable} ${spartan.variable} font-body bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200`}>
        <AppProviders>
          <SearchProvider>
            <RecordDrawerProvider>
              <DrawerProvider>
                <ModalProvider>
                  <LinkerProvider>
                    <SettingsProvider>
                      <ThemeProvider>
                      <NewPageModalProvider>
                        <div className="flex h-screen overflow-hidden">
                          <Sidebar />
                          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                            <HeaderBar />
                            <main className="flex-1 overflow-auto p-6 min-h-0" aria-label="Content">{children}</main>
                          </div>
                        </div>
                        <RecordDrawer />
                        <NewRecordModal />
                        <LinkedRecordPicker />
                        <GlobalSearch />
                        <CommandPalette />
                        <ToastContainer />
                      </NewPageModalProvider>
                    </ThemeProvider>
                    </SettingsProvider>
                  </LinkerProvider>
                </ModalProvider>
              </DrawerProvider>
            </RecordDrawerProvider>
          </SearchProvider>
        </AppProviders>
      </body>
    </html>
  )
}

