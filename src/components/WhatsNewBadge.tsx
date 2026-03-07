"use client";

import { useState } from "react";

import { Sparkles } from "lucide-react";
import { WhatsNewModal } from "./WhatsNewModal";

export function WhatsNewBadge() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="hover:scale-105 transition-transform group"
            >
                <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-600/30 rounded-full backdrop-blur-md hover:border-blue-600/50 transition-colors">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="hidden md:inline text-sm font-medium text-blue-200">What's New</span>
                    <Sparkles className="w-4 h-4 md:hidden text-blue-400" />
                </div>
            </button>

            <WhatsNewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
}
