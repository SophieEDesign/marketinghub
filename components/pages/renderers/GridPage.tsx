"use client";

interface GridPageProps {
  page: any;
  data?: any;
  [key: string]: any;
}

export default function GridPage(props: GridPageProps) {
  return (
    <div className="p-6 text-gray-500">
      Grid page type placeholder
    </div>
  );
}
