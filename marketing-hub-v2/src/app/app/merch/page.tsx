import { redirect } from "next/navigation";

export default function MerchRedirect() {
  redirect("/app/internal");
}
