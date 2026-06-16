import { Suspense } from "react";
import { AccountClient } from "./_client";

export const metadata = {
  title: "Account",
};

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountClient />
    </Suspense>
  );
}
