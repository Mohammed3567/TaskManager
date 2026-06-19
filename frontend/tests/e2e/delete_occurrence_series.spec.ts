import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:8000'

test('delete occurrence vs delete series', async ({ request }) => {
  const username = `e2e_del_${Date.now()}`
  const password = 'password123'

  // Register
  await request.post(`${API_BASE}/api/auth/register/`, { data: { username, password }})

  // Login - get session cookie
  const loginRes = await request.post(`${API_BASE}/api/auth/login/`, { data: { username, password }})
  expect(loginRes.ok()).toBeTruthy()

  // fetch CSRF token for subsequent state-changing requests
  const csrfRes = await request.get(`${API_BASE}/api/auth/csrf/`)
  expect(csrfRes.ok()).toBeTruthy()
  const csrfJson = await csrfRes.json()
  const csrfToken = csrfJson.csrfToken

  // Create recurring task with 3 occurrences
  const createRes = await request.post(`${API_BASE}/api/tasks/`, { data: { title: 'E2E delete test', date: new Date().toISOString(), duration_minutes: 30, priority: 'IMPORTANT', is_recurring: true, recurrence_rule: 'FREQ=DAILY;COUNT=3' }, headers: { 'X-CSRFToken': csrfToken }})
  if (!createRes.ok()) {
    const txt = await createRes.text().catch(()=>null)
    console.error('createRes failed', createRes.status(), txt)
  }
  expect(createRes.ok()).toBeTruthy()
  const taskBody = await createRes.json()
  const taskId = String(taskBody.id)

  // Get occurrences for next 7 days
  const now = new Date(Date.now() - 60 * 1000).toISOString()
  const in7 = new Date(Date.now() + 7*24*3600*1000).toISOString()
  const occRes = await request.get(`${API_BASE}/api/tasks/occurrences/?start=${encodeURIComponent(now)}&end=${encodeURIComponent(in7)}`)
  expect(occRes.ok()).toBeTruthy()
  const body = await occRes.json()
  const taskOcc = (body || []).filter((o:any)=> String(o.task_id) === taskId)
  expect(taskOcc.length).toBe(3)

  // Delete middle occurrence
  const occToDelete = taskOcc[1].date
  const delOcc = await request.delete(`${API_BASE}/api/tasks/${taskId}/?mode=instance&occurrence=${encodeURIComponent(occToDelete)}`, { headers: { 'X-CSRFToken': csrfToken }})
  expect(delOcc.status()).toBeGreaterThanOrEqual(200)

  // Verify occurrences reduced by 1
  const occRes2 = await request.get(`${API_BASE}/api/tasks/occurrences/?start=${encodeURIComponent(now)}&end=${encodeURIComponent(in7)}`)
  const body2 = await occRes2.json()
  const taskOcc2 = (body2 || []).filter((o:any)=> String(o.task_id) === taskId)
  expect(taskOcc2.length).toBe(2)

  // Delete whole series
  const delSeries = await request.delete(`${API_BASE}/api/tasks/${taskId}/`, { headers: { 'X-CSRFToken': csrfToken }})
  expect(delSeries.status()).toBeGreaterThanOrEqual(200)

  // Verify no occurrences remain
  const occRes3 = await request.get(`${API_BASE}/api/tasks/occurrences/?start=${encodeURIComponent(now)}&end=${encodeURIComponent(in7)}`)
  const body3 = await occRes3.json()
  const taskOcc3 = (body3 || []).filter((o:any)=> String(o.task_id) === taskId)
  expect(taskOcc3.length).toBe(0)
})
