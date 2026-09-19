'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'
import BarcodeScanner from '@/components/BarcodeScanner'

export default function ProductsPage() {
  const [businessId, setBusinessId] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [barcode, setBarcode] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [message, setMessage] = useState('')
  const [products, setProducts] = useState([])
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

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        cost_price,
        barcode,
        reorder_level,
        branch_stock ( quantity, branch_id )
      `)
      .eq('business_id', businessId)
      .order('name')

    if (!error) setProducts(data)
  }

  useEffect(() => {
    if (authorized && businessId) {
      fetchBranches()
      fetchProducts()
    }
  }, [authorized, businessId])

  const handleAddProduct = async () => {
    if (!branchId) {
      setMessage('Please add a branch first before adding products.')
      return
    }

    const trimmedBarcode = barcode.trim()

    if (trimmedBarcode) {
      const { data: existing } = await supabase
        .from('products')
        .select('id, name')
        .eq('business_id', businessId)
        .eq('barcode', trimmedBarcode)
        .maybeSingle()

      if (existing) {
        setMessage(`That barcode is already used by "${existing.name}".`)
        return
      }
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        business_id: businessId,
        name,
        price: parseFloat(price),
        cost_price: parseFloat(costPrice),
        barcode: trimmedBarcode || null,
      })
      .select()
      .single()

    if (productError) {
      setMessage('Error creating product: ' + productError.message)
      return
    }

    const { error: stockError } = await supabase.from('branch_stock').insert({
      product_id: product.id,
      branch_id: branchId,
      quantity: parseInt(quantity),
    })

    if (stockError) {
      setMessage('Product created, but stock failed: ' + stockError.message)
      return
    }

    setMessage(`✅ Added "${name}" to selected branch!`)
    setName('')
    setPrice('')
    setCostPrice('')
    setQuantity('')
    setBarcode('')
    fetchProducts()
  }

  const handleScan = (decodedText) => {
    setShowScanner(false)
    setBarcode(decodedText)
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '700px' }}>
      <h1>Add Product</h1>

      {branches.length === 0 ? (
        <p style={{ color: '#e74c3c' }}>You need to add a branch first — go to Branches in your dashboard.</p>
      ) : (
        <label style={{ display: 'block', marginBottom: '15px' }}>
          Add stock to branch:{' '}
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '6px' }}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      )}

      <input
        type="text"
        placeholder="Product name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%' }}
      />
      <input
        type="number"
        placeholder="Selling price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%' }}
      />
      <input
        type="number"
        placeholder="Cost price"
        value={costPrice}
        onChange={(e) => setCostPrice(e.target.value)}
        style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%' }}
      />
      <input
        type="number"
        placeholder="Starting stock quantity"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%' }}
      />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="Barcode (optional — type or scan)"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          style={{ flex: 1, padding: '8px' }}
        />
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          style={{
            padding: '8px 14px',
            backgroundColor: '#00b386',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          📷 Scan
        </button>
      </div>

      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      <button
        onClick={handleAddProduct}
        style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}
      >
        Add Product
      </button>
      <p>{message}</p>
      <h2 style={{ marginTop: '40px' }}>
        Your Products — {branches.find((b) => b.id === branchId)?.name || 'Select a branch'}
      </h2>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1, padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666' }}>Stock Worth (Cost Price)</p>
          <h2 style={{ margin: '5px 0' }}>
            KES {products.reduce((sum, p) => {
              const stockRow = p.branch_stock?.find((s) => s.branch_id === branchId)
              const qty = stockRow?.quantity ?? 0
              return sum + qty * (p.cost_price || 0)
            }, 0).toFixed(2)}
          </h2>
        </div>
        <div style={{ flex: 1, padding: '15px', backgroundColor: '#f0fff5', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666' }}>Stock Worth (Selling Price)</p>
          <h2 style={{ margin: '5px 0' }}>
            KES {products.reduce((sum, p) => {
              const stockRow = p.branch_stock?.find((s) => s.branch_id === branchId)
              const qty = stockRow?.quantity ?? 0
              return sum + qty * (p.price || 0)
            }, 0).toFixed(2)}
          </h2>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Price</th>
            <th style={{ padding: '8px' }}>Barcode</th>
            <th style={{ padding: '8px' }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const stockRow = p.branch_stock?.find((s) => s.branch_id === branchId)
            const qty = stockRow?.quantity ?? 0
            const low = qty <= p.reorder_level
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{p.name}</td>
                <td style={{ padding: '8px' }}>KES {p.price}</td>
                <td style={{ padding: '8px', color: '#888' }}>{p.barcode || '—'}</td>
                <td style={{ padding: '8px', color: low ? 'red' : 'white' }}>
                  {qty} {low ? '⚠️' : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}