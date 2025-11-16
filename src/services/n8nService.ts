const WEBHOOK_URL = 'https://submiss-christena-repeatable.ngrok-free.dev/webhook/AIsyrfBolt';

export const sendMessageToWebhook = async (message: string): Promise<string> => {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // This header is crucial for bypassing the ngrok browser warning page,
        // which can cause "Failed to fetch" errors in programmatic clients.
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ question: message }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error response body.');
      throw new Error(`Webhook responded with status: ${response.status}. Response: ${errorText}`);
    }

    const responseText = await response.text();
    
    // This handles the "Unexpected end of JSON input" error by checking for an empty response.
    if (!responseText) {
      return "The AI returned an empty response. This might happen if the webhook is not configured to send a response body. Please check your n8n workflow.";
    }

    try {
      // First, try to parse the response as JSON.
      const data = JSON.parse(responseText);
      
      // The new webhook format returns an array with an object inside.
      // e.g., [{"output": "Hello! ..."}]
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'output' in data[0]) {
        return data[0].output || "The AI response was empty.";
      }

      // Fallback for a previous format for compatibility (e.g., { "answer": "..." }).
      if (data.answer) {
        return data.answer;
      }
      
      // If the format is completely unexpected.
      return "I received a response, but the format was unexpected. Please check the n8n workflow output.";
    } catch (e) {
      // If parsing as JSON fails, the webhook might have returned plain text.
      // This makes the app more resilient.
      return responseText;
    }

  } catch (error) {
    console.error("Error sending message to webhook:", error);
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch')) {
          return "A network error occurred. This could be a CORS issue, or the webhook server is down. Please check that the ngrok tunnel is active and the n8n workflow is running.";
      }
      return `Failed to send message: ${error.message}`;
    }
    return "An unknown error occurred while communicating with the webhook.";
  }
};