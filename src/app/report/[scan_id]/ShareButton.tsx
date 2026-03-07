"use client";

import { CopySquaresIcon } from '@/components/icons/CopySquaresIcon';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ShareButton({ scanId }: { scanId: string }) {
    const handleShare = () => {
        const url = `${window.location.origin}/report/${scanId}`;
        navigator.clipboard.writeText(url);
        toast.success("Report link copied to clipboard!");
    };

    return (
        <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
        >
            <Share2 className="w-4 h-4" />
            Share Report
        </button>
    );
}
