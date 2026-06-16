import { Suspense } from "react";
import { SearchClient } from "./_client";

export const metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchClient />
    </Suspense>
  );
}
