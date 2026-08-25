import { Head } from '@inertiajs/react';
import { FormRenderer } from '@/vendor/artisanpack-forms/react/components/FormRenderer';

interface Props {
    form: {
        id: number;
        slug: string;
        name: string;
    };
}

export default function PublicForm({ form }: Props) {
    return (
        <>
            <Head title={form.name} />
            <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
                <header className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold text-base-content">{form.name}</h1>
                </header>
                <section className="rounded-xl border border-base-300/60 bg-base-100 p-6 shadow-sm">
                    <FormRenderer baseUrl="/api/v1/forms" formSlug={form.slug} />
                </section>
            </main>
        </>
    );
}
