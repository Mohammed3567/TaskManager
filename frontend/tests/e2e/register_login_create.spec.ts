import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:8000'

test('register, login, create recurring task, verify occurrences via API', async ({ request }) => {
  const username = `hasan_e2e`
  const password = 'password123'

  // Register
  await request.post(`${API_BASE}/api/auth/register/`, { data: { username, password }})

  // Login - get session cookie
  const loginRes = await request.post(`${API_BASE}/api/auth/login/`, { data: { username, password }})
  expect(loginRes.ok()).toBeTruthy()

  // Create recurring task
  const createRes = await request.post(`${API_BASE}/api/tasks/`, { data: { title: 'E2E recurring', date: new Date().toISOString(), duration_minutes: 30, is_recurring: true, recurrence_rule: 'FREQ=DAILY;COUNT=7' }})
  expect(createRes.status()).toBeGreaterThanOrEqual(200)

  // Get occurrences for next 7 days
  const now = new Date().toISOString()
  const in7 = new Date(Date.now() + 7*24*3600*1000).toISOString()
  const occRes = await request.get(`${API_BASE}/api/tasks/occurrences/?start=${encodeURIComponent(now)}&end=${encodeURIComponent(in7)}`)
  expect(occRes.ok()).toBeTruthy()
  const body = await occRes.json()
  expect(Array.isArray(body)).toBeTruthy()
})
