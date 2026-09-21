import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteOwnAccount } from "./actions";

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/delete");
  }

  return (
    <div className="container" style={{ maxWidth: 440, paddingTop: 40 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>退会</h1>
      <div className="card" style={{ borderColor: "var(--critical)" }}>
        {searchParams.error && <p className="err">{searchParams.error}</p>}
        <p style={{ marginBottom: 10 }}>
          退会すると、アカウント（{user.email}）とお気に入り・応募履歴・投稿との紐付けなど、このアカウントに関する情報が削除されます。
        </p>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 18 }}>
          ※掲示板への投稿自体は残りますが、投稿者アカウントとの紐付けは解除されます。
          <br />
          ※この操作は取り消せません。
        </p>
        <form action={deleteOwnAccount}>
          <button
            type="submit"
            className="btn"
            style={{ width: "100%", background: "var(--critical)", color: "#fff", borderColor: "var(--critical)" }}
          >
            退会する（元に戻せません）
          </button>
        </form>
      </div>
    </div>
  );
}
