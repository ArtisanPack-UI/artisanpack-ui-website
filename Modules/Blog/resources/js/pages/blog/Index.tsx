import { Head, Link, usePage } from '@inertiajs/react';

interface PublicPost {
    id: number;
    title: string;
    slug: string;
    url: string;
    excerpt: string | null;
    author: string | null;
    published_at: string | null;
    published_at_display: string | null;
}

interface PageProps {
    posts: PublicPost[];
    [key: string]: unknown;
}

export default function BlogIndex() {
    const { posts } = usePage<PageProps>().props;

    return (
        <>
            <Head title="Blog" />
            <main className="mx-auto max-w-3xl px-6 py-16">
                <header className="mb-12">
                    <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
                </header>
                {posts.length === 0 ? (
                    <p className="text-base-content/60">No posts yet.</p>
                ) : (
                    <ul className="flex flex-col gap-10">
                        {posts.map((post) => (
                            <li key={post.id}>
                                <article>
                                    <h2 className="text-2xl font-semibold">
                                        <Link
                                            href={post.url}
                                            className="hover:text-primary"
                                        >
                                            {post.title}
                                        </Link>
                                    </h2>
                                    <div className="mt-1 text-sm text-base-content/55">
                                        {post.author && <span>{post.author}</span>}
                                        {post.author &&
                                            post.published_at_display && (
                                                <span> · </span>
                                            )}
                                        {post.published_at &&
                                            post.published_at_display && (
                                                <time dateTime={post.published_at}>
                                                    {post.published_at_display}
                                                </time>
                                            )}
                                    </div>
                                    {post.excerpt && (
                                        <p className="mt-3 text-base-content/75">
                                            {post.excerpt}
                                        </p>
                                    )}
                                </article>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </>
    );
}
