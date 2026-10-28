/**
 * The server sends an AI request back while two of the account's are still
 * running (LT-482): "one moment", not "your budget is spent".
 */
export const isAiBusy = (error: unknown): boolean => {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } })?.response;
  return response?.status === 429 && response.data?.code === 'AI_BUSY';
};
