"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import PageView from "@/components/pages/PageView";

function EditPageContent() {
  const params = useParams();
  const pageId = params.pageId as string;

  // PageView handles editing mode internally
  // We'll modify it to default to editing mode when on /edit route
  return <PageView pageId={pageId} defaultEditing={true} />;
}

export default function EditPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-sm text-gray-500">Loading editor...</div>
        </div>
      }
    >
      <EditPageContent />
    </Suspense>
  );
}

