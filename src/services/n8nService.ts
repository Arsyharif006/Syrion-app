const WEBHOOK_URL = 'https://submiss-christena-repeatable.ngrok-free.dev/webhook/AIsyrfBolt';

interface AttachmentPayload {
  name: string;
  type: string;
  size: number;
  data: string;
}

interface WebhookPayload {
  question: string;
  attachments?: AttachmentPayload[];
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl?: string;
  type: 'image' | 'file';
}

const extractTextFromResponse = (data: any): string | null => {
  if (!data) return null;

  if (Array.isArray(data) && data.length > 0 && data[0] !== null) {
    const first = data[0];
    if ('output' in first && first.output) return first.output;
    if ('text' in first && first.text) return first.text;
    if ('message' in first && first.message) return first.message;
    if ('response' in first && first.response) return first.response;
    if ('answer' in first && first.answer) return first.answer;
    if ('content' in first && first.content) return first.content;

    if ('parts' in first && Array.isArray(first.parts)) {
      const text = first.parts.map((p: any) => p.text || '').join('');
      if (text) return text;
    }

    if (typeof first === 'string') return first;
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    if (data.parts && Array.isArray(data.parts)) {
      const text = data.parts.map((p: any) => p.text || '').join('');
      if (text) return text;
    }

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    if (data.output) return data.output;
    if (data.text) return data.text;
    if (data.message) return data.message;
    if (data.response) return data.response;
    if (data.answer) return data.answer;
    if (data.content) return data.content;
  }

  if (typeof data === 'string' && data.trim()) return data.trim();

  return null;
};

const buildQuestionWithContext = (message: string, attachments?: UploadedFile[]): string => {
  if (!attachments?.length) return message;

  const labels = attachments.map((uf) => {
    const isImage = uf.type === 'image' || uf.file.type.startsWith('image/');
    return isImage ? `[gambar: ${uf.file.name}]` : `[dokumen: ${uf.file.name}]`;
  });

  return `${message}\n\n${labels.join('\n')}`;
};

export const sendMessageToWebhook = async (
  message: string,
  attachments?: UploadedFile[]
): Promise<string> => {
  try {
    const payload: WebhookPayload = {
      question: buildQuestionWithContext(message, attachments),
    };

    if (attachments && attachments.length > 0) {
      const attachmentPayloads: AttachmentPayload[] = await Promise.all(
        attachments.map(async (uf) => ({
          name: uf.file.name,
          type: uf.file.type,
          size: uf.file.size,
          data: await fileToBase64(uf.file),
        }))
      );
      payload.attachments = attachmentPayloads;
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error response body.');
      throw new Error(`Webhook responded with status: ${response.status}. Response: ${errorText}`);
    }

    const responseText = await response.text();

    if (!responseText) {
      return "The AI returned an empty response. Please check your n8n workflow.";
    }

    try {
      const data = JSON.parse(responseText);
      const extracted = extractTextFromResponse(data);
      if (extracted) return extracted;

      console.warn('Unexpected response format:', JSON.stringify(data, null, 2));
      return responseText;
    } catch {
      return responseText;
    }

  } catch (error) {
    console.error("Error sending message to webhook:", error);
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch')) {
        return "A network error occurred. This could be a CORS issue, or the webhook server is down.";
      }
      return `Failed to send message: ${error.message}`;
    }
    return "An unknown error occurred while communicating with the webhook.";
  }
};