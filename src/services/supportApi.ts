import apiClient from './apiClient';
import globals from './globals';

/** support@lightor.app: where owners write to Lightor (LT-448). */
export const SUPPORT_EMAIL = 'support@lightor.app';

export interface ProblemReport {
  message: string;
  /** The dashboard page it happened on (path and query). */
  pageUrl?: string;
  language?: string;
  /** "web", "ios app" or "android app". */
  app?: string;
  /** A screenshot, uploaded first (imagesApi). */
  imageName?: string;
}

/** LT-448: an owner's problem report - kept for Lightor's admin panel and emailed to it. 429 = too many today. */
export const sendProblemReport = async (report: ProblemReport): Promise<void> => {
  await apiClient.post(`${globals.supportUrl}report`, report);
};
