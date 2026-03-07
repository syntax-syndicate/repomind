import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPreviousScan, getScanResult } from '@/lib/services/scan-storage';
import { buildReportViewData } from '@/lib/services/report-service';
import { ReportContent } from './ReportContent';

export async function generateMetadata({ params }: { params: Promise<{ scan_id: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    const scan = await getScanResult(resolvedParams.scan_id);

    if (!scan) {
        return {
            title: 'Report Not Found - RepoMind'
        };
    }

    const { owner, repo, summary } = scan;
    const desc = `${summary.critical} Critical, ${summary.high} High, ${summary.medium} Medium issues found. Log in to jump into fix chat now and unlock PR automation in Phase 2.`;

    return {
        title: `Security Scan: ${owner}/${repo} - RepoMind`,
        description: desc,
        openGraph: {
            title: `RepoMind Security Scan: ${owner}/${repo}`,
            description: desc,
            type: 'website',
            images: [
                {
                    url: '/repomind.png', // Ideally this would be a dynamically generated OG image endpoint
                    width: 1200,
                    height: 630,
                    alt: 'Security Scan Summary',
                }
            ]
        },
        twitter: {
            card: 'summary_large_image',
            title: `RepoMind Security Scan: ${owner}/${repo}`,
            description: desc,
            images: ['/repomind.png'],
        }
    };
}

export default async function SharedReportPage({ params }: { params: Promise<{ scan_id: string }> }) {
    const resolvedParams = await params;
    const scan = await getScanResult(resolvedParams.scan_id);

    if (!scan) {
        notFound();
    }

    const previousScan = await getPreviousScan(scan.owner, scan.repo, scan.id, scan.timestamp);
    const reportView = buildReportViewData(scan, previousScan);

    return (
        <ReportContent
            scan={scan}
            priorScanDiff={reportView.priorScanDiff}
            topFixes={reportView.topFixes}
            hasPreviousScan={Boolean(previousScan)}
        />
    );
}
