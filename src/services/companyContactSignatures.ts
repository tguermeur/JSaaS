import { httpsCallable } from 'firebase/functions';
import { getAppFunctions } from '../firebase/config';

export type CompanyContactSignatureItem = {
  id: string;
  documentTitle: string;
  status: string;
  mySignerStatus: string;
  sealedUrl: string | null;
};

export async function listMySignatureRequestsAsCompanyContact(): Promise<
  CompanyContactSignatureItem[]
> {
  const fn = httpsCallable(getAppFunctions(), 'listMySignatureRequestsAsCompanyContact');
  const res = await fn({});
  const data = res.data as { requests?: CompanyContactSignatureItem[] };
  return Array.isArray(data.requests) ? data.requests : [];
}
