import { ProviderShared } from "../shared"

// Gemini accepts a JSON Schema-like dialect for tool parameters, but rejects a
// handful of common JSON Schema shapes. Keep this projection isolated so the
// Gemini protocol file still reads like the other protocol modules.
const SCHEMA_INTENT_KEYS = [
  "type",
  "properties",
  "items",
  "prefixItems",
  "enum",
  "const",
  "$ref",
  "additionalProperties",
  "patternProperties",
  "required",
  "not",
  "if",
  "then",
  "else",
]

const isRecord = ProviderShared.isRecord

const hasCombiner = (schema: unknown) =>
  isRecord(schema) && (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf) || Array.isArray(schema.allOf))

const hasSchemaIntent = (schema: unknown) =>
  isRecord(schema) && (hasCombiner(schema) || SCHEMA_INTENT_KEYS.some((key) => key in schema))

const sanitizeNode = (schema: unknown): unknown => {
  if (!isRecord(schema)) return Array.isArray(schema) ? schema.map(sanitizeNode) : schema

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(schema)) {
    result[key] = key === "enum" && Array.isArray(value) ? value.map(String) : sanitizeNode(value)
  }

  if (Array.isArray(result.enum) && (result.type === "integer" || result.type === "number")) result.type = "string"

  const properties = result.properties
  if (result.type === "object" && isRecord(properties) && Array.isArray(result.required)) {
    result.required = result.required.filter((field) => typeof field === "string" && field in properties)
  }

  if (result.type === "array" && !hasCombiner(result)) {
    result.items = result.items ?? {}
    if (isRecord(result.items) && !hasSchemaIntent(result.items)) result.items = { ...result.items, type: "string" }
  }

  if (typeof result.type === "string" && result.type !== "object" && !hasCombiner(result)) {
    delete result.properties
    delete result.required
  }

  return result
}

const emptyObjectSchema = (schema: Record<string, unknown>) =>
  schema.type === "object" &&
  (!isRecord(schema.properties) || Object.keys(schema.properties).length === 0) &&
  !schema.additionalProperties

const projectNode = (schema: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(schema)) return undefined
  if (emptyObjectSchema(schema)) return undefined
  const result: Record<string, unknown> = {}
  if (schema.description !== undefined) result.description = schema.description
  if (schema.required !== undefined) result.required = schema.required
  if (schema.format !== undefined) result.format = schema.format
  if (schema.type !== undefined) {
    result.type = Array.isArray(schema.type) ? schema.type.filter((type) => type !== "null")[0] : schema.type
  }
  if (Array.isArray(schema.type) && schema.type.includes("null")) result.nullable = true
  if (schema.const !== undefined) {
    result.enum = [schema.const]
  } else if (schema.enum !== undefined) {
    result.enum = schema.enum
  }
  if (isRecord(schema.properties)) {
    const projected: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(schema.properties)) {
      projected[key] = projectNode(value)
    }
    result.properties = projected
  }
  if (Array.isArray(schema.items)) {
    result.items = schema.items.map(projectNode)
  } else if (schema.items !== undefined) {
    result.items = projectNode(schema.items)
  }
  if (Array.isArray(schema.allOf)) result.allOf = schema.allOf.map(projectNode)
  if (Array.isArray(schema.anyOf)) result.anyOf = schema.anyOf.map(projectNode)
  if (Array.isArray(schema.oneOf)) result.oneOf = schema.oneOf.map(projectNode)
  if (schema.minLength !== undefined) result.minLength = schema.minLength
  return result
}

export const convert = (schema: unknown) => projectNode(sanitizeNode(schema))

export * as GeminiToolSchema from "./gemini-tool-schema"
