import { useEffect, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { App, ConfigProvider, type ThemeConfig } from 'antd'
import idID from 'antd/locale/id_ID'
import { supabase } from '../lib/supabase'
import { queryClient } from './queryClient'

// Design system: palet & tipografi konsisten (indigo + slate, Plus Jakarta Sans)
const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#4f46e5',
    colorInfo: '#4f46e5',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorBgLayout: '#f8fafc',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748b',
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#eef2f7',
    borderRadius: 10,
    borderRadiusLG: 14,
    controlHeight: 40,
    fontFamily:
      "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Menu: {
      itemHeight: 38,
      itemBorderRadius: 10,
      itemMarginInline: 10,
      itemSelectedBg: '#e0e7ff',
      itemSelectedColor: '#3730a3',
      activeBarBorderWidth: 0,
      subMenuItemBg: 'transparent',
      popupBg: '#ffffff',
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#475569',
      headerSplitColor: 'transparent',
      cellPaddingBlock: 13,
      rowHoverBg: '#f8fafc',
      rowSelectedBg: '#eef2ff',
      rowSelectedHoverBg: '#e0e7ff',
      borderColor: '#eef2f7',
    },
    Form: {
      labelColor: '#334155',
      verticalLabelPadding: '0 0 6px',
    },
    Button: {
      fontWeight: 500,
      primaryShadow: '0 1px 2px rgba(79, 70, 229, 0.28)',
      defaultShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
    },
    Card: { paddingLG: 20 },
    Modal: { titleFontSize: 17 },
    Statistic: { contentFontSize: 28, titleFontSize: 13 },
    Segmented: { trackBg: '#f1f5f9', itemSelectedBg: '#ffffff' },
  },
}

function AuthListener() {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    })
    return () => subscription.unsubscribe()
  }, [])

  return null
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={idID} theme={themeConfig}>
        <App>
          <AuthListener />
          {children}
        </App>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
