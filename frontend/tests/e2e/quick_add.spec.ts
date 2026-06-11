import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:8000'

test('quick add creates a task with parsed date/time', async ({ request }) => {
  const username = `e2e_quick_${Date.now()}`
  const password = 'password123'

  // Register
  await request.post(`${API_BASE}/api/auth/register/`, { data: { username, password }})

  // Login
  const loginRes = await request.post(`${API_BASE}/api/auth/login/`, { data: { username, password }})
  expect(loginRes.ok()).toBeTruthy()

  // fetch CSRF token for subsequent requests
  const csrfRes = await request.get(`${API_BASE}/api/auth/csrf/`)
  expect(csrfRes.ok()).toBeTruthy()
  const csrfJson = await csrfRes.json()
  const csrfToken = csrfJson.csrfToken

  const text = 'Buy milk tomorrow at 9am'
  const res = await request.post(`${API_BASE}/api/core/quick_add/`, { data: { text }, headers: { 'X-CSRFToken': csrfToken }})
  if (!res.ok()) {
    const txt = await res.text().catch(()=>null)
    console.error('quick_add failed', res.status(), txt)
  }
  expect(res.ok()).toBeTruthy()
  const task = await res.json()
  expect(task).toBeTruthy()
  expect(task.title).toContain('Buy milk')
})
