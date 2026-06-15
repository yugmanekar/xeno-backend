import { v4 as uuid } from 'uuid';
import { run, count } from './index.js';

const FIRST_NAMES_M = ['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan','Rohan','Rahul','Karan','Nikhil','Amit','Vikram','Pranav','Dhruv','Manish','Sahil','Raj','Akash','Yash','Harsh','Deepak'];
const FIRST_NAMES_F = ['Ananya','Diya','Myra','Sara','Aanya','Aadhya','Priya','Isha','Kavya','Riya','Sneha','Pooja','Neha','Meera','Tanvi','Nisha','Shreya','Anjali','Simran','Divya','Kritika','Aditi','Swati','Juhi','Pallavi'];
const LAST_NAMES = ['Sharma','Patel','Gupta','Singh','Kumar','Agarwal','Joshi','Verma','Mehta','Shah','Reddy','Nair','Iyer','Das','Chatterjee','Banerjee','Pillai','Bhat','Kulkarni','Deshmukh','Rao','Malhotra','Kapoor','Saxena','Tiwari'];
const CITIES = ['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Pune','Kolkata','Jaipur','Ahmedabad','Lucknow','Chandigarh','Kochi','Indore','Bhopal','Nagpur','Coimbatore','Vadodara','Surat','Gurgaon','Noida'];
const CHANNELS = ['whatsapp','sms','email','push'];
const CATEGORIES = ['Menswear','Womenswear','Kidswear','Activewear','Winterwear','Ethnic Wear','Accessories','Footwear'];
const PRODUCTS: Record<string, string[]> = {
  'Menswear': ['Cotton Linen Shirt','Slim Fit Chinos','Denim Jacket','Polo T-Shirt','Formal Trousers','Oversized Graphic Tee'],
  'Womenswear': ['Floral Maxi Dress','High-Waist Jeans','Silk Blouse','Pleated Skirt','Crop Top','Tailored Blazer'],
  'Kidswear': ['Cartoon Print T-Shirt','Denim Dungarees','Party Dress','Cotton Shorts','School Uniform Set'],
  'Activewear': ['Yoga Leggings','Sports Bra','Moisture Wicking Tee','Track Pants','Running Shorts'],
  'Winterwear': ['Cashmere Sweater','Trench Coat','Puffer Jacket','Woolen Cardigan','Thermal Innerwear'],
  'Ethnic Wear': ['Embroidered Kurta','Silk Saree','Bridal Lehenga','Sherwani','Cotton Anarkali'],
  'Accessories': ['Leather Belt','Silk Tie','Aviator Sunglasses','Crossbody Sling','Silver Hoop Earrings','Canvas Tote'],
  'Footwear': ['White Sneakers','Leather Loafers','Ankle Boots','Strappy Heels','Running Shoes','Kolhapuris'],
};
const PAYMENT_METHODS = ['UPI','Credit Card','Debit Card','COD','Wallet'];
const PERSONAS = ['Weekend Coffee Lover','Luxury Fashion Enthusiast','Budget Student','Festival Shopper','Returning Parent','Impulse Buyer','High Lifetime VIP','Dormant Risk'];
const PREFERENCES_POOL = ['Ethnic Wear','Western Wear','Streetwear','Minimalist','Luxury','Sustainable','Athleisure','Vintage','Bohemian','Formal','Casual','Festive','Sporty','Tech','Organic','Handcrafted'];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function normalRand(mean: number, stddev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.round(num * stddev + mean);
}

function generatePhone(): string {
  const prefixes = ['98','97','96','95','94','93','91','90','88','87','86','85','84','83','82','81','80','79','78','77','76','75','74','73','72','71','70'];
  return `+91${pick(prefixes)}${rand(10000000, 99999999)}`;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function randomDate(daysAgoMin: number, daysAgoMax: number): string {
  const days = rand(daysAgoMin, daysAgoMax);
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(rand(6, 23), rand(0, 59), rand(0, 59));
  return d.toISOString();
}

export async function seedDatabase(): Promise<void> {
  const existing = count('customers');
  if (existing > 0) {
    console.log(`[SEED] Database already has ${existing} customers, skipping seed`);
    return;
  }

  console.log('[SEED] Generating synthetic data for fashion brand demo...');
  const startTime = Date.now();

  // Generate 500 customers
  const customers: any[] = [];
  for (let i = 0; i < 500; i++) {
    const isMale = Math.random() > 0.48;
    const firstName = isMale ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
    const lastName = pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const age = Math.max(18, Math.min(65, normalRand(32, 10)));
    const city = pick(CITIES);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand(1, 999)}@${pick(['gmail.com','yahoo.co.in','outlook.com','hotmail.com'])}`;
    const phone = generatePhone();
    const preferences = JSON.stringify(pickN(PREFERENCES_POOL, rand(2, 5)));
    const persona = pick(PERSONAS);

    // Correlate stats with persona
    let totalSpend: number, orderFreq: number, engagement: number, churn: number;
    switch (persona) {
      case 'High Lifetime VIP':
        totalSpend = randFloat(50000, 200000); orderFreq = rand(15, 50); engagement = randFloat(75, 100); churn = randFloat(0.01, 0.15);
        break;
      case 'Luxury Fashion Enthusiast':
        totalSpend = randFloat(30000, 120000); orderFreq = rand(8, 25); engagement = randFloat(60, 90); churn = randFloat(0.05, 0.25);
        break;
      case 'Festival Shopper':
        totalSpend = randFloat(10000, 50000); orderFreq = rand(3, 10); engagement = randFloat(40, 70); churn = randFloat(0.2, 0.5);
        break;
      case 'Impulse Buyer':
        totalSpend = randFloat(8000, 40000); orderFreq = rand(5, 20); engagement = randFloat(50, 80); churn = randFloat(0.15, 0.4);
        break;
      case 'Returning Parent':
        totalSpend = randFloat(15000, 60000); orderFreq = rand(6, 18); engagement = randFloat(55, 85); churn = randFloat(0.1, 0.3);
        break;
      case 'Weekend Coffee Lover':
        totalSpend = randFloat(5000, 25000); orderFreq = rand(4, 15); engagement = randFloat(45, 75); churn = randFloat(0.15, 0.35);
        break;
      case 'Budget Student':
        totalSpend = randFloat(2000, 12000); orderFreq = rand(2, 8); engagement = randFloat(30, 60); churn = randFloat(0.3, 0.6);
        break;
      case 'Dormant Risk':
        totalSpend = randFloat(1000, 15000); orderFreq = rand(1, 5); engagement = randFloat(5, 30); churn = randFloat(0.6, 0.95);
        break;
      default:
        totalSpend = randFloat(3000, 30000); orderFreq = rand(2, 12); engagement = randFloat(30, 70); churn = randFloat(0.2, 0.5);
    }

    const avgOrder = Math.round(totalSpend / Math.max(orderFreq, 1) * 100) / 100;
    const lastPurchaseDays = persona === 'Dormant Risk' ? rand(60, 180) : persona === 'High Lifetime VIP' ? rand(1, 14) : rand(1, 90);
    const lastPurchase = daysAgo(lastPurchaseDays);
    const predictedClv = Math.round(totalSpend * randFloat(1.5, 4));
    const favChannel = pick(CHANNELS);
    const favCategory = pick(CATEGORIES);
    const id = uuid();

    customers.push({ id, name, email, phone, location: city, gender: isMale ? 'Male' : 'Female', age, preferences, totalSpend, avgOrder, orderFreq, lastPurchase, engagement, churn, predictedClv, favChannel, favCategory, persona });

    run(
      `INSERT INTO customers (id, name, email, phone, location, gender, age, preferences, total_spend, avg_order, order_frequency, last_purchase, engagement_score, predicted_churn, predicted_clv, favorite_channel, favorite_category, persona, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, name, email, phone, city, isMale ? 'Male' : 'Female', age, preferences, totalSpend, avgOrder, orderFreq, lastPurchase, engagement, churn, predictedClv, favChannel, favCategory, persona, randomDate(30, 365)]
    );
  }

  console.log(`[SEED] Created 500 customers`);

  // Generate orders for each customer
  let orderCount = 0;
  for (const c of customers) {
    const numOrders = Math.max(1, c.orderFreq + rand(-2, 2));
    for (let j = 0; j < numOrders; j++) {
      const category = Math.random() > 0.4 ? c.favCategory : pick(CATEGORIES);
      const product = pick(PRODUCTS[category] || PRODUCTS['Clothing']);
      const amount = category === 'Winterwear' ? randFloat(2000, 12000) :
                     category === 'Ethnic Wear' ? randFloat(1500, 25000) :
                     category === 'Footwear' ? randFloat(1000, 8000) :
                     category === 'Accessories' ? randFloat(500, 4000) :
                     randFloat(800, 6000);
      const discount = Math.random() > 0.6 ? randFloat(5, 30) : 0;
      const paymentMethod = pick(PAYMENT_METHODS);
      const timestamp = randomDate(1, 365);

      run(
        `INSERT INTO orders (id, customer_id, product, category, amount, discount, payment_method, location, timestamp) VALUES (?,?,?,?,?,?,?,?,?)`,
        [uuid(), c.id, product, category, amount, discount, paymentMethod, c.location, timestamp]
      );
      orderCount++;
    }
  }

  console.log(`[SEED] Created ${orderCount} orders`);

  // Seed initial AI memories
  const memories = [
    { type: 'insight', title: 'High-value customers prefer WhatsApp', content: 'Analysis shows that customers with CLV > ₹50,000 have 3.2x higher engagement rate on WhatsApp compared to email. Consider prioritizing WhatsApp for VIP communications.', confidence: 0.87, source: 'Customer analysis', impact: 'high' },
    { type: 'strategy', title: 'Festival seasons drive 40% of annual revenue', content: 'Historical data reveals that Diwali, Dussehra, and Eid periods account for approximately 40% of total annual revenue. Pre-festival campaigns launched 2 weeks early show 28% better conversion.', confidence: 0.92, source: 'Revenue analysis', impact: 'high' },
    { type: 'channel_performance', title: 'SMS has highest open rate for flash sales', content: 'Flash sale notifications via SMS achieve 94% open rate within 15 minutes, compared to 67% for push and 23% for email. However, email drives higher average order value.', confidence: 0.85, source: 'Campaign analysis', impact: 'medium' },
    { type: 'insight', title: 'Dormant customers respond to personalized discounts', content: 'Customers inactive for 60+ days show 18% reactivation rate when offered personalized discounts of 15-20% on their favorite category. Generic discounts only achieve 4% reactivation.', confidence: 0.79, source: 'Reactivation campaign', impact: 'high' },
  ];

  for (const m of memories) {
    run(
      `INSERT INTO ai_memory (id, type, title, content, confidence, source, impact, tags, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [uuid(), m.type, m.title, m.content, m.confidence, m.source, m.impact, '[]', randomDate(1, 30)]
    );
  }

  console.log(`[SEED] Created ${memories.length} AI memories`);

  // Seed some events
  const events = [
    { type: 'system', title: 'Workspace initialized', description: 'Xeno Growth Engine workspace created with 500 customers and order history.' },
    { type: 'ai_decision', title: 'AI personas generated', description: 'Identified 8 distinct customer personas based on purchasing behavior and engagement patterns.' },
    { type: 'insight', title: 'Churn risk detected', description: 'AI detected 127 VIP customers showing dormancy patterns. Recommended immediate re-engagement campaign.' },
  ];

  for (const e of events) {
    run(
      `INSERT INTO events (id, type, title, description, metadata, created_at) VALUES (?,?,?,?,?,?)`,
      [uuid(), e.type, e.title, e.description, '{}', randomDate(0, 7)]
    );
  }

  console.log(`[SEED] Created ${events.length} events`);
  console.log(`[SEED] Complete in ${Date.now() - startTime}ms`);
}
