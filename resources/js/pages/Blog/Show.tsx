import { Head, Link, usePage } from '@inertiajs/react';
import { index as blogIndex } from '@/routes/blog';

interface PublicPost {
    id: number;
    title: string;
    slug: string;
    url: string;
    excerpt: string | null;
    content: string | null;
    author: string | null;
    published_at: string | null;
    published_at_display: string | null;
}

interface PageProps {
    post: PublicPost;
    [key: string]: unknown;
}

export default function BlogShow() {
    const { post } = usePage<PageProps>().props;

    return (
        <>
            <Head title={post.title} />
            <main className="mx-auto max-w-3xl px-6 py-16">
                <nav className="mb-8 text-sm">
                    <Link
                        href={blogIndex().url}
                        className="text-base-content/60 hover:text-primary"
                    >
                        ← Back to blog
                    </Link>
                </nav>
                <article>
                    <header className="mb-8">
                        <h1 className="text-4xl font-bold tracking-tight">
                            {post.title}
                        </h1>
                        <div className="mt-2 text-sm text-base-content/55">
                            {post.author && <span>{post.author}</span>}
                            {post.author && post.published_at_display && (
                                <span> · </span>
                            )}
                            {post.published_at && post.published_at_display && (
                                <time dateTime={post.published_at}>
                                    {post.published_at_display}
                                </time>
                            )}
                        </div>
                    </header>
                    {post.content && (
                        <div className="prose prose-neutral max-w-none whitespace-pre-wrap">
                            {post.content}
                        </div>
                    )}
                </article>
            </main>
        </>
    );
}
