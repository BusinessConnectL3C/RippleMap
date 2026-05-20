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
  description?: string;
  thumbnail?: string;
  owner: string;
  created: number;
  modified: number;
  url?: string;
  tags?: string[];
  snippet?: string;
}

export interface ArcGISGroupItemsResponse {
  total: number;
  start: number;
  num: number;
  nextStart: number;
  items: ArcGISItem[];
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
