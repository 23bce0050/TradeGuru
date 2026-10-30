# TradeGuru – Backend

Paper trading platform: ₹10 lakh virtual money, real NSE prices.

## Setup

1. **MongoDB Atlas** (free): https://www.mongodb.com/atlas → free cluster banao → Database user banao → Network Access mein `0.0.0.0/0` allow karo → "Connect → Drivers" se connection string copy karo.
2. `.env.example` ko copy karke `.env` banao aur values bharo:
   ```
   PORT=5000
   MONGO_URI=mongodb+srv://...../tradeguru
   JWT_SECRET=koi-lamba-random-string
   CLIENT_URL=http://localhost:5173
   ```
3. Chalao:
   ```bash
   npm install
   npm run dev
   ```
   Terminal mein `✅ MongoDB connected` aur `🚀 TradeGuru API running` dikhna chahiye.

## APIs (Day 1)

| Method | Route | Auth | Kaam |
|---|---|---|---|
| GET | `/api/health` | – | Server zinda hai ya nahi |
| POST | `/api/auth/signup` | – | `{ name, email, password }` → token + user (₹10L balance) |
| POST | `/api/auth/login` | – | `{ email, password }` → token + user |
| GET | `/api/auth/me` | ✅ | Logged-in user + balance |
| GET | `/api/stocks/search?q=tata` | – | NSE/BSE stocks search |
| GET | `/api/stocks/RELIANCE/quote` | – | Live price (30 sec cache) |
| GET | `/api/stocks/TCS/chart?range=1m` | – | Chart data (`1w,1m,3m,6m,1y`) |

Auth wale routes mein header bhejo: `Authorization: Bearer <token>`

Symbol bina suffix ke do toh NSE maana jayega (`RELIANCE` → `RELIANCE.NS`). BSE ke liye `RELIANCE.BO`.

## Test (Postman ya terminal)

```bash
curl http://localhost:5000/api/health

curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Harsh","email":"harsh@test.com","password":"123456"}'

curl "http://localhost:5000/api/stocks/search?q=reliance"
curl http://localhost:5000/api/stocks/RELIANCE/quote
curl "http://localhost:5000/api/stocks/TCS/chart?range=1m"
```

## APIs (Day 2) – sab mein login token chahiye

| Method | Route | Body | Kaam |
|---|---|---|---|
| POST | `/api/trade/buy` | `{ "symbol": "TCS", "quantity": 10 }` | Live price par khareedo |
| POST | `/api/trade/sell` | `{ "symbol": "TCS", "quantity": 4 }` | Becho + realized P&L |
| GET | `/api/trade/history?limit=50&symbol=TCS` | – | Saare trades |
| GET | `/api/portfolio` | – | Holdings, live P&L, net worth |
| POST | `/api/portfolio/reset` | – | Sab saaf, wapas ₹10 lakh |

### Day 2 test (ek command)
Server chalu rakho, doosre terminal mein:
```bash
npm run test:day2
```
Ye naya user banake buy → sell → portfolio → history sab check karta hai.

### Hisaab kaise hota hai
- **Avg price** = total invested ÷ quantity (har buy par update)
- **Realized P&L** (sell par) = (sell price − avg price) × qty
- **Unrealized P&L** = (live price − avg price) × qty
- **Net worth** = cash + holdings ki live value
- Balance atomic tareeke se katta hai, toh ek saath do buy request aayein tab bhi balance minus mein nahi jayega.

## APIs (Day 4) – login chahiye

| Method | Route | Kaam |
|---|---|---|
| GET | `/api/coach` | Trading Coach report: discipline score, galtiyan + saboot + advice |
| GET | `/api/leaderboard` | Top 20 traders by total value (naam: "Harsh G.") |

### Coach kya pakadta hai (`services/coachRules.js`)
| Habit | Rule |
|---|---|
| Panic selling | Loss mein becha, us din stock 2%+ gira tha, ya khareedne ke 3 din ke andar |
| FOMO buying | Us din stock 3%+ chadha tha, ya pichhle 5 trading days mein 8%+ |
| Overtrading | Ek din mein 8+ trades |
| Holding losers | Koi holding 10%+ loss mein |
| Selling winners early | 2 din mein 3% se kam profit book kiya, phir stock 5%+ aur chadha |
| Concentration | Ek stock total paise ka 40%+ |

Score 100 se shuru hota hai, har habit par points katte hain (har habit ki max limit). Thresholds `RULES` object mein hain.
Har finding ke saath **evidence** aata hai (kaunsa trade, kis din, abhi price kya hai), sirf generic gyaan nahi.

### Unit tests
```bash
npm test
```
P&L hisaab, coach ke rules aur news parsing ke tests (12 tests).

## News + AI sentiment

| Method | Route | Kaam |
|---|---|---|
| GET | `/api/news?category=markets` | Aaj ki headlines: `markets`, `fintech`, `technology`, `economy` |
| GET | `/api/news/stock/TCS` | Ek company ki latest news |
| GET | `/api/news/categories` | Categories + AI model status |

- **Source:** Google News RSS (free, koi API key nahi). Pehle 1 din ki news, kam ho toh 3 din. 30 min cache.
- Sirf headline, source, time aur link dikhate hain; poora article publisher ki site par khulta hai.
- **AI:** har headline ko **FinBERT** (`Xenova/finbert`, Transformers.js) positive / neutral / negative tag karta hai. Model server par hi chalta hai (pehli baar ~110 MB download, phir cache).
- Model load na ho toh news bina sentiment ke dikhti hai (app nahi rukta). Band karna ho toh `.env` mein `SENTIMENT=off`.

## Zyada users ke liye (scaling)

| Kya | Kyun |
|---|---|
| Rate limit: 300 req/min per user, 30 orders/min, 20 login/15 min per IP | Koi ek user server flood na kare, password guessing ruke |
| Leaderboard 60 sec cache + coalescing | 1000 users ek saath kholein, calculation sirf 1 baar |
| Price cache + request coalescing | Yahoo calls users ke hisaab se nahi, stocks ke hisaab se |
| gzip compression | Kam data, tez load |
| DB indexes (trades: userId+createdAt, userId+type) | History aur P&L queries fast |
| MongoDB pool (`DB_POOL_SIZE`, default 20) | Atlas connection limit ke andar |
| Frontend: tab chhupa ho toh refresh band | Bekaar requests kam |

### Load test
```bash
# server/.env mein RATE_LIMIT=off, phir server restart
npm run loadtest      # 10 se 500 simultaneous connections, req/s aur p50/p90/p99 latency
```
Settings: `TEST_USERS=50 STAGES=10,50,100,250,500 SECONDS=15` (env vars). Test ke baad `RATE_LIMIT=off` hata dena.

## Folder structure

```
server/
├── index.js              # entry: env check, DB connect, server start
├── app.js                # express app + routes + error handler
├── config/db.js          # MongoDB connection
├── models/User.js        # user + password hashing
├── models/Holding.js     # user ke shares
├── models/Trade.js       # har buy/sell ka record
├── middleware/auth.js    # JWT protect middleware
├── routes/auth.js        # signup / login / me
├── routes/stocks.js      # search / quote / chart
├── routes/trade.js       # buy / sell / history
├── routes/portfolio.js   # portfolio + reset
├── routes/coach.js       # trading coach report
├── routes/leaderboard.js # top traders
├── routes/news.js        # news + stock news
├── services/portfolioMath.js # P&L ka hisaab
├── services/portfolioService.js # live prices ke saath portfolio
├── services/coachRules.js # coach ke rules (pure, tested)
├── services/newsService.js # Google News RSS + cache
├── services/sentimentService.js # FinBERT AI sentiment
├── tests/                # unit tests (npm test)
├── scripts/test-day2.js  # end-to-end test
└── services/priceService.js  # yahoo-finance2 + caching
```

## Notes
- Prices `yahoo-finance2` (free, unofficial) se aate hain, thoda delay ho sakta hai. Isliye har price 30 sec cache hota hai.
- Market band ho (weekend/raat) toh last closing price aayega; `marketState` field batata hai.

## Next: Day 5
Deploy (Render + Vercel), README polish, screenshots, resume line.
