import { Shield, Sparkles, X } from "lucide-react";

import { DEEP_SCAN_FILE_LIMIT, QUICK_SCAN_FILE_LIMIT } from "@/lib/chat-constants";

interface DeepScansData {
    used: number;
    total: number;
    resetsAt: string;
}

interface SecurityScanModalProps {
    isOpen: boolean;
    isAuthenticated: boolean;
    deepScansData: DeepScansData | null;
    onClose: () => void;
    onRunQuickScan: () => void;
    onRunDeepScan: () => void;
}

export function SecurityScanModal({
    isOpen,
    isAuthenticated,
    deepScansData,
    onClose,
    onRunQuickScan,
    onRunDeepScan,
}: SecurityScanModalProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col relative shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="p-6">
                    <h2 className="text-xl font-bold text-white mb-2 pr-8 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-red-400" />
                        Security Check
                    </h2>
                    <p className="text-zinc-400 text-sm mb-6">Choose the depth of your security analysis.</p>

                    <div className="space-y-4">
                        <button
                            onClick={onRunQuickScan}
                            className="w-full bg-zinc-800 hover:bg-zinc-700 border border-white/5 rounded-xl p-4 text-left transition-all group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-white font-medium group-hover:text-red-300 transition-colors">Quick Scan</h3>
                                <span className="text-xs font-mono bg-zinc-950 px-2 py-0.5 rounded text-zinc-400">~ 5 sec</span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Analyzes up to {QUICK_SCAN_FILE_LIMIT} files. Automatically flags potential secrets and common injection points. Fast and low-latency.
                            </p>
                        </button>

                        <button
                            onClick={onRunDeepScan}
                            className="w-full bg-zinc-800 hover:bg-zinc-700 border border-red-500/20 rounded-xl p-4 text-left transition-all group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-white font-medium flex items-center gap-2 group-hover:text-red-300 transition-colors">
                                    Deep Scan
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                </h3>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-mono bg-zinc-950 px-2 py-0.5 rounded text-zinc-400">~ 20 sec</span>
                                    {isAuthenticated && deepScansData && (
                                        <span className="text-[10px] text-zinc-500 mt-1">
                                            {deepScansData.total - deepScansData.used} / {deepScansData.total} remaining
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Analyzes up to {DEEP_SCAN_FILE_LIMIT} files. Utilizes advanced AI pipeline to follow code paths and find complex vulnerabilities.
                            </p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
