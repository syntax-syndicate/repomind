import { auth } from "@/lib/auth";
import WelcomeBanner from "@/components/Dashboard/WelcomeBanner";
import QuickStats from "@/components/Dashboard/QuickStats";
import RecentScans from "@/components/Dashboard/RecentScans";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/");
    }

    return (
        <div className="space-y-8">
            <WelcomeBanner user={session.user} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <RecentScans userId={session.user.id} limit={5} showViewAll />
                </div>
                <div className="space-y-8">
                    <QuickStats />
                </div>
            </div>
        </div>
    );
}
