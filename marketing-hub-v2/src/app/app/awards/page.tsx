import { AwardsClient } from "@/components/awards/AwardsClient";
import { listAwards } from "@/lib/data/repos";

export default async function AwardsPage() {
  return <AwardsClient initial={await listAwards()} />;
}
