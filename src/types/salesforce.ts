export interface SalesforceTokenResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
  scope?: string;
}

export interface SalesforceInvoice {
  Id: string;
  Name: string;
  Amount__c: number;
  Status__c: "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";
  Due_Date__c: string;
  Invoice_Date__c: string;
  Invoice_PDF__c?: string;
  Description__c?: string;
}

export interface SalesforceQueryResponse<T> {
  totalSize: number;
  done: boolean;
  records: T[];
}
