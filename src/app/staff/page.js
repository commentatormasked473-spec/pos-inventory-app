'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function StaffPage() {
  const [businessId, setBusinessId] = useState(null)
  const [branches, setBranches] = useState([])
  const [staff, setStaff] = useState([])
  const [firstName, setFirstName] = useState('')
  const [staffId, setStaffId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [message, setMessage] = useState('')
  const [lastCredentials, setLastCredentials] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u || u.role !== 'owner') {
        router.push('/checkout')
        return
      }
      setBusinessId(u.business_id)
      setAuthorized(true)
    })
  }, [])

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name')
    setBranches(data || [])
    if (data && data.length > 0 && !branchId) setBranchId(data[0].id)
  }

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('app_users')
      .select('id, full_name, role, branches ( name )')
      .eq('business_id', businessId)
      .eq('role', 'cashier')
    setStaff(data || [])
  }

  useEffect(() => {
    if (authorized && businessId) {
      fetchBranches()
      fetchStaff()
    }
  }, [authorized, businessId])

  const handleAddCashier = async () => {
    if (!firstName.trim() || !staffId.trim() || !branchId) {
      setMessage('First name, staff ID, and branch are all required.')
      return
    }

    const username = firstName.trim().toLowerCase().replace(/\s+/g, '')
    const password = staffId.trim()
    const email = username + '@posapp.local'

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        fullName: firstName,
        role: 'cashier',
        businessId,
        branchId,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      setMessage('Error creating cashier account: ' + result.error)
      return
    }

    setLastCredentials({ username, password })
    setMessage(`✅ Cashier account created for ${firstName}`)
    setFirstName('')
    setStaffId('')
    fetchStaff()
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Staff</h1>
        <button
          onClick={logout}
          style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Log Out
        </button>
      </div>
      <p>{message}</p>

      {lastCredentials && (
        <div style={{ padding: '15px', backgroundColor: '#fff8e1', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffe082' }}>
          <strong>Give these login details to the cashier:</strong>
          <p style={{ margin: '8px 0 0' }}>Username: <strong>{lastCredentials.username}</strong></p>
          <p style={{ margin: '4px 0' }}>Password: <strong>{lastCredentials.password}</strong></p>
        </div>
      )}

      {branches.length === 0 ? (
        <p style={{ color: '#e74c3c' }}>Add a branch first before creating cashier accounts.</p>
      ) : (
        <>
          <h2>Add Cashier</h2>
          <input
            type="text"
            placeholder="Cashier's first name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{ display: 'block', padding: '8px', marginBottom: '10px', width: '300px' }}
          />
          <input
            type="text"
            placeholder="Staff ID (used as password)"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            style={{ display: 'block', padding: '8px', marginBottom: '10px', width: '300px' }}
          />
          <label style={{ display: 'block', marginBottom: '10px' }}>
            Branch:{' '}
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '6px' }}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <button
            onClick={handleAddCashier}
            style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}
          >
            Create Cashier Account
          </button>
        </>
      )}

      <h2 style={{ marginTop: '30px' }}>Your Cashiers</h2>
      {staff.map((s) => (
        <div key={s.id} style={{ padding: '12px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '8px' }}>
          <strong>{s.full_name}</strong>
          {s.branches?.name && <span style={{ color: '#666' }}> — {s.branches.name}</span>}
        </div>
      ))}
    </div>
  )
}