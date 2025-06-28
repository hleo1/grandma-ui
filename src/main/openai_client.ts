import OpenAI from 'openai'

class OpenAIClient {
  private client: OpenAI

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    })
  }

  async sendPrompt(prompt: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'o4-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      return completion.choices[0]?.message?.content || 'No response received'
    } catch (error) {
      console.error('OpenAI API error:', error)
      throw new Error(`Failed to get response from OpenAI: ${error}`)
    }
  }
}

export { OpenAIClient }
