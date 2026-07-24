import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthGate from './AuthGate'
import PaymentSuccess from './PaymentSuccess'
import SetPassword from './SetPassword'
import './styles.css'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const page = path === '/payment-success'
  ? <PaymentSuccess />
  : path === '/set-password'
    ? <SetPassword />
    : <AuthGate />

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{page}</React.StrictMode>,
)
