/**
 * @file Chat GPT related fucntionality.
 * @author Sebastian Gadzinski
 */

import axios from 'axios';
import config from '../config';

class ChatGPTService {
  public static getInstance(): ChatGPTService {
    if (!ChatGPTService.instance) {
      ChatGPTService.instance = new ChatGPTService();
    }
    return ChatGPTService.instance;
  }
  private static instance: ChatGPTService;

  private async query(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        config.chatGPT.endpoint,
        {
          messages: [{ content: prompt, role: 'user' }],
          model: 'gpt-4'
        },
        {
          headers: {
            'Authorization': `Bearer ${config.chatGPT.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (
        response.data &&
        response.data.choices &&
        response.data.choices.length > 0
      ) {
        return response.data.choices[0].message.content.trim();
      } else {
        throw new Error('Unexpected response format from OpenAI API');
      }
    } catch (error) {
      console.error('Error querying ChatGPT:', error);
      console.error('Prompt that caused error:', prompt);
      throw error;
    }
  }
}

export default ChatGPTService;
