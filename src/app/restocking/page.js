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