import { Fragment } from "react";
import { nameParts, nameWidth } from "@/lib/name-layout";

/** Shared by PC and mobile. Never abbreviate a registered store/event name. */
export function ReadableName({ name }: { name: string }) {
  const parts = nameParts(name);
  return <span className="readable-name">{parts.map((part, i) => /\s/.test(part)
    ? <Fragment key={i}>{part}</Fragment>
    : <Fragment key={i}>{i > 0 && !/\s$/.test(parts[i - 1]) && <wbr />}<span className="name-word" style={{ fontSize: `min(1em, ${98 / Math.max(nameWidth(part), 1)}cqi)` }}>{part}</span></Fragment>
  )}</span>;
}
