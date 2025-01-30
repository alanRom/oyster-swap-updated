import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { AccountsProvider } from "./utils/accounts";
import { CurrencyPairProvider } from "./utils/currencyPair";
import {SolanaWalletProvider} from './utils/solana-wallet.tsx'
import { ErrorBoundary } from './utils/ErrorBoundary.tsx';

ReactDOM.createRoot(document.getElementById('root')!, {}).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<p>Something went wrong</p>}>
    <SolanaWalletProvider>
        <AccountsProvider>
          <CurrencyPairProvider>
            <App />
          </CurrencyPairProvider>
        </AccountsProvider>
      </SolanaWalletProvider>
    </ErrorBoundary>
      
  </React.StrictMode>,
)
