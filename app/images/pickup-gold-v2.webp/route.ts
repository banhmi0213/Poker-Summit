import part0 from "@/lib/pickup-artwork/part-0";
import part1 from "@/lib/pickup-artwork/part-1";
import part2 from "@/lib/pickup-artwork/part-2";
import part3 from "@/lib/pickup-artwork/part-3";
import part4 from "@/lib/pickup-artwork/part-4";
import part5 from "@/lib/pickup-artwork/part-5";
import part6 from "@/lib/pickup-artwork/part-6";
import part7 from "@/lib/pickup-artwork/part-7";
import part8 from "@/lib/pickup-artwork/part-8";
import part9 from "@/lib/pickup-artwork/part-9";
import part10 from "@/lib/pickup-artwork/part-10";
export const dynamic = "force-static";
export function GET() { return new Response(new Uint8Array(Buffer.from([part0,part1,part2,part3,part4,part5,part6,part7,part8,part9,part10].join(""),"base64")), {headers:{"Content-Type":"image/webp","Cache-Control":"public, max-age=31536000, immutable"}}); }
