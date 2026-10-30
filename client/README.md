# TradeGuru – Frontend (Day 3)

React + Vite app for the TradeGuru paper trading API.

## Chalane ke steps

Backend (`server` folder) pehle se chalu hona chahiye (`npm run dev`, port 5000).

```bash
cd client
npm install
npm run dev
```

Browser mein **http://localhost:5173** kholo.

Backend kisi aur address par ho (jaise deploy ke baad), toh `.env.example` copy karke `.env` banao aur `VITE_API_URL` badlo.

## Pages

| Route | Kya hai |
|---|---|
| `/login` | Log in / Create account |
| `/` | Portfolio: net worth, return vs ₹10 lakh, holdings with live P&L, reset |
| `/stock/:symbol` | Live price, chart (1W–1Y), Buy/Sell ticket, your position |
| `/history` | Saare trades + booked P&L |

## Folder structure

```
src/
├── main.jsx            # router + auth provider
├── App.jsx             # routes, login guard
├── api.js              # axios + token + error text
├── auth.jsx            # login/signup/logout context
├── format.js           # ₹ Indian format, %, colors
├── index.css           # saari styling
├── components/
│   ├── Navbar.jsx
│   ├── StockSearch.jsx # debounced search, keyboard support
│   ├── PriceChart.jsx  # Recharts area chart
│   └── OrderTicket.jsx # buy/sell form with checks
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx
    ├── Stock.jsx
    └── History.jsx
```
