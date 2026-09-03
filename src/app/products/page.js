'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'

const BUSINESS_ID = 'ce9c8d78-d29f-470d-bd14-fb2a58eac310'
const BRANCH_ID = '386f0e58-dbd4-4bf3-b157-0719ae994e82'

export default function ProductsPage() {
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

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        cost_price,
        reorder_level,
        branch_stock ( quantity )
      `)
      .eq('business_id', BUSINESS_ID)
      .order('name')

    if (!error) setProducts(data)
  }

  useEffect(() => {
    if (authorized) fetchProducts()
  }, [authorized])

  const handleAddProduct = async () => {
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
      branch_id: BRANCH_ID,
      quantity: parseInt(quantity),
    })

    if (stockError) {
      setMessage('Product created, but stock failed: ' + stockError.message)
      return
    }

    setMessage(`✅ Added "${name}"!`)
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

      <h2 style={{ marginTop: '40px' }}>Your Products</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Price</th>
            <th style={{ padding: '8px' }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const stock = p.branch_stock?.[0]?.quantity ?? 0
            const lowStock = stock <= p.reorder_level
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{p.name}</td>
                <td style={{ padding: '8px' }}>KES {p.price}</td>
                <td style={{ padding: '8px', color: lowStock ? 'red' : 'black' }}>
                  {stock} {lowStock ? '⚠️ Low stock' : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}