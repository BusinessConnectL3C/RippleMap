/** Subset of Felt API v2 response shapes used by RippleMap (from Felt's OpenAPI spec). */

export type FeltPublicAccess = "private" | "view_only" | "view_and_comment" | "view_comment_and_edit";

export interface FeltViewerPermissions {
  can_duplicate_map?: boolean;
  can_export_data?: boolean;
  can_see_map_presence?: boolean;
}

export interface FeltMapReference {
  id: string;
  type: "map_reference";
  title: string;
  url: string;
  thumbnail_url: string | null;
  created_at: string;
  visited_at: string | null;
  project_id: string;
  folder_id: string | null;
  public_access: FeltPublicAccess;
}

export interface FeltMap {
  id: string;
  type: "map";
  title: string;
  url: string;
  thumbnail_url: string | null;
  created_at: string;
  visited_at: string | null;
  project_id: string;
  folder_id?: string | null;
  public_access: FeltPublicAccess;
  viewer_permissions?: FeltViewerPermissions;
}

export interface FeltProject {
  id: string;
  type: "project";
  name: string;
  visibility: "workspace" | "private";
  max_inherited_permission: "view_only" | "view_and_contribute" | "view_and_edit";
  maps: FeltMapReference[];
}

export interface FeltProjectReference {
  id: string;
  type: "project_reference";
  name: string;
  visibility: "workspace" | "private";
}

export interface FeltEmbedToken {
  token: string;
  expires_at: string;
}
