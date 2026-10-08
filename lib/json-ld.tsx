import { jsonLdString } from "@/lib/seo";

/** 構造化データ(schema.org)をページに埋め込む */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
