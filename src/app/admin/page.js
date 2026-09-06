'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false)
  const [businesses, setBusinesses] = useState([])
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
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
    if (!name.trim()) {
      setMessage('Business name is required.')
      return
    }

    const { error } = await supabase.from('businesses').insert({
      name,
      is_active: true,
    })

    if (error) {
      setMessage('Error adding business: ' + error.message)
      return
    }

    setMessage(`✅ Business "${name}" added`)
    setName('')
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

      <h2 style={{ marginTop: '30px' }}>Add New Business</h2>
      <input
        type="text"
        placeholder="Business name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ padding: '8px', marginRight: '10px', width: '300px' }}
      />
      <button
        onClick={handleAddBusiness}
        style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}
      >
        Add Business
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