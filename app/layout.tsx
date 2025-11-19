import type { Metadata } from 'next'
import { Inter, League_Spartan } from "next/font/google"
import './globals.css'
import { AppProviders } from './providers'
import { ThemeProvider } from '@/components/ThemeProvider'
import { DrawerProvider } from '@/lib/drawerState'
import { ModalProvider } from '@/lib/modalState'
import { LinkerProvider } from '@/lib/linkerState'
import { SettingsProvider } from '@/lib/settingsState'
import Sidebar from '@/components/sidebar/Sidebar'
import HeaderBar from '@/components/HeaderBar'
import RecordDrawer from '@/components/drawer/RecordDrawer'
import NewRecordModal from '@/components/modal/NewRecordModal'
import LinkedRecordPicker from '@/components/linker/LinkedRecordPicker'
import SettingsSidebar from '@/components/settings/SettingsSidebar'

const inter = Inter({ subsets: ["latin"], variable: "--font-body" })
const spartan = League_Spartan({ subsets: ["latin"], variable: "--font-heading" })

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
          <DrawerProvider>
            <ModalProvider>
              <LinkerProvider>
                <SettingsProvider>
                  <ThemeProvider>
                  <div className="flex h-screen">
                    <Sidebar />
                    <div className="flex flex-col flex-1">
                      <HeaderBar />
                      <main className="flex-1 overflow-auto p-6">{children}</main>
                    </div>
                  </div>
                  <RecordDrawer />
                  <NewRecordModal />
                  <LinkedRecordPicker />
                  <SettingsSidebar />
                </ThemeProvider>
                </SettingsProvider>
              </LinkerProvider>
            </ModalProvider>
          </DrawerProvider>
        </AppProviders>
      </body>
    </html>
  )
}

