import { GoogleGenAI } from '@google/genai';
import { config } from '../../config/index.js';
import { get } from '../../db/index.js';

let ai: GoogleGenAI | null = null;

if (config.geminiApiKey && !config.geminiApiKey.includes('your_')) {
  try {
    ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    console.log('[AI] Gemini initialized');
  } catch (e) {
    console.log('[AI] Failed to init Gemini, falling back to mock mode');
  }
} else {
  console.log('[AI] No API key found, using mock mode');
}

export async function generateAI(prompt: string, systemPrompt?: string): Promise<string> {
  if (!ai) return await generateMock(prompt);
  try {
    const contents = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });
    return response.text || '';
  } catch (err: any) {
    console.error('[AI] Gemini error:', err.message);
    if (err.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      return generateAI(prompt, systemPrompt);
    }
    return await generateMock(prompt);
  }
}

export async function generateAIJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
  const raw = await generateAI(prompt, systemPrompt);
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    const firstBrace = jsonStr.indexOf('{');
    const firstBracket = jsonStr.indexOf('[');
    let extracted = jsonStr;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      extracted = jsonStr.match(/\{[\s\S]*\}/)?.[0] || jsonStr;
    } else if (firstBracket !== -1) {
      extracted = jsonStr.match(/\[[\s\S]*\]/)?.[0] || jsonStr;
    }
    return JSON.parse(extracted) as T;
  } catch (e) {
    console.error('[AI] Failed to parse JSON from:', raw.substring(0, 200));
    return JSON.parse(raw) as T;
  }
}

async function generateMock(prompt: string): Promise<string> {
  const p = prompt.toLowerCase();
  
  if (p.includes('generate 4 proactive insights')) {
    const repeatRate = get<{r:number}>("SELECT ROUND(CAST(SUM(CASE WHEN order_frequency > 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100) as r FROM customers")?.r || 24;
    const dormantVips = get<{c:number}>("SELECT COUNT(*) as c FROM customers WHERE persona = 'High Lifetime VIP' AND julianday('now') - julianday(last_purchase) > 30")?.c || 127;
    const topCategory = get<{category:string}>("SELECT category FROM orders GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1")?.category || 'Ethnic Wear';
    const weekendBuyers = get<{c:number}>("SELECT COUNT(*) as c FROM customers WHERE persona = 'Weekend Coffee Lover'")?.c || 89;

    return JSON.stringify([
      { id: '1', type: 'warning', title: 'Repeat Purchase Rate Need Attention', description: `Your current repeat customer rate is ${repeatRate}%. Additionally, ${dormantVips} VIP customers haven't purchased in over 30 days.`, value: `${repeatRate}%`, confidence: 0.89, action: 'investigate', actionLabel: 'Investigate' },
      { id: '2', type: 'opportunity', title: `${topCategory} Trend Opportunity`, description: `Based on your recent order data, ${topCategory} is your most popular category. We predict a 3.2x higher conversion rate for campaigns focused on this.`, value: `High ROI`, confidence: 0.84, action: 'generate_strategy', actionLabel: 'Generate Strategy' },
      { id: '3', type: 'success', title: 'WhatsApp Outperforming SMS', description: 'Your WhatsApp deliveries have historically outperformed SMS by 23% in conversion for the "High Lifetime VIP" segment.', value: '+23%', confidence: 0.91, action: 'explain', actionLabel: 'Explain Why' },
      { id: '4', type: 'info', title: 'Weekend Segment Active', description: `AI identified ${weekendBuyers} customers in the "Weekend Coffee Lover" segment who primarily purchase on weekends.`, value: `${weekendBuyers} customers`, confidence: 0.76, action: 'launch_campaign', actionLabel: 'Launch Campaign' },
    ]);
  }
  
  if (p.includes('converts natural language audience descriptions into sql where clauses')) {
    // Generate a pseudo-dynamic response based on words in the query
    let conditions = [];
    let sqlConditions = [];
    let size = 127;
    
    if (p.includes('vip') || p.includes('high')) {
      conditions.push('high engagement (>80)');
      sqlConditions.push('engagement_score > 80');
      size = 45;
    }
    if (p.includes('recent') || p.includes('last 30')) {
      conditions.push('purchased recently (<30 days)');
      sqlConditions.push("julianday('now') - julianday(last_purchase) <= 30");
      size = 210;
    } else if (p.includes('dormant') || p.includes('haven')) {
      conditions.push('inactive (>90 days)');
      sqlConditions.push("julianday('now') - julianday(last_purchase) > 90");
      size = 89;
    }
    if (p.includes('spend') || p.includes('spent') || p.includes('value')) {
      conditions.push('high spend (>₹5000)');
      sqlConditions.push("total_spend > 5000");
      size = Math.floor(size * 0.4);
    }
    
    if (conditions.length === 0) {
      conditions = ['default segmentation'];
      sqlConditions = ['total_spend > 0'];
      size = 500;
    }

    return JSON.stringify({
      reasoning: `Based on your request, I identified these key criteria: ${conditions.join(', ')}. I've translated this into the corresponding database query.`,
      logic: { conditions },
      estimatedSize: size,
      expectedConversion: 0.12,
      risk: 'low',
      sql: sqlConditions.join(' AND ')
    });
  }
  
  if (p.includes('provide a comprehensive strategy response as json')) {
    const repeatRate = get<{r:number}>("SELECT ROUND(CAST(SUM(CASE WHEN order_frequency > 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100) as r FROM customers")?.r || 24;
    const topCategory = get<{category:string}>("SELECT category FROM orders GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1")?.category || 'Ethnic Wear';
    
    return JSON.stringify({
      analysis: `Your repeat purchase rate is ${repeatRate}%, which presents an opportunity for optimization. The data indicates that cross-selling complementary items for your top category (${topCategory}) could drive immediate growth.`,
      problems: [`Below optimal repeat purchase rate (${repeatRate}%)`, 'No automated post-purchase engagement flow', `Dormant segment for ${topCategory} growing month-over-month`],
      recommendations: [
        { title: 'Launch 14-Day Re-engagement Flow', description: `Automated WhatsApp sequence targeting customers at day 14 and 30 post-purchase with personalized ${topCategory} recommendations.`, estimatedImpact: '+8% repeat rate', confidence: 0.82 },
        { title: 'VIP Exclusive Early Access', description: 'Give VIP customers 24-hour early access to new collections. Creates urgency and reinforces exclusivity.', estimatedImpact: '+12% VIP retention', confidence: 0.78 },
        { title: 'Category Cross-sell Campaign', description: `Target single-category buyers with complementary category offers based on their purchase history.`, estimatedImpact: '+₹4.2L revenue', confidence: 0.74 }
      ],
      chartData: [
        { month: 'Jan', rate: repeatRate - 4 }, { month: 'Feb', rate: repeatRate - 2 }, { month: 'Mar', rate: repeatRate - 3 },
        { month: 'Apr', rate: repeatRate }, { month: 'May', rate: repeatRate - 2 }, { month: 'Jun', rate: repeatRate }
      ]
    });
  }
  
  if (p.includes('generate 3 message variants')) {
    const topCategory = get<{category:string}>("SELECT category FROM orders GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1")?.category || 'clothing';
    
    return JSON.stringify({
      variants: [
        { id: '1', message: `✨ Hey {name}! We noticed you loved our ${topCategory} collection. Here's an exclusive 20% off just for you — valid 48 hours only! Shop now 👉`, predictedCtr: 0.28, tone: 'friendly', rank: 1 },
        { id: '2', message: `Dear {name}, As a valued customer, you're invited to an exclusive preview of our new ${topCategory} arrivals with a personal 20% discount. Limited availability.`, predictedCtr: 0.22, tone: 'luxury', rank: 2 },
        { id: '3', message: `🔥 {name}, your favorites are back in stock! Grab ${topCategory} essentials at 20% OFF before they're gone. Tap to shop →`, predictedCtr: 0.31, tone: 'urgent', rank: 3 },
      ],
      reasoning: 'Variant 3 predicted highest CTR due to urgency language and emoji usage which historically performs 15% better in the 18-34 demographic. Variant 2 better suited for VIP segment (35+).',
      bestChannel: 'whatsapp',
      bestTime: '10:00 AM IST'
    });
  }
  
  if (p.includes('analyze this marketing campaign')) {
    return JSON.stringify({
      summary: 'Campaign achieved 12.4% conversion rate, exceeding the predicted 8% by 55%. WhatsApp channel drove 78% of conversions.',
      successFactors: ['Personalized messaging with customer name', 'Optimal send time (10 AM)', 'Festival timing alignment'],
      failureFactors: ['Email channel had only 3% open rate', '12% of messages failed delivery in Tier-2 cities'],
      predictedImprovement: 'Increasing discount from 15% to 20% could improve conversion by additional 4%, but would reduce margin by ₹1.2L.',
      nextAction: 'Run A/B test with 20% discount on a 100-customer subset before full rollout.'
    });
  }
  
  if (p.includes('revenue optimizer')) {
    const dormantHighValue = get<{c:number}>("SELECT COUNT(*) as c FROM customers WHERE predicted_churn > 0.5 AND predicted_clv > 20000")?.c || 42;
    const topCategory = get<{category:string}>("SELECT category FROM orders GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1")?.category || 'Ethnic Wear';
    return JSON.stringify({
      opportunities: [
        { title: `${topCategory} VIP Re-engagement`, description: `Target ${dormantHighValue} VIPs who haven't purchased ${topCategory} recently but have high predicted CLV.`, estimatedRevenue: `₹${Math.round(dormantHighValue * 2.5)}L`, confidence: 0.88, segment: "Dormant VIPs", action: "Launch Campaign" },
        { title: "Abandoned Cart Reactivation", description: "Target customers who abandoned carts in the last 24h", estimatedRevenue: "₹4.8L", confidence: 0.76, segment: "Abandoned Carts", action: "Generate Strategy" }
      ]
    });
  }

  if (p.includes('explain this ai decision')) {
    return JSON.stringify({
      explanation: 'The AI analyzed the past 30 days of campaign data and found that WhatsApp messages sent before 11 AM achieved a 45% higher open rate compared to afternoon sends. Combined with the "Friendly" tone which performs best for the target segment, this strategy maximizes predicted ROI.'
    });
  }

  return JSON.stringify({ message: 'AI analysis complete. The data shows promising trends with actionable insights for your growth strategy.', confidence: 0.8 });
}
