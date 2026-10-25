export type Difficulty = 'easy' | 'medium' | 'hard'
export type Quest = {
  id: string
  title: string
  difficulty: Difficulty
  due_date: string | null
  recurrence: 'daily' | null
  done: boolean
}
export type Completion = {
  id: string
  quest_id: string
  day: string
  base_xp: number
  created_at: string
}
export type Me = {
  timezone: string
  xp: number
  level: number
  xp_into_level: number
  xp_to_next_level: number
  streak: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

async function request<T>(
  path: string,
  options: RequestInit | undefined,
  expectedStatuses: number[],
): Promise<{ data: T; status: number }> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: options?.body ? { 'Content-Type': 'application/json', ...options.headers } : options?.headers,
    })
  } catch {
    throw new Error('Unable to reach the habit tracker service. Please try again.')
  }
  if (!response.ok || !expectedStatuses.includes(response.status)) {
    let message = 'Something went wrong. Please try again.'
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Keep a useful generic message for malformed or empty error bodies.
    }
    throw new Error(message)
  }
  const data = response.status === 204 ? (undefined as T) : ((await response.json()) as T)
  return { data, status: response.status }
}

export const api = {
  getMe: () => request<Me>('/me', undefined, [200]).then((result) => result.data),
  getQuests: () => request<Quest[]>('/quests', undefined, [200]).then((result) => result.data),
  getCompletions: () => request<Completion[]>('/completions', undefined, [200]).then((result) => result.data),
  updateTimezone: (timezone: string) =>
    request<Me>('/me', { method: 'PUT', body: JSON.stringify({ timezone }) }, [200]).then((result) => result.data),
  createQuest: (input: { title: string; difficulty: Difficulty; due_date?: string; recurrence?: 'daily' }) =>
    request<Quest>('/quests', { method: 'POST', body: JSON.stringify(input) }, [201]).then((result) => result.data),
  completeQuest: (id: string) =>
    request<{ completion: Completion; me: Me }>(`/quests/${id}/complete`, { method: 'POST' }, [200, 201]),
  undoCompletion: (id: string) => request<void>(`/completions/${id}`, { method: 'DELETE' }, [204]),
}
