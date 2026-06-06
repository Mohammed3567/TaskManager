import React from 'react'

export default class ErrorBoundary extends React.Component<any, {error:any}> {
  constructor(props:any){ super(props); this.state = {error:null} }
  static getDerivedStateFromError(error:any){ return {error} }
  componentDidCatch(error:any, info:any){ console.error('ErrorBoundary caught', error, info) }
  render(){ if(this.state.error) return <div className="card">An error occurred: {String(this.state.error)}</div>; return this.props.children }
}
