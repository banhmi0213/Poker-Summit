import { LiffProvider } from "./liff-provider";

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider>
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "16px 16px 48px",
        }}
      >
        {children}
      </div>
    </LiffProvider>
  );
}
