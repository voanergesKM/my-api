export function getRecipieScanPrompt(text: string) {
  return `You are a JSON validator and receipt parser.

Input (raw receipt text):
\`\`\`
${text}
\`\`\`

Your task:
1. Parse the receipt and extract structured data.
2. Identify the store name, date, and each purchased item.
3. Each item must include:
   - name: string (product name)
   - price: number (final price after discount if applicable)
   - category: string (one of: "food", "beverages", "household", "hygiene", "other")
   - if a discount is mentioned in the text (e.g. "-10%", "знижка", "discount"), subtract it from the price and reflect the final discounted value.
4. Calculate "categories" — a summary of total spent per category (sum of item prices grouped by category).
5. Calculate "total" — the sum of all item prices.
6. Determine the currency used in the receipt (e.g. USD, EUR, UAH) and include it in the output.
7. Format the date in **ISO 8601 format (YYYY-MM-DDTHH:mm:ss)** if possible.  
   - If time is not available, use midnight (e.g. "2025-10-19T00:00:00").
   - If date cannot be determined, set it to an empty string "".

Return ONLY valid JSON in the following structure:
{
  "store": string,
  "date": string, // in ISO 8601 format
  "items": [{ "name": string, "price": number, "category": string }],
  "categories": { [category: string]: number },
  "total": number,
  "currency": string
}

Rules:
- Return ONLY pure JSON, without markdown, explanations, or extra text.
- All numeric values must use dot as decimal separator.
- Ensure that "total" equals the sum of all item prices.`;
}
