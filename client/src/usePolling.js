import { useEffect } from "react";

// Har `ms` mein fn chalao, LEKIN jab browser tab chhupa ho (doosra tab / minimize) tab nahi.
// Tab wapas aate hi turant ek baar refresh. Isse server par bekaar load bahut kam hota hai.
export default function usePolling(fn, ms) {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") fn();
    };
    const t = setInterval(tick, ms);
    const onVisible = () => document.visibilityState === "visible" && fn();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fn, ms]);
}
