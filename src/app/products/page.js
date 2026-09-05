'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'

const BUSINESS_ID = 'ce9c8d78-d29f-470d-bd14-fb2a58eac310'

export default function ProductsPage() {
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [quantity, setQuantity] = useState('')
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
      setAuthorized(true)
    })
  }, [])

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('business_id', BUSINESS_ID)
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
        reorder_level,
        branch_stock ( quantity, branch_id )
      `)
      .eq('business_id', BUSINESS_ID)
      .order('name')

    if (!error) setProducts(data)
  }

  useEffect(() => {
    if (authorized) {
      fetchBranches()
      fetchProducts()
    }
  }, [authorized])

  const handleAddProduct = async () => {
    if (!branchId) {
      setMessage('Please select a branch first.')
      return
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        business_id: BUSINESS_ID,
        name,
        price: parseFloat(price),
        cost_price: parseFloat(costPrice),
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
    fetchProducts()
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '700px' }}>
      <h1>Add Product</h1>

      <label style={{ display: 'block', marginBottom: '15px' }}>
        Add stock to branch:{' '}
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '6px' }}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>

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
      <button
        onClick={handleAddProduct}
        style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}
      >
        Add Product
      </button>
      <p>{message}</p>

      <h2 style={{ marginTop: '40px' }}>Your Products (all branches)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Price</th>
            <th style={{ padding: '8px' }}>Stock by Branch</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>{p.name}</td>
              <td style={{ padding: '8px' }}>KES {p.price}</td>
              <td style={{ padding: '8px' }}>
                {branches.map((b) => {
                  const stockRow = p.branch_stock?.find((s) => s.branch_id === b.id)
                  const qty = stockRow?.quantity ?? 0
                  const low = qty <= p.reorder_level
                  return (
                    <div key={b.id} style={{ color: low ? 'red' : 'black' }}>
                      {b.name}: {qty} {low ? '⚠️' : ''}
                    </div>
                  )
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}