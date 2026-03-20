import ky from 'ky'

const API_KEY = 'api_key_123'
const BASE_URL = '/hr-api/auth'

export const login = async (phone: string, password: string) => {
  try {
    const response = await ky.post(`${BASE_URL}/login`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
      json: {
        phone_number: phone,
        password: password,
      }
    }).json<Record<string, any>>()

    return response
  } catch (error: any) {
    let message = 'Authentication failed'
    if (error.response) {
      try {
        const errorData = await error.response.json()
        message = errorData.error || errorData.message || message
      } catch {
        // ignore json parse error
      }
    } else {
      message = error.message || message
    }
    throw new Error(message)
  }
}
