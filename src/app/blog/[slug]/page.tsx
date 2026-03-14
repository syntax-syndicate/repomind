import { getPublishedPostBySlug, getPublishedPosts } from "@/lib/services/blog-service";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clock, Share2 } from "lucide-react";
import Footer from "@/components/Footer";
import { EnhancedMarkdown } from "@/components/EnhancedMarkdown";
import { BlogPost } from "@prisma/client";
import { Metadata } from "next";

// Generates static params for all blog posts
export async function generateStaticParams() {
  const posts: BlogPost[] = await getPublishedPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalPath = `/blog/${post.slug}`;
  const publishedTime = (post.publishedAt ?? post.createdAt).toISOString();

  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords ?? undefined,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: canonicalPath,
      images: [
        {
          url: post.image,
          alt: post.title,
        },
      ],
      publishedTime,
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.image],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
       {/* Header / Nav */}
       <div className="border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
            RepoMind
          </Link>
          <div className="flex gap-6 items-center">
            <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">Analyzer</Link>
            <Link href="/blog" className="text-sm text-white font-medium">Insights</Link>
            <Link href="https://github.com/403errors/repomind" target="_blank" className="text-sm text-zinc-400 hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <Link 
          href="/blog" 
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12 text-sm font-medium"
        >
          <ArrowLeft size={16} /> Back to Insights
        </Link>

        {/* Post Metadata */}
        <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20 uppercase tracking-widest">
                    {post.category}
                </span>
                <span className="text-zinc-500 text-xs flex items-center gap-1">
                    <Clock size={12} /> 5 min read
                </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight leading-tight">
                {post.title}
            </h1>
            <div className="flex items-center justify-between py-6 border-y border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold">
                        RM
                    </div>
                    <div>
                        <p className="text-sm font-bold">{post.author}</p>
                        <p className="text-xs text-zinc-500">{post.date}</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <Share2 size={18} className="text-zinc-400" />
                    </button>
                </div>
            </div>
        </div>

        {/* Hero Image */}
        <div className="relative aspect-video rounded-3xl overflow-hidden mb-16 border border-white/5 shadow-2xl">
            <Image 
                src={post.image} 
                alt={post.title}
                fill
                className="object-cover"
                priority
            />
        </div>

        {/* Post Content */}
        <div className="prose prose-invert prose-purple max-w-none">
            <EnhancedMarkdown content={post.content} />
        </div>

        {/* CTA */}
        <div className="mt-20 pt-12 border-t border-white/5 text-center">
            <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-purple-400 mb-8">Ready to see it in action?</h4>
            <Link 
                href="/" 
                className="inline-block bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold px-8 py-4 rounded-2xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20"
            >
                Start Analyzing Repos Now
            </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
