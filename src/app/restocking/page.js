'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'

const BUSINESS_ID = 'ce9c8d78-d29f-470d-bd14-fb2a58eac310'
const BRANCH_ID = '386f0e58-dbd4-4bf3-b157-0719ae994e82'

export default function RestockingPage() {
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])

  const [supplierName, setSupplierName] = useState('')
  const [supplierContact, setSupplierContact] = useState('')

  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [orderQty, setOrderQty] = useState('')

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

  const fetchAll = async () => {
    const { data: sup } = await supabase.from('suppliers').select('*').eq('business_id', BUSINESS_ID)
    setSuppliers(sup || [])

    const { data: prod } = await supabase.from('products').select('id, name').eq('business_id', BUSINESS_ID)
    setProducts(prod || [])

    const { data: po } = await supabase
      .from('purchase_orders')
      .select('id, quantity_ordered, status, created_at, product_id, suppliers ( name ), products ( name )')
      .order('created_at', { ascending: false })
    setOrders(po || [])
  }

  useEffect(() => {
    if (authorized) fetchAll()
  }, [authorized])

  const handleAddSupplier = async () => {
    if (!supplierName.trim()) return
    const { error } = await supabase.from('suppliers').insert({
      business_id: BUSINESS_ID,
      name: supplierName,
      contact: supplierContact,
    })
    if (error) {
      setMessage('Error adding supplier: ' + error.message)
      return
    }
    setSupplierName('')
    setSupplierContact('')
    setMessage('✅ Supplier added')
    fetchAll()
  }

  const handleCreateOrder = async () => {
    if (!selectedSupplier || !selectedProduct || !orderQty) {
      setMessage('Fill in supplier, product, and quantity.')
      return
    }
    const { error } = await supabase.from('purchase_orders').insert({
      supplier_id: selectedSupplier,
      branch_id: BRANCH_ID,
      product_id: selectedProduct,
      quantity_ordered: parseInt(orderQty),
      status: 'pending',
    })
    if (error) {
      setMessage('Error creating order: ' + error.message)
      return
    }
    setOrderQty('')
    setMessage('✅ Purchase order created')
    fetchAll()
  }

  const handleMarkReceived = async (order) => {
    const { error: orderError } = await supabase
      .from('purchase_orders')
      .update({ status: 'received', received_at: new Date().toISOString() })
      .eq('id', order.id)

    if (orderError) {
      setMessage('Error updating order: ' + orderError.message)
      return
    }

    const { data: stockRow } = await supabase
      .from('branch_stock')
      .select('id, quantity')
      .eq('product_id', order.product_id)
      .eq('branch_id', BRANCH_ID)
      .single()

    if (stockRow) {
      await supabase
        .from('branch_stock')
        .update({ quantity: stockRow.quantity + order.quantity_ordered })
        .eq('id', stockRow.id)
    }

    setMessage(`✅ Stock updated — received ${order.quantity_ordered} units`)
    fetchAll()
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px' }}>
      <h1>Suppliers & Restocking</h1>
      <p>{message}</p>

      <h2>Add Supplier</h2>
      <input
        type="text"
        placeholder="Supplier name"
        value={supplierName}
        onChange={(e) => setSupplierName(e.target.value)}
        style={{ padding: '8px', marginRight: '10px' }}
      />
      <input
        type="text"
        placeholder="Contact (phone/email)"
        value={supplierContact}
        onChange={(e) => setSupplierContact(e.target.value)}
        style={{ padding: '8px', marginRight: '10px' }}
      />
      <button onClick={handleAddSupplier} style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}>
        Add
      </button>

      <h2 style={{ marginTop: '30px' }}>Create Purchase Order</h2>
      <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} style={{ padding: '8px', marginRight: '10px' }}>
        <option value="">Select supplier</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} style={{ padding: '8px', marginRight: '10px' }}>
        <option value="">Select product</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input
        type="number"
        placeholder="Quantity"
        value={orderQty}
        onChange={(e) => setOrderQty(e.target.value)}
        style={{ padding: '8px', width: '100px', marginRight: '10px' }}
      />
      <button onClick={handleCreateOrder} style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}>
        Create Order
      </button>

      <h2 style={{ marginTop: '30px' }}>Purchase Orders</h2>
      {orders.map((o) => (
        <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #eee', borderRadius: '6px', marginBottom: '8px' }}>
          <span>
            {o.products.name} x{o.quantity_ordered} from {o.suppliers.name} — <strong>{o.status}</strong>
          </span>
          {o.status === 'pending' && (
            <button onClick={() => handleMarkReceived(o)} style={{ padding: '6px 12px', backgroundColor: '#00b386', color: 'white', border: 'none', borderRadius: '6px' }}>
              Mark Received
            </button>
          )}
        </div>
      ))}
    </div>
  )
}