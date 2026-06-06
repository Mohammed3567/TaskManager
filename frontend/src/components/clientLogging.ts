export function logClientError(err: any, context: any = {}) {
  try {
    console.error('ClientLog', err, context)
    // TODO: post to server-side logging endpoint when available
  } catch (e) { console.error('logClientError failed', e) }
}

export function logClientInfo(msg: string, data?: any) { console.info('ClientInfo', msg, data) }
