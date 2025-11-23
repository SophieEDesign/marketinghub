"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import PageView from "@/components/pages/PageView";

function ViewPageContent() {
  const params = useParams();
  const pageId = params.pageId as string;

  // PageView in readonly mode (defaultEditing=false)
  return <PageView pageId={pageId} defaultEditing={false} />;
}

export default function ViewPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-sm text-gray-500">Loading page...</div>
        </div>
      }
    >
      <ViewPageContent />
    </Suspense>
  );
}

