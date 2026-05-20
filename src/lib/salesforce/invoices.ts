import type {
  SalesforceInvoice,
  SalesforceQueryResponse,
} from "@/types/salesforce";
import { getSalesforceToken } from "./auth";

const API_VERSION = "v58.0";

/** Fetch invoices for a Salesforce contact. Falls back to empty array if not configured. */
export async function getInvoicesForContact(
  contactId: string
): Promise<SalesforceInvoice[]> {
  const { token, instanceUrl } = await getSalesforceToken();

  const query = `
    SELECT Id, Name, Amount__c, Status__c, Due_Date__c, Invoice_Date__c, Invoice_PDF__c, Description__c
    FROM Invoice__c
    WHERE Contact__c = '${contactId}'
    ORDER BY Due_Date__c DESC
    LIMIT 50
  `
    .trim()
    .replace(/\s+/g, " ");

  const res = await fetch(
    `${instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(query)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Salesforce query failed: ${res.statusText}`);
  }

  const data: SalesforceQueryResponse<SalesforceInvoice> = await res.json();
  return data.records;
}
