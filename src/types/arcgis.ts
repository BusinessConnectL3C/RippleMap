export interface ArcGISTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  username?: string;
  ssl?: boolean;
}

export interface ArcGISItem {
  id: string;
  title: string;
  type: string;
  typeKeywords?: string[];
  description?: string;
  thumbnail?: string;
  owner: string;
  created: number;
  modified: number;
  url?: string;
  tags?: string[];
  snippet?: string;
}

/**
 * Field Maps has no dedicated AGOL item type — it's a Web Map (whose layers carry
 * form config) or a bare hosted Feature Service. Survey123 is identified by the
 * "Form" item type plus a Survey123 typeKeyword; its data lives in a related
 * Feature Service item, not on the Form item itself.
 */
export type FormKind = "survey123" | "fieldmaps-webmap" | "fieldmaps-layer" | "unknown";

export interface ArcGISSearchResponse {
  total: number;
  start: number;
  num: number;
  nextStart: number;
  results: ArcGISItem[];
}

export interface FeatureServiceField {
  name: string;
  type: string;
  alias: string;
  nullable?: boolean;
  editable?: boolean;
  length?: number;
  domain?: CodedValueDomain | null;
  defaultValue?: string | number | null;
}

export interface CodedValueDomain {
  type: "codedValue";
  name: string;
  codedValues: Array<{ name: string; code: string | number }>;
}

export interface FeatureServiceDefinition {
  id: number;
  name: string;
  type: string;
  fields: FeatureServiceField[];
  geometryType?: string;
}

export interface ArcGISUserInfo {
  username: string;
  fullName: string;
  email: string;
  orgId: string;
  orgUrl?: string;
}
