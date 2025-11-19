import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to default table/view
  redirect("/content/grid");
}
