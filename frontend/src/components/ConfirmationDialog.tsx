import React from 'react'

export default function ConfirmationDialog({ open, title, message, onConfirm, onCancel, confirmLabel='Confirm', cancelLabel='Cancel' }: any) {
  if (!open) return null
  return (
    <div style={{position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(2,6,23,0.6)', transition: 'opacity 200ms ease'}}>
      <div style={{width:420, background:'#071027', padding:18, borderRadius:12, transform: 'translateY(0)', transition:'transform 200ms ease, opacity 150ms ease'}}>
        <h4 style={{marginTop:0}}>{title}</h4>
        <div style={{marginBottom:12, color:'#9fb0d6'}}>{message}</div>
        <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
          <button className="btn" onClick={onCancel} style={{display:'inline-flex', alignItems:'center', gap:8}}>{cancelLabel}</button>
          <button className="btn danger" onClick={onConfirm} style={{display:'inline-flex', alignItems:'center', gap:8}}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
