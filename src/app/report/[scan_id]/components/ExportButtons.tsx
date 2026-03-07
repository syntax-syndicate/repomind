"use client";

import { Download, FileText, FileImage } from 'lucide-react';
import { StoredScan } from '@/lib/services/scan-storage';
import { toast } from 'sonner';
import { useState } from 'react';

interface ExportButtonsProps {
    scan: StoredScan;
    reportRef: React.RefObject<HTMLDivElement | null>;
}

export function ExportButtons({ scan, reportRef }: ExportButtonsProps) {
    const [isExporting, setIsExporting] = useState(false);

    const severityIcons: Record<string, string> = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🔵',
        info: '⚪'
    };

    const handleMarkdownExport = () => {
        try {
            const date = new Date(scan.timestamp).toLocaleDateString();
            const time = new Date(scan.timestamp).toLocaleTimeString();

            let md = `# Security Scan Report: ${scan.owner}/${scan.repo}\n\n`;
            md += `**Generated:** ${date} at ${time}\n`;
            md += `**Analyzer:** RepoMind Security Bot\n`;
            md += `**Depth:** ${scan.depth === 'deep' ? 'Deep Analysis' : 'Quick Scan'}\n\n`;
            md += `---\n\n`;

            md += `> **Executive Summary**\n`;
            if (scan.findings.length === 0) {
                md += `> The codebase appears clean based on the current configuration. **0** vulnerabilities were detected.\n\n`;
            } else {
                md += `> The codebase contains **${scan.summary.critical} Critical**, **${scan.summary.high} High**, **${scan.summary.medium} Medium**, and **${scan.summary.low} Low** severity issues.\n\n`;
            }

            if (scan.findings.length > 0) {
                md += `## Detailed Findings\n\n`;
                scan.findings.forEach(finding => {
                    const icon = severityIcons[finding.severity] || '⚪';
                    md += `### ${icon} [${finding.severity.toUpperCase()}] ${finding.title}\n\n`;

                    md += `- **Location**: \`${finding.file}\`${finding.line ? ` (Line ${finding.line})` : ''}\n`;
                    md += `- **Type**: ${finding.type}\n`;
                    if (finding.cwe) md += `- **CWE**: ${finding.cwe}\n`;
                    if (finding.cvss) md += `- **CVSS Score**: ${finding.cvss}\n`;
                    md += `\n**Description**\n${finding.description}\n\n`;
                    md += `**Recommendation**\n${finding.recommendation}\n\n`;

                    if (finding.snippet) {
                        const lang = finding.file.split('.').pop() || 'text';
                        md += `**Code Snippet**\n\`\`\`${lang}\n${finding.snippet}\n\`\`\`\n\n`;
                    }
                    md += `---\n\n`;
                });
            }

            const blob = new Blob([md], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `repomind-scan-${scan.owner}-${scan.repo}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success("Markdown report downloaded successfully!");
        } catch (error) {
            console.error("Failed to export Markdown:", error);
            toast.error("Failed to generate Markdown report.");
        }
    };

    const handlePdfExport = async () => {
        // Native browser print is the most robust way to generate a PDF for modern CSS (like lab colors) 
        // that html2canvas currently crashes on.
        window.print();
        toast.success("Opened print dialog. Remember to select 'Save as PDF'!");
    };

    return (
        <div className="flex items-center gap-2 mt-4 sm:mt-0 no-export print:hidden">
            <button
                onClick={handleMarkdownExport}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-white/10 rounded-lg transition-colors shadow-sm"
                title="Download Markdown"
            >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Markdown</span>
            </button>
            <button
                onClick={handlePdfExport}
                disabled={isExporting}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                title="Download PDF"
            >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'PDF'}</span>
            </button>
        </div>
    );
}
