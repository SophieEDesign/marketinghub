"use client";

export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { useParams } from "next/navigation";
import PageView from "@/components/pages/PageView";

function PageContent() {
  const params = useParams();
  const pageId = params.pageId as string;

  return <PageView pageId={pageId} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-sm text-gray-500">Loading page...</div>
        </div>
      }
    >
      <PageContent />
    </Suspense>
  );
}

