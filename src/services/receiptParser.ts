import HttpErrors from "http-errors";

export const receiptCategories = [
  "food",
  "beverages",
  "household",
  "hygiene",
  "other",
] as const;
type Category = (typeof receiptCategories)[number];
type ReceiptItem = {
  name: string;
  price: number | null;
  quantity: number | null;
  category: Category;
  discount: number | null;
  total: number | null;
};
export type ParsedReceipt = {
  status: "success" | "partial" | "error";
  fields: {
    items: ReceiptItem[];
    total: number | null;
    currency: string | null;
    date: string | null;
    categories?: Record<Category, number | null>;
  };
  debug: { ocr_quality: "good" | "medium" | "poor"; notes: string };
};

const nullableNumber = { type: ["number", "null"], minimum: 0 };
function objectSchema(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
export const receiptResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "receipt",
    strict: true,
    schema: objectSchema({
      status: { type: "string", enum: ["success", "partial", "error"] },
      fields: objectSchema({
        items: {
          type: "array",
          items: objectSchema({
            name: { type: "string" },
            price: nullableNumber,
            quantity: nullableNumber,
            category: { type: "string", enum: receiptCategories },
            discount: nullableNumber,
            total: nullableNumber,
          }),
        },
        total: nullableNumber,
        currency: { type: ["string", "null"] },
        date: { type: ["string", "null"] },
      }),
      debug: objectSchema({
        ocr_quality: { type: "string", enum: ["good", "medium", "poor"] },
        notes: { type: "string" },
      }),
    }),
  },
};

// Validate even when a provider does not support constrained JSON output.
function matchesSchema(
  value: unknown,
  schema: Record<string, unknown>,
): boolean {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const type =
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (!types.includes(type)) return false;
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
  if (type === "number")
    return Number.isFinite(value) && (value as number) >= 0;
  if (type === "array") {
    return (value as unknown[]).every(v =>
      matchesSchema(v, schema.items as Record<string, unknown>),
    );
  }
  if (type === "object") {
    const record = value as Record<string, unknown>;
    const properties = schema.properties as Record<
      string,
      Record<string, unknown>
    >;
    return (
      Object.keys(record).every(key => key in properties) &&
      Object.entries(properties).every(
        ([key, child]) =>
          Object.hasOwn(record, key) && matchesSchema(record[key], child),
      )
    );
  }
  return true;
}

export function parseReceiptResponse(content: string): ParsedReceipt {
  let value: unknown;
  try {
    value = JSON.parse(
      content.trim().replace(/^```(?:json)?\s*([\S\s]*?)\s*```$/i, "$1"),
    );
  } catch {
    throw new HttpErrors.BadGateway("Receipt model returned invalid JSON");
  }
  if (!matchesSchema(value, receiptResponseFormat.json_schema.schema)) {
    throw new HttpErrors.BadGateway(
      "Receipt model returned an invalid receipt structure",
    );
  }
  const result = value as ParsedReceipt;
  const { fields } = result;
  const issues: string[] = [];
  if (fields.date !== null) {
    const date = new Date(`${fields.date}Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fields.date) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 19) !== fields.date
    ) {
      fields.date = null;
      issues.push("Invalid receipt date");
    }
  }
  if (fields.currency !== null && !/^[A-Z]{3}$/.test(fields.currency)) {
    fields.currency = null;
    issues.push("Invalid currency code");
  }
  for (const item of fields.items) {
    if (!item.name.trim() || item.quantity === 0) {
      throw new HttpErrors.BadGateway("Receipt model returned an invalid item");
    }
    // A null discount is unknown, so it cannot be assumed to be zero.
    if (
      item.price !== null &&
      item.quantity !== null &&
      item.discount !== null &&
      item.total !== null &&
      Math.abs(item.price * item.quantity - item.discount - item.total) > 0.02
    ) {
      issues.push(`Price/quantity/discount mismatch: ${item.name}`);
    }
  }
  fields.categories = Object.fromEntries(
    receiptCategories.map(category => {
      const items = fields.items.filter(item => item.category === category);
      const total = items.some(item => item.total === null)
        ? null
        : items.reduce((sum, item) => sum + Math.round(item.total! * 100), 0) /
          100;
      return [category, total];
    }),
  ) as Record<Category, number | null>;
  if (
    fields.items.length &&
    fields.total !== null &&
    fields.items.every(item => item.total !== null)
  ) {
    const sum =
      fields.items.reduce(
        (total, item) => total + Math.round(item.total! * 100),
        0,
      ) / 100;
    if (Math.abs(sum - fields.total) > 0.02)
      issues.push("Item totals do not match the receipt total");
  }
  if (
    !fields.items.length ||
    fields.total === null ||
    fields.currency === null ||
    fields.date === null ||
    fields.items.some(item => Object.values(item).includes(null))
  ) {
    issues.push("Some receipt fields could not be extracted");
  }
  if (issues.length) {
    if (result.status === "success") result.status = "partial";
    result.debug.notes = [result.debug.notes, ...issues]
      .filter(Boolean)
      .join("; ");
  }
  return result;
}
