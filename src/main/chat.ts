import { intro_prompt, search_engine_prompt, initial_call_to_action_prompt, call_to_action_prompt, full_text_request_prompt } from './prompts'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SearchResult {
  page: string
  text: string
}

interface SearchRound {
  query: string
  results: SearchResult[]
}

interface FullTextRequest {
  url: string
  text: string
}

interface AIResponse {
  user_problem_summary?: string
  relevant_rules_and_services_summary?: string
  enough_information_to_answer_question?: boolean
  message?: string
  search_queries?: string[]
  full_text_requests?: string[]
  user_satisfied?: boolean
  solution_url?: string
}

export class ChatState {
  private getResourcesUrl: string
  private conversationHistory: ChatMessage[] = []
  private searchHistory: SearchRound[] = []
  private fullTextRequests: FullTextRequest[] = []

  constructor(getResourcesUrl: string) {
    this.getResourcesUrl = getResourcesUrl
  }

  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory
  }

  getContext(): string {
    let lastAIResponse = 'No response yet.'
    if (this.conversationHistory.length > 0) {
      const AIResponses = this.conversationHistory.filter(message => message.role === 'assistant')
      lastAIResponse = AIResponses[AIResponses.length - 1].content
    }
    return `
    ${intro_prompt}

    ${JSON.stringify(this.conversationHistory)}

    To help the user, you used a search engine to collect relevant information about NYC's rules and services. Here is your search history:
    
    ${JSON.stringify(this.searchHistory)}

    You also requested the full text contents of the following pages:

    ${JSON.stringify(this.fullTextRequests)}

    You finally arrived at the following response:

    ${lastAIResponse}
    `
  }

  getInitialPrompt(message: string): string {
    return `
    ${intro_prompt}

    User: ${message}

    ${search_engine_prompt}

    Your task is to make sure you understand the user's question and generate search queries that will help you answer the user's question.

    ${initial_call_to_action_prompt}
    `
  }

  // Get prompt from chat.py
  getPrompt(): string {
    return `
    ${intro_prompt}

    ${JSON.stringify(this.conversationHistory)}

    ${search_engine_prompt}

    ${JSON.stringify(this.searchHistory)}

    ${full_text_request_prompt}

    ${JSON.stringify(this.fullTextRequests)}

    ${call_to_action_prompt}
    `
  }

  addUserMessage(message: string) {
    this.conversationHistory = [...this.conversationHistory, {
      role: 'user',
      content: message
    }]
  }
  
  async addAIResponse(response: string): Promise<AIResponse> {
    let parsedResponse: AIResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse response as JSON:', error);
      parsedResponse = {
        user_problem_summary: '',
        relevant_rules_and_services_summary: '',
        enough_information_to_answer_question: false,
        message: '',
        search_queries: [],
        full_text_requests: [],
        user_satisfied: false,
        solution_url: ''
      }
    }
    this.conversationHistory = [...this.conversationHistory, {
      role: 'assistant',
      content: response,
    }]
    await this.getAndAddResources(parsedResponse)
    return parsedResponse
  }

  async getAndAddResources(response: AIResponse) {
    if (!response.search_queries && !response.full_text_requests) {
      return
    }
    // Send GET request to getResourcesUrl with search queries and full text requests
    await fetch(this.getResourcesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        search_queries: response.search_queries || [],
        full_text_requests: response.full_text_requests || []
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.search_results) {
        this.searchHistory = [...this.searchHistory, ...data.search_results]
      }
      if (data.full_text_requests) {
        this.fullTextRequests = [...this.fullTextRequests, ...data.full_text_requests]
      }
    })
    .catch(error => {
      console.error('Failed to send resources request:', error)
    })
  }

  parseResponse(response: string): AIResponse {
    let parsedResponse: AIResponse;
    try {
      if (response.startsWith('```') || response.endsWith('```')) {
        let lines = response.split("\n")
        lines = lines.slice(1, lines.length - 1);
        response = lines.join("\n")
      }
      parsedResponse = JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse response as JSON:', error);
      parsedResponse = {
        user_problem_summary: '',
        relevant_rules_and_services_summary: '',
        enough_information_to_answer_question: false,
        message: '',
        search_queries: [],
        full_text_requests: [],
        user_satisfied: false,
        solution_url: ''
      }
    }
    return parsedResponse
  }
}

export async function sendInitialMessage(message: string, state: ChatState, sendPrompt: (prompt: string) => Promise<string>): Promise<AIResponse> {
  // Ask the assistant to suggest search queries then feed the search results
  // into the chat state.
  // We don't update add the user message to the history because this is only
  // to get the initial context for the assistant.
  const prompt = state.getInitialPrompt(message)
  const response = await sendPrompt(prompt)
  const parsedResponse = state.parseResponse(response)
  await state.getAndAddResources(parsedResponse)
  return parsedResponse
}

export async function sendMessage(message: string, state: ChatState, sendPrompt: (prompt: string) => Promise<string>): Promise<AIResponse> {
  state.addUserMessage(message)
  const prompt = state.getPrompt()
  const response = await sendPrompt(prompt)
  return await state.addAIResponse(response)
}

export async function loop(
  getResourcesUrl: string,
  changeAssistantText: (text: string) => void,
  reqestUserResponse: () => Promise<string>,
  sendPrompt: (prompt: string) => Promise<string>,
  suggestSolution: (url: string) => void,
) {
  const state = new ChatState(getResourcesUrl)

  await changeAssistantText('How can I help?')
  let userResponse = await reqestUserResponse()
  
  const initialResponse = await sendInitialMessage(userResponse, state, sendPrompt)
  if (initialResponse.message) {
    changeAssistantText(initialResponse.message)
  }

  while (true) {
    const response = await sendMessage(userResponse, state, sendPrompt)
    if (response.message) {
      changeAssistantText(response.message)
    }
    if (response.solution_url) {
      suggestSolution(response.solution_url)
    }
    if (response.user_satisfied) {
      break
    }
    userResponse = await reqestUserResponse()
  }
}