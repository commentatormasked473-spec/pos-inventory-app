'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const BUSINESS_ID = 'ce9c8d78-d29f-470d-bd14-fb2a58eac310'
const BRANCH_ID = '386f0e58-dbd4-4bf3-b157-0719ae994e82'

export default function ProductsPage() {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [message, setMessage] = useState('')

  const handleAddProduct = async () => {
    // Step 1: create the product
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

    // Step 2: create the stock record for this branch
    const { error: stockError } = await supabase.from('branch_stock').insert({
      product_id: product.id,
      branch_id: BRANCH_ID,
      quantity: parseInt(quantity),
    })

    if (stockError) {
      setMessage('Product created, but stock failed: ' + stockError.message)
      return
    }

    setMessage(`✅ Added "${name}" with ${quantity} units in stock!`)
    setName('')
    setPrice('')
    setCostPrice('')
    setQuantity('')
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '400px' }}>
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
      <button onClick={handleAddProduct} style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}>
        Add Product
      </button>
      <p>{message}</p>
    </div>
  )
}