import { redirect } from "next/navigation"

export default async function HomePage() {
  // Authentication disabled for testing - redirect directly to tables
  redirect("/tables")
}
