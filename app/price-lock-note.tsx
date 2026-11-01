"use client";

import { useEffect, useState } from "react";

// 「年内のご契約で料金据え置き」の一言(2026/10/20)。締切を過ぎたら、ページが作り置きのままでも見えなくする。
// 特典がOFFの間・締切後は、サーバー側でもそもそも出さない(lib/price-lock-campaign.ts の accepting)。
export function PriceLockNote({ deadlineIso, text, className }: { deadlineIso: string; text: string; className?: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    if (Date.now() > Date.parse(deadlineIso)) setShow(false);
  }, [deadlineIso]);
  if (!show) return null;
  return <span className={className}>{text}</span>;
}
