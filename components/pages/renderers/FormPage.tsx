"use client";

interface FormPageProps {
  page: any;
  data?: any;
  [key: string]: any;
}

export default function FormPage(props: FormPageProps) {
  return (
    <div className="p-6 text-gray-500">
      Form Page page type placeholder
    </div>
  );
}
