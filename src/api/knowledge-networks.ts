import { HttpError } from "../utils/http.js";

function buildHeaders(accessToken: string, businessDomain: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "zh-cn",
    authorization: `Bearer ${accessToken}`,
    token: accessToken,
    "x-business-domain": businessDomain,
    "x-language": "zh-cn",
  };
}

export interface ListKnowledgeNetworksOptions {
  baseUrl: string;
  accessToken: string;
  businessDomain?: string;
  offset?: number;
  limit?: number;
  sort?: string;
  direction?: "asc" | "desc";
  name_pattern?: string;
  tag?: string;
}

export async function listKnowledgeNetworks(
  options: ListKnowledgeNetworksOptions
): Promise<string> {
  const {
    baseUrl,
    accessToken,
    businessDomain = "bd_public",
    offset = 0,
    limit = 50,
    sort = "update_time",
    direction = "desc",
    name_pattern,
    tag,
  } = options;

  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/api/ontology-manager/v1/knowledge-networks`);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("direction", direction);
  url.searchParams.set("sort", sort);
  if (name_pattern !== undefined && name_pattern !== "") {
    url.searchParams.set("name_pattern", name_pattern);
  }
  if (tag !== undefined && tag !== "") {
    url.searchParams.set("tag", tag);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildHeaders(accessToken, businessDomain),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, body);
  }
  return body;
}

export interface GetKnowledgeNetworkOptions {
  baseUrl: string;
  accessToken: string;
  knId: string;
  businessDomain?: string;
  mode?: "export" | "";
  include_statistics?: boolean;
}

export async function getKnowledgeNetwork(
  options: GetKnowledgeNetworkOptions
): Promise<string> {
  const {
    baseUrl,
    accessToken,
    knId,
    businessDomain = "bd_public",
    mode,
    include_statistics,
  } = options;

  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/api/ontology-manager/v1/knowledge-networks/${encodeURIComponent(knId)}`);
  if (mode === "export") {
    url.searchParams.set("mode", "export");
  }
  if (include_statistics === true) {
    url.searchParams.set("include_statistics", "true");
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildHeaders(accessToken, businessDomain),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, body);
  }
  return body;
}

export interface CreateKnowledgeNetworkOptions {
  baseUrl: string;
  accessToken: string;
  body: string;
  businessDomain?: string;
  import_mode?: "normal" | "ignore" | "overwrite";
  validate_dependency?: boolean;
}

export async function createKnowledgeNetwork(
  options: CreateKnowledgeNetworkOptions
): Promise<string> {
  const {
    baseUrl,
    accessToken,
    body,
    businessDomain = "bd_public",
    import_mode,
    validate_dependency,
  } = options;

  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/api/ontology-manager/v1/knowledge-networks`);
  if (import_mode) {
    url.searchParams.set("import_mode", import_mode);
  }
  if (validate_dependency !== undefined) {
    url.searchParams.set("validate_dependency", String(validate_dependency));
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...buildHeaders(accessToken, businessDomain),
      "content-type": "application/json",
    },
    body,
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, responseBody);
  }
  return responseBody;
}

export interface UpdateKnowledgeNetworkOptions {
  baseUrl: string;
  accessToken: string;
  knId: string;
  body: string;
  businessDomain?: string;
}

export async function updateKnowledgeNetwork(
  options: UpdateKnowledgeNetworkOptions
): Promise<string> {
  const {
    baseUrl,
    accessToken,
    knId,
    body,
    businessDomain = "bd_public",
  } = options;

  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/api/ontology-manager/v1/knowledge-networks/${encodeURIComponent(knId)}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...buildHeaders(accessToken, businessDomain),
      "content-type": "application/json",
    },
    body,
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, responseBody);
  }
  return responseBody;
}

export interface DeleteKnowledgeNetworkOptions {
  baseUrl: string;
  accessToken: string;
  knId: string;
  businessDomain?: string;
}

export async function deleteKnowledgeNetwork(
  options: DeleteKnowledgeNetworkOptions
): Promise<void> {
  const {
    baseUrl,
    accessToken,
    knId,
    businessDomain = "bd_public",
  } = options;

  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/api/ontology-manager/v1/knowledge-networks/${encodeURIComponent(knId)}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: buildHeaders(accessToken, businessDomain),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(response.status, response.statusText, body);
  }
}

/**
 * List object types (对象类) — ontology-manager.
 * @see ref/ontology/ontology-manager-object-type.yaml
 */
export interface ListObjectTypesOptions {
  baseUrl: string;
  accessToken: string;
  knId: string;
  businessDomain?: string;
  name_pattern?: string;
  sort?: string;
  direction?: "asc" | "desc";
  offset?: number;
  limit?: number;
  tag?: string;
  group_id?: string;
}

export async function listObjectTypes(
  options: ListObjectTypesOptions
): Promise<string> {
  const {
    baseUrl,
    accessToken,
    knId,
    businessDomain = "bd_public",
    name_pattern,
    sort = "update_time",
    direction = "desc",
    offset = 0,
    limit = -1,
    tag,
    group_id,
  } = options;

  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(
    `${base}/api/ontology-manager/v1/knowledge-networks/${encodeURIComponent(knId)}/object-types`
  );
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", sort);
  url.searchParams.set("direction", direction);
  if (name_pattern !== undefined && name_pattern !== "") {
    url.searchParams.set("name_pattern", name_pattern);
  }
  if (tag !== undefined && tag !== "") {
    url.searchParams.set("tag", tag);
  }
  if (group_id !== undefined && group_id !== "") {
    url.searchParams.set("group_id", group_id);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildHeaders(accessToken, businessDomain),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, body);
  }
  return body;
}

/**
 * List relation types (关系类) — ontology-manager.
 * @see ref/ontology/ontology-manager-relation-type.yaml
 */
export interface ListRelationTypesOptions {
  baseUrl: string;
  accessToken: string;
  knId: string;
  businessDomain?: string;
  name_pattern?: string;
  sort?: string;
  direction?: "asc" | "desc";
  offset?: number;
  limit?: number;
  tag?: string;
  group_id?: string;
  source_object_type_id?: string;
  target_object_type_id?: string;
  bound_object_type_id?: string[];
}

export async function listRelationTypes(
  options: ListRelationTypesOptions
): Promise<string> {
  const {
    baseUrl,
    accessToken,
    knId,
    businessDomain = "bd_public",
    name_pattern,
    sort = "update_time",
    direction = "desc",
    offset = 0,
    limit = -1,
    tag,
    group_id,
    source_object_type_id,
    target_object_type_id,
    bound_object_type_id,
  } = options;

  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(
    `${base}/api/ontology-manager/v1/knowledge-networks/${encodeURIComponent(knId)}/relation-types`
  );
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", sort);
  url.searchParams.set("direction", direction);
  if (name_pattern !== undefined && name_pattern !== "") {
    url.searchParams.set("name_pattern", name_pattern);
  }
  if (tag !== undefined && tag !== "") {
    url.searchParams.set("tag", tag);
  }
  if (group_id !== undefined && group_id !== "") {
    url.searchParams.set("group_id", group_id);
  }
  if (source_object_type_id !== undefined && source_object_type_id !== "") {
    url.searchParams.set("source_object_type_id", source_object_type_id);
  }
  if (target_object_type_id !== undefined && target_object_type_id !== "") {
    url.searchParams.set("target_object_type_id", target_object_type_id);
  }
  if (bound_object_type_id?.length) {
    for (const id of bound_object_type_id) {
      url.searchParams.append("bound_object_type_id", id);
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildHeaders(accessToken, businessDomain),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, body);
  }
  return body;
}

/**
 * List action types (行动类) — ontology-manager.
 * @see ref/ontology/ontology-manager-action-type.yaml
 */
export interface ListActionTypesOptions {
  baseUrl: string;
  accessToken: string;
  knId: string;
  businessDomain?: string;
  name_pattern?: string;
  sort?: string;
  direction?: "asc" | "desc";
  offset?: number;
  limit?: number;
  tag?: string;
  group_id?: string;
  action_type?: "add" | "modify" | "delete";
  object_type_id?: string;
}

export async function listActionTypes(
  options: ListActionTypesOptions
): Promise<string> {
  const {
    baseUrl,
    accessToken,
    knId,
    businessDomain = "bd_public",
    name_pattern,
    sort = "update_time",
    direction = "desc",
    offset = 0,
    limit = -1,
    tag,
    group_id,
    action_type,
    object_type_id,
  } = options;

  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(
    `${base}/api/ontology-manager/v1/knowledge-networks/${encodeURIComponent(knId)}/action-types`
  );
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", sort);
  url.searchParams.set("direction", direction);
  if (name_pattern !== undefined && name_pattern !== "") {
    url.searchParams.set("name_pattern", name_pattern);
  }
  if (tag !== undefined && tag !== "") {
    url.searchParams.set("tag", tag);
  }
  if (group_id !== undefined && group_id !== "") {
    url.searchParams.set("group_id", group_id);
  }
  if (action_type !== undefined && action_type !== "") {
    url.searchParams.set("action_type", action_type);
  }
  if (object_type_id !== undefined && object_type_id !== "") {
    url.searchParams.set("object_type_id", object_type_id);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildHeaders(accessToken, businessDomain),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, body);
  }
  return body;
}
