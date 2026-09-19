'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'

const COMMON_CATEGORIES = ['Rent', 'Transport', 'Wages', 'Utilities', 'Supplies', 'Other']

function todayISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 10)
}

export default function ExpensesPage() {
  const [businessId, setBusinessId] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [category, setCategory] = useState('Rent')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayISO())
  const [message, setMessage] = useState('')
  const [expenses, setExpenses] = useState([])
  const [authorized, setAuthorized] = useState(false)
  const [filter, setFilter] = useState('month') // 'day' | 'month' | 'year' | 'all'
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
  }

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, category, description, amount, expense_date, branch_id')
      .eq('business_id', businessId)
      .order('expense_date', { ascending: false })

    if (!error) setExpenses(data)
  }

  useEffect(() => {
    if (authorized && businessId) {
      fetchBranches()
      fetchExpenses()
    }
  }, [authorized, businessId])

  const handleAddExpense = async () => {
    const finalCategory = category === 'Other' && customCategory.trim() ? customCategory.trim() : category

    if (!finalCategory) {
      setMessage('Please choose or type a category.')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      setMessage('Please enter a valid amount.')
      return
    }
    if (!expenseDate) {
      setMessage('Please choose a date.')
      return
    }

    const { error } = await supabase.from('expenses').insert({
      business_id: businessId,
      branch_id: branchId || null,
      category: finalCategory,
      description: description.trim() || null,
      amount: parseFloat(amount),
      expense_date: expenseDate,
    })

    if (error) {
      setMessage('Error saving expense: ' + error.message)
      return
    }

    setMessage(`✅ Logged KES ${amount} for ${finalCategory}`)
    setAmount('')
    setDescription('')
    setCustomCategory('')
    fetchExpenses()
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) fetchExpenses()
  }

  const now = new Date()
  const filteredExpenses = expenses.filter((e) => {
    const d = new Date(e.expense_date + 'T00:00:00')
    if (filter === 'day') {
      return d.toDateString() === now.toDateString()
    }
    if (filter === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }
    if (filter === 'year') {
      return d.getFullYear() === now.getFullYear()
    }
    return true
  })

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)

  const branchName = (id) => branches.find((b) => b.id === id)?.name || 'All branches'

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px' }}>
      <h1>Expenses</h1>
      <p style={{ color: '#666' }}>Log rent, transport, wages, and other costs so your reports reflect real profit.</p>

      <div style={{ padding: '20px', backgroundColor: '#f8f8f8', borderRadius: '8px', marginTop: '15px' }}>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Date of expense:
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            style={{ display: 'block', marginTop: '4px', padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Category:
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ display: 'block', marginTop: '4px', padding: '8px', width: '100%', boxSizing: 'border-box' }}
          >
            {COMMON_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        {category === 'Other' && (
          <input
            type="text"
            placeholder="Type category (e.g. Repairs, Licenses)"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        )}

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Amount (KES):
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ display: 'block', marginTop: '4px', padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Branch (optional — leave blank if this applies to the whole business):
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            style={{ display: 'block', marginTop: '4px', padding: '8px', width: '100%', boxSizing: 'border-box' }}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Note (optional):
          <input
            type="text"
            placeholder="e.g. October shop rent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ display: 'block', marginTop: '4px', padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </label>

        <button
          onClick={handleAddExpense}
          style={{ padding: '10px 20px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Log Expense
        </button>
        <p>{message}</p>
      </div>

      <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>History</h2>
        <div>
          {['day', 'month', 'year', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                marginLeft: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: filter === f ? '2px solid #1a73e8' : '1px solid #ccc',
                backgroundColor: filter === f ? '#eaf2ff' : 'white',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {f === 'day' ? 'Today' : f === 'month' ? 'This Month' : f === 'year' ? 'This Year' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '15px', backgroundColor: '#fff3f3', borderRadius: '8px', marginTop: '10px' }}>
        <p style={{ margin: 0, color: '#666' }}>Total for selection</p>
        <h2 style={{ margin: '5px 0' }}>KES {totalFiltered.toFixed(2)}</h2>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Date</th>
            <th style={{ padding: '8px' }}>Category</th>
            <th style={{ padding: '8px' }}>Note</th>
            <th style={{ padding: '8px' }}>Branch</th>
            <th style={{ padding: '8px' }}>Amount</th>
            <th style={{ padding: '8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {filteredExpenses.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '12px', color: '#888' }}>No expenses in this period.</td>
            </tr>
          )}
          {filteredExpenses.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>{e.expense_date}</td>
              <td style={{ padding: '8px' }}>{e.category}</td>
              <td style={{ padding: '8px', color: '#888' }}>{e.description || '—'}</td>
              <td style={{ padding: '8px', color: '#888' }}>{branchName(e.branch_id)}</td>
              <td style={{ padding: '8px' }}>KES {parseFloat(e.amount).toFixed(2)}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                <button
                  onClick={() => handleDelete(e.id)}
                  style={{ padding: '4px 10px', backgroundColor: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}