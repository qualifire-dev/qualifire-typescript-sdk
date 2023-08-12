export function getClient(
  sdkKey?: string,
  qualifireBaseUrl?: string
): QualifireClient {
  const key = sdkKey || process.env.QUALIFIRE_SDK_KEY;
  const baseUrl =
    qualifireBaseUrl ||
    process.env.QUALIFIRE_BASE_URL ||
    'https://app.qualifire.xyz';

  if (!key) {
    throw new Error(
      'Missing SDK key, please provide an arg or add the QUALIFIRE_SDK_KEY environment variable.'
    );
  }

  return new QualifireClient(key, baseUrl);
}

class QualifireClient {
  sdkKey: string;
  baseUrl: string;

  constructor(key: string, baseUrl: string) {
    this.sdkKey = key;
    this.baseUrl = baseUrl;
  }

  async getValueAsync(
    promptId: string,
    templateValues?: Record<string, string>,
    defaultValue: string | null = null
  ) {
    const qualifireResponse = await fetch(
      `${this.baseUrl}/api/studio/prompt?${new URLSearchParams({
        promptId,
      }).toString()}`,
      {
        headers: new Headers({
          Authorization: 'Bearer ' + this.sdkKey,
        }),
      }
    );

    if (!qualifireResponse.ok) {
      console.error('error while getting the prompt', qualifireResponse.json());
      return defaultValue;
    }
    const regex = /\{[a-zA-Z0-9_-]+\}/gm;
    const { prompt } = (await qualifireResponse.json()) as {
      prompt: string;
    };
    const templateVariables = prompt
      .match(regex)
      ?.map(v => v.replace('{', '').replace('}', ''));

    let parsedPrompt: string = prompt;
    if (templateValues && templateVariables) {
      for (const variable of templateVariables) {
        parsedPrompt = parsedPrompt.replaceAll(
          `{${variable}}`,
          templateValues[variable] || ''
        );
      }
      return parsedPrompt;
    }

    return defaultValue;
  }
}
