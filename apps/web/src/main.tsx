import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import { DialogProvider } from './lib/dialogs'
import { I18nProvider } from './lib/i18n'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)
