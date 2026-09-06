'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false)
  const [businesses, setBusinesses] = useState([])
  const [businessName, setBusinessName] = useState('')
  const [ownerFirstName, setOwnerFirstName] = useState('')
  const [message, setMessage] = useState('')
  const [lastCredentials, setLastCredentials] = useState(null)
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u || u.role !== 'admin') {
        router.push('/login')
        return
      }
      setAuthorized(true)
    })
  }, [])

  const fetchBusinesses = async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, is_active, created_at')
      .order('created_at', { ascending: false })

    if (!error) setBusinesses(data)
  }

  useEffect(() => {
    if (authorized) fetchBusinesses()
  }, [authorized])

  const handleAddBusiness = async () => {
    if (!businessName.trim() || !ownerFirstName.trim()) {
      setMessage('Business name and owner first name are both required.')
      return
    }

    // 1. Create the business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({ name: businessName, is_active: true })
      .select()
      .single()

    if (businessError) {
      setMessage('Error adding business: ' + businessError.message)
      return
    }

    // 2. Generate credentials
    const username = businessName.trim().toLowerCase().replace(/\s+/g, '')
    const password = ownerFirstName.trim()
    const email = username + '@posapp.local'

    // 3. Create the owner account via our API route
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        fullName: ownerFirstName,
        role: 'owner',
        businessId: business.id,
        branchId: null,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      setMessage('Business created, but owner account failed: ' + result.error)
      return
    }

    setLastCredentials({ businessName, username, password })
    setMessage(`✅ Business "${businessName}" and owner account created`)
    setBusinessName('')
    setOwnerFirstName('')
    fetchBusinesses()
  }

  const handleToggleActive = async (business) => {
    const { error } = await supabase
      .from('businesses')
      .update({ is_active: !business.is_active })
      .eq('id', business.id)

    if (error) {
      setMessage('Error updating business: ' + error.message)
      return
    }

    setMessage(`✅ "${business.name}" is now ${!business.is_active ? 'active' : 'deactivated'}`)
    fetchBusinesses()
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Platform Admin</h1>
        <button
          onClick={logout}
          style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Log Out
        </button>
      </div>
      <p style={{ color: '#666' }}>Manage all businesses on the platform</p>
      <p>{message}</p>

      {lastCredentials && (
        <div style={{ padding: '15px', backgroundColor: '#fff8e1', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffe082' }}>
          <strong>Give these login details to the business owner:</strong>
          <p style={{ margin: '8px 0 0' }}>Username: <strong>{lastCredentials.username}</strong></p>
          <p style={{ margin: '4px 0' }}>Password: <strong>{lastCredentials.password}</strong></p>
        </div>
      )}

      <h2 style={{ marginTop: '30px' }}>Add New Business</h2>
      <input
        type="text"
        placeholder="Business name"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        style={{ display: 'block', padding: '8px', marginBottom: '10px', width: '300px' }}
      />
      <input
        type="text"
        placeholder="Owner's first name"
        value={ownerFirstName}
        onChange={(e) => setOwnerFirstName(e.target.value)}
        style={{ display: 'block', padding: '8px', marginBottom: '10px', width: '300px' }}
      />
      <button
        onClick={handleAddBusiness}
        style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}
      >
        Add Business & Create Owner Login
      </button>

      <h2 style={{ marginTop: '30px' }}>All Businesses</h2>
      {businesses.map((b) => (
        <div
          key={b.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '15px',
            border: '1px solid #eee',
            borderRadius: '8px',
            marginBottom: '10px',
          }}
        >
          <div>
            <strong>{b.name}</strong>
            <span
              style={{
                marginLeft: '10px',
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: b.is_active ? '#d4f7dc' : '#fde2e2',
                color: b.is_active ? '#1a7a3a' : '#c0392b',
              }}
            >
              {b.is_active ? 'ACTIVE' : 'DEACTIVATED'}
            </span>
          </div>
          <button
            onClick={() => handleToggleActive(b)}
            style={{
              padding: '6px 12px',
              backgroundColor: b.is_active ? '#e74c3c' : '#00b386',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {b.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ))}
    </div>
  )
}