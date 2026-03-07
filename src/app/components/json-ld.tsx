export default function JsonLd() {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "WebSite",
                    name: "RepoMind",
                    url: process.env.NEXT_PUBLIC_APP_URL || "https://repomind.in",
                }),
            }}
        />
    );
}
