'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'

const BUSINESS_ID = 'ce9c8d78-d29f-470d-bd14-fb2a58eac310'

export default function BranchesPage() {
  const [branches, setBranches] = useState([])
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u || u.role !== 'owner') {
        router.push('/checkout')
        return
      }
      setAuthorized(true)
    })
  }, [])

  const fetchBranches = async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, location')
      .eq('business_id', BUSINESS_ID)
      .order('name')

    if (!error) setBranches(data)
  }

  useEffect(() => {
    if (authorized) fetchBranches()
  }, [authorized])

  const handleAddBranch = async () => {
    if (!name.trim()) {
      setMessage('Branch name is required.')
      return
    }

    const { error } = await supabase.from('branches').insert({
      business_id: BUSINESS_ID,
      name,
      location,
    })

    if (error) {
      setMessage('Error adding branch: ' + error.message)
      return
    }

    setMessage(`✅ Branch "${name}" added`)
    setName('')
    setLocation('')
    fetchBranches()
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px' }}>
      <h1>Branches</h1>
      <p>{message}</p>

      <h2>Add Branch</h2>
      <input
        type="text"
        placeholder="Branch name (e.g. Nakuru Town)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%' }}
      />
      <input
        type="text"
        placeholder="Location (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%' }}
      />
      <button
        onClick={handleAddBranch}
        style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}
      >
        Add Branch
      </button>

      <h2 style={{ marginTop: '30px' }}>Your Branches</h2>
      {branches.map((b) => (
        <div key={b.id} style={{ padding: '12px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '8px' }}>
          <strong>{b.name}</strong>
          {b.location && <span style={{ color: '#666' }}> — {b.location}</span>}
        </div>
      ))}
    </div>
  )
}