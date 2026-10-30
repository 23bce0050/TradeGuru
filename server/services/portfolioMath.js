// Paise ka saara hisaab yahan. Pure functions, taaki test karna aasaan ho.

import { STARTING_BALANCE } from "../models/User.js";

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Buy ke baad naya holding
export function applyBuy(holding, qty, price) {
  const quantity = (holding?.quantity || 0) + qty;
  const invested = round2((holding?.invested || 0) + qty * price);
  return { quantity, invested, avgPrice: round2(invested / quantity) };
}

// Sell ke baad naya holding + kitna profit/loss book hua
export function applySell(holding, qty, price) {
  if (!holding || holding.quantity < qty) throw new Error("Itne shares nahi hain");
  const avgPrice = holding.invested / holding.quantity;
  const costOfSold = qty * avgPrice;
  const quantity = holding.quantity - qty;
  const invested = quantity === 0 ? 0 : round2(holding.invested - costOfSold);
  return {
    quantity,
    invested,
    avgPrice: round2(avgPrice),
    realizedPnl: round2(qty * price - costOfSold),
  };
}

// Ek holding ki live value aur unrealized P&L
export function valueHolding(holding, livePrice) {
  const currentValue = round2(holding.quantity * livePrice);
  const pnl = round2(currentValue - holding.invested);
  return {
    symbol: holding.symbol,
    name: holding.name,
    quantity: holding.quantity,
    avgPrice: round2(holding.invested / holding.quantity),
    invested: round2(holding.invested),
    livePrice: round2(livePrice),
    currentValue,
    pnl,
    pnlPercent: holding.invested ? round2((pnl / holding.invested) * 100) : 0,
  };
}

// Poore portfolio ka summary
export function summarize(cash, valuedHoldings, realizedPnl = 0) {
  const invested = round2(valuedHoldings.reduce((s, h) => s + h.invested, 0));
  const currentValue = round2(valuedHoldings.reduce((s, h) => s + h.currentValue, 0));
  const unrealizedPnl = round2(currentValue - invested);
  const netWorth = round2(cash + currentValue);
  const totalReturn = round2(netWorth - STARTING_BALANCE);
  return {
    cash: round2(cash),
    invested,
    currentValue,
    unrealizedPnl,
    unrealizedPnlPercent: invested ? round2((unrealizedPnl / invested) * 100) : 0,
    realizedPnl: round2(realizedPnl),
    netWorth,
    totalReturn,
    totalReturnPercent: round2((totalReturn / STARTING_BALANCE) * 100),
  };
}
