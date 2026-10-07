export type DealerPrivateContacts = { phone: string; contact_type: "line" | "email"; contact_value: string; disclosure_consented_at: string | null };

export function normalizeDealerPhone(value: string): string {
 return value.normalize("NFKC").trim().replace(/[\s()-]/g, "");
}
export function validDealerContacts(phone: string, kind: string, value: string, disclose: boolean): boolean {
 if (phone.length > 30 || (phone && !/^\+?[0-9]{7,15}$/.test(phone)) || !["line", "email"].includes(kind) || value.length > 254 || /\s/.test(value)) return false;
 if (value && kind === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return false;
 return !disclose || Boolean(phone && value);
}
