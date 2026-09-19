'use client'

import { useEffect, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null)
  const containerId = 'barcode-scanner-container'

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(containerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    })
    scannerRef.current = html5QrCode

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          onScan(decodedText)
          html5QrCode.stop().catch(() => {})
        },
        () => {} // ignore per-frame scan failures, they're constant/normal
      )
      .catch((err) => {
        console.error('Camera start failed', err)
      })

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current.clear())
          .catch(() => {})
      }
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
        <h3 style={{ marginBottom: '10px' }}>Scan Barcode</h3>
        <div id={containerId} style={{ width: '100%' }} />
        <button
          onClick={onClose}
          style={{ marginTop: '15px', padding: '10px 20px', width: '100%', background: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}