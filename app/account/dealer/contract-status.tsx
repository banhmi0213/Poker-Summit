import type { DealerContractStatus } from "@/lib/dealers";
import styles from "./dealer.module.css";

export function DealerContractBadge({ status }: { status: DealerContractStatus }) {
 return <span className={status === "契約済み" ? styles.contracted : styles.available}>{status}</span>;
}
