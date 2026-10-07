import { redirect } from "next/navigation";

// Old bookmarks now lead to the matching rules within the terms.
export default function RetiredMatchingGuidePage() {
 redirect("/terms#dealer-matching");
}
