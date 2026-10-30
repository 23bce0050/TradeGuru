# TradeGuru – Backend (Day 1)

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

## Folder structure

```
server/
├── index.js              # entry: env check, DB connect, server start
├── app.js                # express app + routes + error handler
├── config/db.js          # MongoDB connection
├── models/User.js        # user + password hashing
├── middleware/auth.js    # JWT protect middleware
├── routes/auth.js        # signup / login / me
├── routes/stocks.js      # search / quote / chart
└── services/priceService.js  # yahoo-finance2 + caching
```

## Notes
- Prices `yahoo-finance2` (free, unofficial) se aate hain, thoda delay ho sakta hai. Isliye har price 30 sec cache hota hai.
- Market band ho (weekend/raat) toh last closing price aayega; `marketState` field batata hai.

## Next: Day 2
Holding + Trade models, Buy/Sell APIs, Portfolio + P&L.
