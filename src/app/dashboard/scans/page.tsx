import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RecentScans from "@/components/Dashboard/RecentScans";
import { History } from "lucide-react";

export default async function ScansPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/");
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <History className="w-8 h-8 text-purple-500" />
                <h1 className="text-3xl font-bold">Recent Scans</h1>
            </div>

            <div className="w-full">
                <RecentScans userId={session.user.id} limit={20} />
            </div>
        </div>
    );
}
