'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) setMessage('Error: ' + error.message)
    else setMessage('Signed up! User ID: ' + data.user.id)
  }

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage('Error: ' + error.message)
    else setMessage('Logged in! User ID: ' + data.user.id)
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '400px' }}>
      <h1>Login / Sign Up Test</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%' }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%' }}
      />
      <button onClick={handleSignUp} style={{ marginRight: '10px', padding: '8px 16px' }}>
        Sign Up
      </button>
      <button onClick={handleLogin} style={{ padding: '8px 16px' }}>
        Log In
      </button>
      <p>{message}</p>
    </div>
  )
}