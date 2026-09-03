'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) setMessage('Error: ' + error.message)
    else setMessage('Signed up! Now ask your business owner to link your account.')
  }

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage('Error: ' + error.message)
      return
    }

    // Look up their role in app_users
    const { data: appUser, error: appUserError } = await supabase
      .from('app_users')
      .select('role')
      .eq('auth_id', data.user.id)
      .single()

    if (appUserError || !appUser) {
      setMessage('Logged in, but your account is not linked to a business yet.')
      return
    }

    if (appUser.role === 'owner') {
      router.push('/dashboard')
    } else {
      router.push('/checkout')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #00c6ff, #00ffb3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '40px',
          borderRadius: '12px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}
      >
        <h1 style={{ marginBottom: '20px' }}>Login / Sign Up</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', marginBottom: '10px', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', marginBottom: '20px', padding: '10px', width: '100%', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <button onClick={handleSignUp} style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          Sign Up
        </button>
        <button onClick={handleLogin} style={{ padding: '10px 20px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          Log In
        </button>
        <p style={{ marginTop: '15px' }}>{message}</p>
      </div>
    </div>
  )
}