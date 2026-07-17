import { redirect } from "next/navigation";

/** Legacy path — nav now uses /app/requests. */
export default function InternalRedirectPage() {
  redirect("/app/requests");
}
