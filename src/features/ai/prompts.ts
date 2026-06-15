export function insightsPrompt(metrics: any): string {
  return `You are an AI marketing strategist for a fashion brand CRM called Xeno. Analyze the following business metrics and generate 4 proactive insights.

Business Metrics:
${JSON.stringify(metrics, null, 2)}

Return a JSON array of exactly 4 insights. Each insight must have:
- id (string)
- type: "warning" | "opportunity" | "success" | "info"
- title (short, impactful, max 8 words)
- description (2-3 sentences with specific numbers)
- value (the key metric, e.g. "-18%", "₹3.2L", "+23%", "89 customers")
- confidence (number 0-1)
- action: "investigate" | "generate_strategy" | "launch_campaign" | "explain"
- actionLabel (button text)

Make insights specific, data-driven, and actionable. Use Indian Rupee (₹) for currency. Be dramatic but accurate.
Return ONLY the JSON array, no other text.`;
}

export function segmentationPrompt(naturalQuery: string, schemaInfo: string): string {
  return `You are an AI that converts natural language audience descriptions into SQL WHERE clauses.

Database schema for customers table:
${schemaInfo}

User query: "${naturalQuery}"

Analyze the intent and generate a SQL WHERE clause. Return JSON:
{
  "reasoning": "Step-by-step explanation of how you interpreted the query (2-3 sentences)",
  "logic": { "conditions": ["human readable condition 1", "condition 2"] },
  "sql": "SQL WHERE clause (without the WHERE keyword)",
  "estimatedSize": estimated number of matching customers (integer),
  "expectedConversion": expected conversion rate (0-1),
  "risk": "low" | "medium" | "high"
}

Available columns: name, email, location, gender, age, total_spend, avg_order, order_frequency, last_purchase, engagement_score, predicted_churn, predicted_clv, favorite_channel, favorite_category, persona.

For date comparisons, use: julianday('now') - julianday(last_purchase) > N_DAYS

Return ONLY valid JSON.`;
}

export function strategyPrompt(metrics: any, memory: any[], question: string): string {
  return `You are a senior AI marketing strategist for a fashion brand. You have access to business data and past campaign learnings.

Current Business Metrics:
${JSON.stringify(metrics, null, 2)}

Past Learnings (AI Memory):
${JSON.stringify(memory.slice(0, 5), null, 2)}

User Question: "${question}"

Provide a comprehensive strategy response as JSON:
{
  "analysis": "2-3 sentence analysis of the current situation with specific numbers",
  "problems": ["list of identified problems"],
  "recommendations": [
    {
      "title": "Strategy name",
      "description": "Detailed description",
      "estimatedImpact": "Expected result (e.g., '+8% repeat rate')",
      "confidence": 0.82
    }
  ],
  "chartData": [
    { "month": "Jan", "rate": 28 },
    ...6 months of relevant trend data
  ]
}

Be specific, use real numbers, reference the data. Use ₹ for currency.
Return ONLY valid JSON.`;
}

export function copywriterPrompt(campaign: any, tone: string, channel: string): string {
  return `You are an expert marketing copywriter for a fashion brand in India.

Campaign details:
- Target audience: ${campaign.audienceDescription || 'General customers'}
- Channel: ${channel}
- Tone: ${tone}
- Offer: ${campaign.offer || '20% discount'}
- Goal: ${campaign.goal || 'Drive purchases'}

Generate 3 message variants. Each variant should be appropriate for ${channel}:
- WhatsApp: casual, emoji-friendly, max 160 chars
- SMS: concise, max 120 chars, include CTA
- Email: subject line + body, professional
- Push: very short, max 80 chars, attention-grabbing

Return JSON:
{
  "variants": [
    { "id": "1", "message": "the message text with {name} placeholder", "predictedCtr": 0.28, "tone": "${tone}", "rank": 1 }
  ],
  "reasoning": "Why these variants were ranked this way",
  "bestChannel": "recommended channel",
  "bestTime": "recommended send time in IST"
}

Return ONLY valid JSON.`;
}

export function campaignAnalysisPrompt(campaign: any, deliveryStats: any): string {
  return `Analyze this marketing campaign's performance:

Campaign: ${JSON.stringify(campaign, null, 2)}
Delivery Stats: ${JSON.stringify(deliveryStats, null, 2)}

Return JSON:
{
  "summary": "2-3 sentence performance summary with key metrics",
  "successFactors": ["what worked well"],
  "failureFactors": ["what didn't work"],
  "predictedImprovement": "what could improve results next time",
  "nextAction": "recommended next step"
}

Return ONLY valid JSON.`;
}

export function opportunityPrompt(metrics: any): string {
  return `You are an AI revenue optimizer. Analyze these metrics and find revenue opportunities:

${JSON.stringify(metrics, null, 2)}

Return JSON:
{
  "opportunities": [
    {
      "title": "Opportunity name",
      "description": "Detailed description",
      "estimatedRevenue": "₹X.XL",
      "confidence": 0.85,
      "segment": "target segment",
      "action": "recommended action"
    }
  ]
}

Return ONLY valid JSON.`;
}

export function personaPrompt(customerData: any[]): string {
  return `Analyze these customer clusters and generate creative persona descriptions:

Customer data summary:
${JSON.stringify(customerData.slice(0, 20), null, 2)}

For each persona type found, return JSON array:
[
  {
    "persona": "Persona Name",
    "description": "2-3 sentence vivid description of this persona",
    "behavior": "typical buying behavior",
    "buyingPattern": "when and how they shop",
    "predictedFuture": "likely future behavior",
    "communicationStyle": "how to talk to them",
    "recommendedOffers": ["offer ideas"],
    "confidence": 0.85
  }
]

Return ONLY valid JSON array.`;
}
