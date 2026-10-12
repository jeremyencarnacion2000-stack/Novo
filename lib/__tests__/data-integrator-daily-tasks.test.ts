/**
 * @jest-environment node
 */

import { DataIntegrator } from '@/lib/data-integrator'

describe('DataIntegrator daily task projection', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does not manufacture non-actionable review tasks for every course', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      const payload = url.includes('/api/school/courses')
        ? [{ id: 'course-1', name: 'Matemáticas', grades: [] }]
        : []
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    const tasks = await DataIntegrator.getDailyTasks('user-1')

    expect(tasks).toEqual([])
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/school/courses'))).toBe(false)
  })
})
